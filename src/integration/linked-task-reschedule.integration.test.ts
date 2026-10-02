import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;
const integrationEnabled = process.env.V2_INTEGRATION === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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
  const email = `kemtit-linked-block-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("integration user was not created");

  const client = userClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw signInError;
  }
  return { client, id: data.user.id };
}

async function insertTask(
  client: DbClient,
  userId: string,
  input: {
    id?: string;
    title: string;
    dueDate: string | null;
    plannedDate: string | null;
    deadline?: string | null;
    recurrenceRule?: string | null;
    status?: "inbox" | "planned";
  },
) {
  const { data, error } = await client
    .from("tasks")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: userId,
      title: input.title,
      due_date: input.dueDate,
      planned_date: input.plannedDate,
      deadline: input.deadline ?? null,
      recurrence_rule: input.recurrenceRule ?? null,
      domain: "work",
      status: input.status ?? "planned",
      priority: "normal",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("integration task was not created");
  return data.id;
}

async function insertBlock(
  client: DbClient,
  userId: string,
  input: {
    taskId?: string | null;
    occurrenceId?: string | null;
    title: string;
    startAt: string;
    endAt: string;
    locked?: boolean;
  },
) {
  const { data, error } = await client
    .from("time_blocks")
    .insert({
      user_id: userId,
      task_id: input.taskId ?? null,
      task_occurrence_id: input.occurrenceId ?? null,
      title: input.title,
      start_at: input.startAt,
      end_at: input.endAt,
      is_locked: input.locked ?? false,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("integration time block was not created");
  return data.id;
}

describe.skipIf(!integrationEnabled)("atomic linked task rescheduling", () => {
  it("moves linked blocks with task and occurrence dates and rolls back conflicts", async () => {
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = serviceClient();
    let owner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    let otherOwner: Awaited<ReturnType<typeof createTestUser>> | null = null;

    try {
      owner = await createTestUser(admin);
      otherOwner = await createTestUser(admin);
      const taskId = await insertTask(owner.client, owner.id, {
        title: "One-off linked task",
        dueDate: "2030-04-01",
        plannedDate: "2030-04-01",
        deadline: "2030-04-05",
      });
      const blockId = await insertBlock(owner.client, owner.id, {
        taskId,
        title: "One-off focus block",
        startAt: "2030-04-01T02:00:00.000Z",
        endAt: "2030-04-01T02:30:00.000Z",
      });
      const preparedBlockId = await insertBlock(owner.client, owner.id, {
        title: "Prepared destination block",
        startAt: "2030-04-02T02:00:00.000Z",
        endAt: "2030-04-02T02:30:00.000Z",
      });
      const { error: preparedOriginError } = await admin
        .from("time_blocks")
        .update({ data_origin: "SYSTEM" })
        .eq("id", preparedBlockId);
      expect(preparedOriginError).toBeNull();

      const invalidDirectUpdate = await owner.client.rpc("update_task_with_blocks_atomic", {
        p_task_id: taskId,
        p_title: "Invalid direct update",
        p_due_date: "2030-04-01",
        p_planned_date: "2030-04-01",
        p_update_planned_date: true,
        p_deadline: null,
        p_update_deadline: false,
        p_domain: null as never,
        p_recurrence_rule: null,
        p_goal_id: null,
        p_project_id: null,
        p_priority: "normal",
        p_estimated_minutes: null,
        p_notes: null,
      });
      expect(invalidDirectUpdate.error?.message).toContain("invalid_task_input");

      const moved = await owner.client.rpc("reschedule_task_atomic", {
        p_task_id: taskId,
        p_new_date: "2030-04-02",
      });
      expect(moved.error).toBeNull();

      const { data: movedTask, error: movedTaskError } = await admin
        .from("tasks")
        .select("planned_date, due_date, deadline")
        .eq("id", taskId)
        .single();
      expect(movedTaskError).toBeNull();
      expect(movedTask).toMatchObject({
        planned_date: "2030-04-02",
        due_date: "2030-04-02",
        deadline: "2030-04-05",
      });

      const { data: movedBlock, error: movedBlockError } = await admin
        .from("time_blocks")
        .select("task_id, task_occurrence_id, start_at, end_at, version")
        .eq("id", blockId)
        .single();
      expect(movedBlockError).toBeNull();
      expect(movedBlock).toMatchObject({
        task_id: taskId,
        task_occurrence_id: null,
        start_at: "2030-04-02T02:00:00+00:00",
        end_at: "2030-04-02T02:30:00+00:00",
        version: 2,
      });

      const overlapId = await insertBlock(admin, owner.id, {
        title: "Unlinked destination blocker",
        startAt: "2030-04-03T02:00:00.000Z",
        endAt: "2030-04-03T02:30:00.000Z",
      });
      const { data: unlinkedBlock, error: unlinkedBlockError } = await admin
        .from("time_blocks")
        .select("task_id")
        .eq("id", overlapId);
      expect(unlinkedBlockError).toBeNull();
      expect(unlinkedBlock?.[0]?.task_id).toBeNull();

      const conflicted = await owner.client.rpc("reschedule_task_atomic", {
        p_task_id: taskId,
        p_new_date: "2030-04-03",
      });
      expect(conflicted.error?.message).toContain("time_block_overlap");

      const { data: afterConflictTask } = await admin
        .from("tasks")
        .select("planned_date, due_date, deadline")
        .eq("id", taskId)
        .single();
      const { data: afterConflictBlock } = await admin
        .from("time_blocks")
        .select("start_at, end_at, version")
        .eq("id", blockId)
        .single();
      expect(afterConflictTask).toMatchObject({
        planned_date: "2030-04-02",
        due_date: "2030-04-02",
        deadline: "2030-04-05",
      });
      expect(afterConflictBlock).toMatchObject({
        start_at: "2030-04-02T02:00:00+00:00",
        end_at: "2030-04-02T02:30:00+00:00",
        version: 2,
      });

      const formEdit = await owner.client.rpc("update_task_with_blocks_atomic", {
        p_task_id: taskId,
        p_title: "Renamed and moved by task form",
        p_due_date: "2030-04-04",
        p_planned_date: "2030-04-04",
        p_update_planned_date: true,
        p_deadline: null,
        p_update_deadline: false,
        p_domain: "work",
        p_recurrence_rule: null,
        p_goal_id: null,
        p_project_id: null,
        p_priority: "normal",
        p_estimated_minutes: null,
        p_notes: null,
      });
      expect(formEdit.error).toBeNull();

      const { data: formMovedTask } = await admin
        .from("tasks")
        .select("planned_date, due_date, deadline")
        .eq("id", taskId)
        .single();
      const { data: formMovedBlock } = await admin
        .from("time_blocks")
        .select("start_at, end_at, version")
        .eq("id", blockId)
        .single();
      expect(formMovedTask).toMatchObject({
        planned_date: "2030-04-04",
        due_date: "2030-04-04",
        deadline: "2030-04-05",
      });
      expect(formMovedBlock).toMatchObject({
        start_at: "2030-04-04T02:00:00+00:00",
        end_at: "2030-04-04T02:30:00+00:00",
        version: 3,
      });

      const lockedEdit = await admin
        .from("time_blocks")
        .update({ is_locked: true })
        .eq("id", blockId);
      expect(lockedEdit.error).toBeNull();
      const sameDayLockedEdit = await owner.client.rpc("update_task_with_blocks_atomic", {
        p_task_id: taskId,
        p_title: "Rename while block stays locked",
        p_due_date: "2030-04-04",
        p_planned_date: "2030-04-04",
        p_update_planned_date: true,
        p_deadline: null,
        p_update_deadline: false,
        p_domain: "work",
        p_recurrence_rule: null,
        p_goal_id: null,
        p_project_id: null,
        p_priority: "normal",
        p_estimated_minutes: null,
        p_notes: null,
      });
      expect(sameDayLockedEdit.error).toBeNull();
      const { data: unchangedLockedBlock } = await admin
        .from("time_blocks")
        .select("start_at, end_at, version, is_locked")
        .eq("id", blockId)
        .single();
      expect(unchangedLockedBlock).toMatchObject({
        start_at: "2030-04-04T02:00:00+00:00",
        end_at: "2030-04-04T02:30:00+00:00",
        version: 3,
        is_locked: true,
      });
      const lockedMove = await owner.client.rpc("reschedule_task_atomic", {
        p_task_id: taskId,
        p_new_date: "2030-04-05",
      });
      expect(lockedMove.error?.message).toContain("time_block_locked");

      const otherTaskId = await insertTask(otherOwner.client, otherOwner.id, {
        title: "Other owner task",
        dueDate: "2030-04-01",
        plannedDate: "2030-04-01",
      });
      const crossOwner = await owner.client.rpc("reschedule_task_atomic", {
        p_task_id: otherTaskId,
        p_new_date: "2030-04-02",
      });
      expect(crossOwner.error?.message).toContain("task_not_found");

      const inboxTaskId = await insertTask(owner.client, owner.id, {
        title: "Inbox task with unanchored linked block",
        dueDate: null,
        plannedDate: null,
        status: "inbox",
      });
      const inboxBlockId = await insertBlock(owner.client, owner.id, {
        taskId: inboxTaskId,
        title: "Inbox task block",
        startAt: "2030-04-12T03:00:00.000Z",
        endAt: "2030-04-12T03:30:00.000Z",
      });
      const misalignedInboxPlan = await owner.client.rpc("plan_inbox_task_atomic", {
        p_task_id: inboxTaskId,
        p_new_date: "2030-04-13",
      });
      expect(misalignedInboxPlan.error?.message).toContain("time_block_anchor_missing");
      const { data: unchangedInboxTask } = await admin
        .from("tasks")
        .select("status, planned_date, due_date")
        .eq("id", inboxTaskId)
        .single();
      const { data: unchangedInboxBlock } = await admin
        .from("time_blocks")
        .select("start_at, end_at, version")
        .eq("id", inboxBlockId)
        .single();
      expect(unchangedInboxTask).toMatchObject({
        status: "inbox",
        planned_date: null,
        due_date: null,
      });
      expect(unchangedInboxBlock).toMatchObject({
        start_at: "2030-04-12T03:00:00+00:00",
        end_at: "2030-04-12T03:30:00+00:00",
        version: 1,
      });
      const alignedInboxPlan = await owner.client.rpc("plan_inbox_task_atomic", {
        p_task_id: inboxTaskId,
        p_new_date: "2030-04-12",
      });
      expect(alignedInboxPlan.error).toBeNull();
      const { data: plannedInboxTask } = await admin
        .from("tasks")
        .select("status, planned_date, due_date")
        .eq("id", inboxTaskId)
        .single();
      expect(plannedInboxTask).toMatchObject({
        status: "planned",
        planned_date: "2030-04-12",
        due_date: "2030-04-12",
      });

      const recurringTaskId = await insertTask(owner.client, owner.id, {
        title: "Recurring task with linked block",
        dueDate: "2030-05-01",
        plannedDate: "2030-05-01",
        recurrenceRule: "FREQ=DAILY",
      });
      const { data: occurrence, error: occurrenceError } = await owner.client
        .from("task_occurrences")
        .insert({
          task_id: recurringTaskId,
          user_id: owner.id,
          occurrence_date: "2030-05-01",
          scheduled_date: "2030-05-02",
          status: "planned",
        })
        .select("id")
        .single();
      expect(occurrenceError).toBeNull();
      expect(occurrence).not.toBeNull();
      const occurrenceBlockId = await insertBlock(owner.client, owner.id, {
        taskId: recurringTaskId,
        occurrenceId: occurrence!.id,
        title: "Occurrence focus block",
        startAt: "2030-05-02T03:00:00.000Z",
        endAt: "2030-05-02T03:30:00.000Z",
      });

      const occurrenceMove = await owner.client.rpc("reschedule_task_occurrence_atomic", {
        p_task_id: recurringTaskId,
        p_occurrence_date: "2030-05-01",
        p_new_occurrence_date: "2030-05-03",
      });
      expect(occurrenceMove.error).toBeNull();
      expect(occurrenceMove.data).toBe(occurrence!.id);

      const { data: movedOccurrence } = await admin
        .from("task_occurrences")
        .select("id, occurrence_date, scheduled_date")
        .eq("id", occurrence!.id)
        .single();
      const { data: movedOccurrenceBlock } = await admin
        .from("time_blocks")
        .select("task_id, task_occurrence_id, start_at, end_at")
        .eq("id", occurrenceBlockId)
        .single();
      expect(movedOccurrence).toMatchObject({
        id: occurrence!.id,
        occurrence_date: "2030-05-01",
        scheduled_date: "2030-05-03",
      });
      expect(movedOccurrenceBlock).toMatchObject({
        task_id: recurringTaskId,
        task_occurrence_id: occurrence!.id,
        start_at: "2030-05-03T03:00:00+00:00",
        end_at: "2030-05-03T03:30:00+00:00",
      });

      const { error: occurrenceBlockerError } = await admin.from("time_blocks").insert({
        user_id: owner.id,
        task_id: null,
        title: "Unlinked occurrence blocker",
        start_at: "2030-05-04T03:00:00.000Z",
        end_at: "2030-05-04T03:30:00.000Z",
      });
      expect(occurrenceBlockerError).toBeNull();
      const occurrenceConflict = await owner.client.rpc("reschedule_task_occurrence_atomic", {
        p_task_id: recurringTaskId,
        p_occurrence_date: "2030-05-01",
        p_new_occurrence_date: "2030-05-04",
      });
      expect(occurrenceConflict.error?.message).toContain("time_block_overlap");
      const { data: unchangedOccurrence } = await admin
        .from("task_occurrences")
        .select("scheduled_date")
        .eq("id", occurrence!.id)
        .single();
      const { data: unchangedOccurrenceBlock } = await admin
        .from("time_blocks")
        .select("start_at, end_at")
        .eq("id", occurrenceBlockId)
        .single();
      expect(unchangedOccurrence?.scheduled_date).toBe("2030-05-03");
      expect(unchangedOccurrenceBlock).toMatchObject({
        start_at: "2030-05-03T03:00:00+00:00",
        end_at: "2030-05-03T03:30:00+00:00",
      });

      const recurringCarryOver = await owner.client.rpc("carry_over_tasks_with_blocks_atomic", {
        p_task_ids: [recurringTaskId],
        p_new_date: "2030-05-04",
      });
      expect(recurringCarryOver.error?.message).toContain("recurring_occurrence_required");
      const { data: unchangedRecurringTask } = await admin
        .from("tasks")
        .select("planned_date, due_date")
        .eq("id", recurringTaskId)
        .single();
      const { data: stillMovedOccurrenceBlock } = await admin
        .from("time_blocks")
        .select("start_at, end_at")
        .eq("id", occurrenceBlockId)
        .single();
      expect(unchangedRecurringTask).toMatchObject({
        planned_date: "2030-05-01",
        due_date: "2030-05-01",
      });
      expect(stillMovedOccurrenceBlock).toMatchObject({
        start_at: "2030-05-03T03:00:00+00:00",
        end_at: "2030-05-03T03:30:00+00:00",
      });

      const sortedBatchIds = [crypto.randomUUID(), crypto.randomUUID()].sort();
      const firstBatchTaskId = await insertTask(owner.client, owner.id, {
        id: sortedBatchIds[0],
        title: "First carried task",
        dueDate: "2030-04-10",
        plannedDate: "2030-04-10",
      });
      const secondBatchTaskId = await insertTask(owner.client, owner.id, {
        id: sortedBatchIds[1],
        title: "Second carried task",
        dueDate: "2030-04-10",
        plannedDate: "2030-04-10",
      });
      const firstBatchBlockId = await insertBlock(owner.client, owner.id, {
        taskId: firstBatchTaskId,
        title: "First carried block",
        startAt: "2030-04-10T02:00:00.000Z",
        endAt: "2030-04-10T02:30:00.000Z",
      });
      const secondBatchBlockId = await insertBlock(owner.client, owner.id, {
        taskId: secondBatchTaskId,
        title: "Second carried block",
        startAt: "2030-04-10T03:00:00.000Z",
        endAt: "2030-04-10T03:30:00.000Z",
      });
      const { error: batchBlockerError } = await admin.from("time_blocks").insert({
        user_id: owner.id,
        task_id: null,
        title: "Unlinked batch blocker",
        start_at: "2030-04-11T03:00:00.000Z",
        end_at: "2030-04-11T03:30:00.000Z",
      });
      expect(batchBlockerError).toBeNull();

      const batchConflict = await owner.client.rpc("carry_over_tasks_with_blocks_atomic", {
        p_task_ids: [secondBatchTaskId, firstBatchTaskId],
        p_new_date: "2030-04-11",
      });
      expect(batchConflict.error?.message).toContain("time_block_overlap");
      const { data: rolledBackTasks } = await admin
        .from("tasks")
        .select("id, planned_date, due_date")
        .in("id", [firstBatchTaskId, secondBatchTaskId])
        .order("id");
      const { data: rolledBackBlocks } = await admin
        .from("time_blocks")
        .select("id, start_at, end_at, version")
        .in("id", [firstBatchBlockId, secondBatchBlockId])
        .order("id");
      expect(rolledBackTasks).toEqual([
        { id: firstBatchTaskId, planned_date: "2030-04-10", due_date: "2030-04-10" },
        { id: secondBatchTaskId, planned_date: "2030-04-10", due_date: "2030-04-10" },
      ]);
      expect(rolledBackBlocks).toEqual(
        [
          {
            id: firstBatchBlockId,
            start_at: "2030-04-10T02:00:00+00:00",
            end_at: "2030-04-10T02:30:00+00:00",
            version: 1,
          },
          {
            id: secondBatchBlockId,
            start_at: "2030-04-10T03:00:00+00:00",
            end_at: "2030-04-10T03:30:00+00:00",
            version: 1,
          },
        ].sort((a, b) => a.id.localeCompare(b.id)),
      );
    } finally {
      const userIds = [owner?.id, otherOwner?.id].filter((id): id is string => Boolean(id));
      if (userIds.length > 0) {
        await admin.from("time_blocks").delete().in("user_id", userIds);
        await admin.from("task_occurrences").delete().in("user_id", userIds);
        await admin.from("tasks").delete().in("user_id", userIds);
      }
      if (owner) await admin.auth.admin.deleteUser(owner.id);
      if (otherOwner) await admin.auth.admin.deleteUser(otherOwner.id);
    }
  });
});
