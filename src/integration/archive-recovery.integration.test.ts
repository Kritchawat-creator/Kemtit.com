import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function isLocalSupabaseUrl(value: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

const integrationEnabled = process.env.V2_INTEGRATION === "1" && isLocalSupabaseUrl(supabaseUrl);

function serviceClient(): DbClient {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function userClient(): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: crypto.randomUUID() },
  });
}

async function createTestUser(admin: DbClient) {
  const email = `kemtit-archive-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("archive integration user was not created");

  const client = userClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw signInError;
  }
  return { client, id: data.user.id };
}

async function insertTask(client: DbClient, userId: string, title: string) {
  const { data, error } = await client
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      due_date: "2030-04-01",
      planned_date: "2030-04-01",
      domain: "work",
      status: "planned",
      priority: "normal",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("archive integration task was not created");
  return data.id;
}

async function insertGoal(client: DbClient, userId: string, status: "active" | "completed", title: string) {
  const { data, error } = await client
    .from("goals")
    .insert({
      user_id: userId,
      title,
      period_type: "month",
      period_start: "2030-04-01",
      domain: "work",
      goal_kind: "execution",
      status,
      completed_at: status === "completed" ? "2030-04-30T12:00:00.000Z" : null,
      data_origin: "USER",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("archive integration goal was not created");
  return data.id;
}

describe.skipIf(!integrationEnabled)("recoverable archive on local Supabase", () => {
  it("cancels linked blocks atomically and never reactivates them on task restore", async () => {
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = serviceClient();
    let owner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    let otherOwner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    try {
      owner = await createTestUser(admin);
      otherOwner = await createTestUser(admin);
      const taskId = await insertTask(owner.client, owner.id, "Archive linked task");
      const { data: block, error: blockError } = await owner.client
        .from("time_blocks")
        .insert({
          user_id: owner.id,
          task_id: taskId,
          title: "Linked block",
          start_at: "2030-04-01T02:00:00.000Z",
          end_at: "2030-04-01T02:30:00.000Z",
        })
        .select("id")
        .single();
      expect(blockError).toBeNull();
      expect(block).not.toBeNull();

      const unauthorizedArchive = await otherOwner.client.rpc("archive_task_atomic", {
        p_task_id: taskId,
      });
      expect(unauthorizedArchive.error?.message).toContain("task_not_found");
      const { data: stillOwnedTask, error: stillOwnedTaskError } = await admin
        .from("tasks")
        .select("status")
        .eq("id", taskId)
        .single();
      expect(stillOwnedTaskError).toBeNull();
      expect(stillOwnedTask?.status).toBe("planned");

      const archived = await owner.client.rpc("archive_task_atomic", { p_task_id: taskId });
      expect(archived.error).toBeNull();
      expect(archived.data).toEqual({ goalId: null, cancelledBlocks: 1 });

      const unauthorizedRestore = await otherOwner.client.rpc("restore_task_atomic", {
        p_task_id: taskId,
      });
      expect(unauthorizedRestore.error?.message).toContain("task_not_found");

      const { data: archivedTask, error: archivedTaskError } = await admin
        .from("tasks")
        .select("status, archived_from_status, archived_at")
        .eq("id", taskId)
        .single();
      expect(archivedTaskError).toBeNull();
      expect(archivedTask).toMatchObject({ status: "archived", archived_from_status: "planned" });
      expect(archivedTask?.archived_at).not.toBeNull();

      const { data: cancelledBlock, error: cancelledBlockError } = await admin
        .from("time_blocks")
        .select("status, version")
        .eq("id", block!.id)
        .single();
      expect(cancelledBlockError).toBeNull();
      expect(cancelledBlock).toEqual({ status: "cancelled", version: 2 });

      const restored = await owner.client.rpc("restore_task_atomic", { p_task_id: taskId });
      expect(restored.error).toBeNull();
      const { data: restoredTask, error: restoredTaskError } = await admin
        .from("tasks")
        .select("status, archived_at")
        .eq("id", taskId)
        .single();
      expect(restoredTaskError).toBeNull();
      expect(restoredTask).toEqual({ status: "planned", archived_at: null });

      const { data: stillCancelledBlock, error: stillCancelledBlockError } = await admin
        .from("time_blocks")
        .select("status, version")
        .eq("id", block!.id)
        .single();
      expect(stillCancelledBlockError).toBeNull();
      expect(stillCancelledBlock).toEqual({ status: "cancelled", version: 2 });

      const archivedAgain = await owner.client.rpc("archive_task_atomic", { p_task_id: taskId });
      expect(archivedAgain.error).toBeNull();
      const { error: makeLegacyError } = await admin
        .from("tasks")
        .update({ archived_at: null })
        .eq("id", taskId);
      expect(makeLegacyError).toBeNull();

      const attemptedReactivation = await owner.client
        .from("time_blocks")
        .update({ status: "active" })
        .eq("id", block!.id);
      expect(attemptedReactivation.error?.message).toContain("time_block_task_archived");

      const occurrenceTaskId = await insertTask(owner.client, owner.id, "Active task with archived occurrence");
      const { data: occurrence, error: occurrenceError } = await owner.client
        .from("task_occurrences")
        .insert({
          task_id: occurrenceTaskId,
          user_id: owner.id,
          occurrence_date: "2030-04-03",
          scheduled_date: "2030-04-03",
          status: "archived",
        })
        .select("id")
        .single();
      expect(occurrenceError).toBeNull();
      expect(occurrence).not.toBeNull();

      const otherOccurrenceTaskId = await insertTask(
        owner.client,
        owner.id,
        "Task that does not own the occurrence",
      );
      const mismatchedOccurrenceBlock = await owner.client.from("time_blocks").insert({
        user_id: owner.id,
        task_id: otherOccurrenceTaskId,
        task_occurrence_id: occurrence!.id,
        title: "Mismatched task and occurrence",
        start_at: "2030-04-03T03:00:00.000Z",
        end_at: "2030-04-03T03:30:00.000Z",
      });
      expect(mismatchedOccurrenceBlock.error).not.toBeNull();

      const archivedOccurrenceBlock = await owner.client.from("time_blocks").insert({
        user_id: owner.id,
        task_id: occurrenceTaskId,
        task_occurrence_id: occurrence!.id,
        title: "Block for archived occurrence",
        start_at: "2030-04-03T02:00:00.000Z",
        end_at: "2030-04-03T02:30:00.000Z",
      });
      expect(archivedOccurrenceBlock.error?.message).toContain("time_block_task_archived");
    } finally {
      if (owner) await admin.auth.admin.deleteUser(owner.id);
      if (otherOwner) await admin.auth.admin.deleteUser(otherOwner.id);
    }
  });

  it("restores project status and uses active only for legacy archives without saved status", async () => {
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = serviceClient();
    let owner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    let otherOwner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    try {
      owner = await createTestUser(admin);
      otherOwner = await createTestUser(admin);
      const { data: project, error: insertError } = await owner.client
        .from("projects")
        .insert({ user_id: owner.id, title: "Paused archive project", status: "paused" })
        .select("id")
        .single();
      expect(insertError).toBeNull();
      expect(project).not.toBeNull();

      const unauthorizedArchive = await otherOwner.client.rpc("archive_project_atomic", {
        p_project_id: project!.id,
      });
      expect(unauthorizedArchive.error?.message).toContain("project_not_found");

      const archived = await owner.client.rpc("archive_project_atomic", {
        p_project_id: project!.id,
      });
      expect(archived.error).toBeNull();

      const unauthorizedRestore = await otherOwner.client.rpc("restore_project_atomic", {
        p_project_id: project!.id,
      });
      expect(unauthorizedRestore.error?.message).toContain("project_not_found");

      const restored = await owner.client.rpc("restore_project_atomic", {
        p_project_id: project!.id,
      });
      expect(restored.error).toBeNull();
      const { data: restoredProject, error: restoredProjectError } = await admin
        .from("projects")
        .select("status, archived_at")
        .eq("id", project!.id)
        .single();
      expect(restoredProjectError).toBeNull();
      expect(restoredProject).toEqual({ status: "paused", archived_at: null });

      const { error: makeLegacyError } = await admin
        .from("projects")
        .update({ status: "archived", archived_at: null, archived_from_status: null })
        .eq("id", project!.id);
      expect(makeLegacyError).toBeNull();

      const restoredLegacy = await owner.client.rpc("restore_project_atomic", {
        p_project_id: project!.id,
      });
      expect(restoredLegacy.error).toBeNull();
      const { data: legacyProject, error: legacyProjectError } = await admin
        .from("projects")
        .select("status, archived_at")
        .eq("id", project!.id)
        .single();
      expect(legacyProjectError).toBeNull();
      expect(legacyProject).toEqual({ status: "active", archived_at: null });
    } finally {
      if (owner) await admin.auth.admin.deleteUser(owner.id);
      if (otherOwner) await admin.auth.admin.deleteUser(otherOwner.id);
    }
  });

  it("preserves completed goal status, authorizes only its owner, and archives idempotently", async () => {
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = serviceClient();
    let owner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    let otherOwner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    try {
      owner = await createTestUser(admin);
      otherOwner = await createTestUser(admin);
      const goalId = await insertGoal(owner.client, owner.id, "completed", "Completed goal");

      const unauthorizedArchive = await otherOwner.client.rpc("archive_goal_atomic", {
        p_goal_id: goalId,
      });
      expect(unauthorizedArchive.error?.message).toContain("goal_not_found");
      const { data: unchangedGoal, error: unchangedGoalError } = await admin
        .from("goals")
        .select("status, archived_at")
        .eq("id", goalId)
        .single();
      expect(unchangedGoalError).toBeNull();
      expect(unchangedGoal).toEqual({ status: "completed", archived_at: null });

      const archived = await owner.client.rpc("archive_goal_atomic", { p_goal_id: goalId });
      expect(archived.error).toBeNull();
      expect(archived.data).toBe(goalId);
      const { data: firstArchive, error: firstArchiveError } = await admin
        .from("goals")
        .select("status, archived_at, archived_from_status")
        .eq("id", goalId)
        .single();
      expect(firstArchiveError).toBeNull();
      expect(firstArchive).toMatchObject({
        status: "archived",
        archived_from_status: "completed",
      });
      expect(firstArchive?.archived_at).not.toBeNull();

      const archivedAgain = await owner.client.rpc("archive_goal_atomic", { p_goal_id: goalId });
      expect(archivedAgain.error).toBeNull();
      const { data: stillArchived, error: stillArchivedError } = await admin
        .from("goals")
        .select("status, archived_at, archived_from_status")
        .eq("id", goalId)
        .single();
      expect(stillArchivedError).toBeNull();
      expect(stillArchived).toEqual(firstArchive);

      const unauthorizedRestore = await otherOwner.client.rpc("restore_goal_atomic", {
        p_goal_id: goalId,
      });
      expect(unauthorizedRestore.error?.message).toContain("goal_not_found");

      const restored = await owner.client.rpc("restore_goal_atomic", { p_goal_id: goalId });
      expect(restored.error).toBeNull();
      const { data: restoredGoal, error: restoredGoalError } = await admin
        .from("goals")
        .select("status, archived_at, archived_from_status")
        .eq("id", goalId)
        .single();
      expect(restoredGoalError).toBeNull();
      expect(restoredGoal).toEqual({
        status: "completed",
        archived_at: null,
        archived_from_status: null,
      });

      const { error: makeLegacyError } = await admin
        .from("goals")
        .update({ status: "archived", archived_at: null, archived_from_status: null })
        .eq("id", goalId);
      expect(makeLegacyError).toBeNull();
      const restoredLegacy = await owner.client.rpc("restore_goal_atomic", { p_goal_id: goalId });
      expect(restoredLegacy.error).toBeNull();
      const { data: legacyGoal, error: legacyGoalError } = await admin
        .from("goals")
        .select("status, archived_at, archived_from_status")
        .eq("id", goalId)
        .single();
      expect(legacyGoalError).toBeNull();
      expect(legacyGoal).toEqual({
        status: "active",
        archived_at: null,
        archived_from_status: null,
      });
    } finally {
      if (owner) await admin.auth.admin.deleteUser(owner.id);
      if (otherOwner) await admin.auth.admin.deleteUser(otherOwner.id);
    }
  });
});
