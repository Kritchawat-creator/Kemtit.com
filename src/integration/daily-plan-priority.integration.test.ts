import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";
import { signInAndApproveFixtureSession } from "@/integration/support/auth";

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

function assertLocalConfiguration() {
  expect(supabaseUrl).not.toBe("");
  expect(anonKey).not.toBe("");
  expect(serviceRoleKey).not.toBe("");
  const hostname = new URL(supabaseUrl).hostname;
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(hostname);
}

async function createFixtureUser(admin: DbClient, userIds: string[]) {
  const email = `kemtit-priority-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Could not create priority integration user");
  const userId = data.user.id;
  userIds.push(userId);
  const client = userClient();
  try {
    await signInAndApproveFixtureSession(client, admin, { email, password, userId });
  } catch (signInError) {
    await admin.auth.admin.deleteUser(userId);
    userIds.splice(userIds.indexOf(userId), 1);
    throw signInError;
  }
  return { client, userId };
}

async function insertPriorityTask(
  client: DbClient,
  userId: string,
  title: string,
  planDate: string,
) {
  const { data, error } = await client
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      due_date: planDate,
      planned_date: planDate,
      domain: "work",
      status: "planned",
      priority: "normal",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not create priority integration task");
  return data.id;
}

describe.skipIf(!integrationEnabled)("daily plan priority order local Supabase", () => {
  it("applies and undoes priority changes without changing the daily budget or notes", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const email = `kemtit-priority-${crypto.randomUUID()}@example.test`;
    const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(createError).toBeNull();
    expect(created.user).not.toBeNull();
    const userId = created.user!.id;
    const client = userClient();
    await signInAndApproveFixtureSession(client, admin, { email, password, userId });

    const planDate = "2030-05-11";
    const operationId = crypto.randomUUID();
    try {
      const { data: tasks, error: taskError } = await client
        .from("tasks")
        .insert([
          {
            user_id: userId,
            title: "Priority task A",
            due_date: planDate,
            domain: "work",
            status: "planned",
            priority: "normal",
          },
          {
            user_id: userId,
            title: "Priority task B",
            due_date: planDate,
            domain: "work",
            status: "planned",
            priority: "normal",
          },
        ])
        .select("id");
      expect(taskError).toBeNull();
      expect(tasks).toHaveLength(2);
      const [taskA, taskB] = tasks!;

      const { error: planError } = await client.from("daily_plans").insert({
        user_id: userId,
        plan_date: planDate,
        available_minutes: 375,
        top_priorities: [taskA.id],
        notes: "Keep these notes unchanged",
      });
      expect(planError).toBeNull();
      const { error: orderError } = await admin.from("daily_plan_priority_orders").insert({
        user_id: userId,
        plan_date: planDate,
        priority_task_ids: [taskA.id],
        version: 0,
      });
      expect(orderError).toBeNull();

      const nullPriority = await client.rpc("set_daily_plan_priorities_atomic", {
        p_operation_id: crypto.randomUUID(),
        p_plan_date: planDate,
        p_priority_task_ids: [null] as never,
        p_expected_version: 0,
      });
      expect(nullPriority.error?.code).toBe("22023");

      const applied = await client.rpc("set_daily_plan_priorities_atomic", {
        p_operation_id: operationId,
        p_plan_date: planDate,
        p_priority_task_ids: [taskB.id, taskA.id],
        p_expected_version: 0,
      });
      expect(applied.error).toBeNull();
      expect(applied.data).toMatchObject({
        status: "applied",
        priorityTaskIds: [taskB.id, taskA.id],
        version: 1,
      });

      const { data: planAfterApply, error: readAfterApplyError } = await admin
        .from("daily_plans")
        .select("available_minutes, notes, top_priorities")
        .eq("user_id", userId)
        .eq("plan_date", planDate)
        .single();
      expect(readAfterApplyError).toBeNull();
      expect(planAfterApply).toEqual({
        available_minutes: 375,
        notes: "Keep these notes unchanged",
        top_priorities: [taskA.id],
      });

      const undone = await client.rpc("undo_daily_plan_priorities_atomic", {
        p_operation_id: operationId,
      });
      expect(undone.error).toBeNull();
      expect(undone.data).toMatchObject({
        status: "applied",
        priorityTaskIds: [taskA.id],
        version: 2,
        undone: true,
      });

      const retriedApply = await client.rpc("set_daily_plan_priorities_atomic", {
        p_operation_id: operationId,
        p_plan_date: planDate,
        p_priority_task_ids: [taskB.id, taskA.id],
        p_expected_version: 0,
      });
      expect(retriedApply.error).toBeNull();
      expect(retriedApply.data).toMatchObject({
        status: "applied",
        priorityTaskIds: [taskA.id],
        version: 2,
        undone: true,
      });

      const { data: planAfterUndo, error: readAfterUndoError } = await admin
        .from("daily_plans")
        .select("available_minutes, notes, top_priorities")
        .eq("user_id", userId)
        .eq("plan_date", planDate)
        .single();
      expect(readAfterUndoError).toBeNull();
      expect(planAfterUndo).toEqual(planAfterApply);
    } finally {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("keeps priority orders owner-scoped and rejects anonymous or foreign-task writes", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];
    const taskIds: string[] = [];
    const planDate = "2030-05-12";

    try {
      const owner = await createFixtureUser(admin, userIds);
      const other = await createFixtureUser(admin, userIds);
      const ownerTaskId = await insertPriorityTask(
        owner.client,
        owner.userId,
        "Owner priority",
        planDate,
      );
      const otherTaskId = await insertPriorityTask(
        other.client,
        other.userId,
        "Other priority",
        planDate,
      );
      taskIds.push(ownerTaskId, otherTaskId);

      const { error: ownerOrderError } = await admin.from("daily_plan_priority_orders").insert({
        user_id: owner.userId,
        plan_date: planDate,
        priority_task_ids: [ownerTaskId],
        version: 0,
      });
      expect(ownerOrderError).toBeNull();

      const anonymousWrite = await userClient().rpc("set_daily_plan_priorities_atomic", {
        p_operation_id: crypto.randomUUID(),
        p_plan_date: planDate,
        p_priority_task_ids: [ownerTaskId],
        p_expected_version: 0,
      });
      expect(anonymousWrite.error?.code).toBe("42501");

      const hiddenOwnerOrder = await other.client
        .from("daily_plan_priority_orders")
        .select("priority_task_ids, version")
        .eq("plan_date", planDate)
        .maybeSingle();
      expect(hiddenOwnerOrder.error).toBeNull();
      expect(hiddenOwnerOrder.data).toBeNull();

      const foreignTaskWrite = await other.client.rpc("set_daily_plan_priorities_atomic", {
        p_operation_id: crypto.randomUUID(),
        p_plan_date: planDate,
        p_priority_task_ids: [ownerTaskId],
        p_expected_version: 0,
      });
      expect(foreignTaskWrite.error).toBeNull();
      expect(foreignTaskWrite.data).toMatchObject({ status: "conflict", reason: "stale_task" });

      const isolatedWrite = await other.client.rpc("set_daily_plan_priorities_atomic", {
        p_operation_id: crypto.randomUUID(),
        p_plan_date: planDate,
        p_priority_task_ids: [otherTaskId],
        p_expected_version: 0,
      });
      expect(isolatedWrite.error).toBeNull();
      expect(isolatedWrite.data).toMatchObject({
        status: "applied",
        priorityTaskIds: [otherTaskId],
        version: 1,
      });

      const { data: orders, error: ordersError } = await admin
        .from("daily_plan_priority_orders")
        .select("user_id, priority_task_ids, version")
        .in("user_id", [owner.userId, other.userId])
        .eq("plan_date", planDate)
        .order("user_id");
      expect(ordersError).toBeNull();
      expect(orders).toEqual([
        { user_id: owner.userId, priority_task_ids: [ownerTaskId], version: 0 },
        { user_id: other.userId, priority_task_ids: [otherTaskId], version: 1 },
      ]);
    } finally {
      if (taskIds.length) await admin.from("tasks").delete().in("id", taskIds);
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("serializes concurrent compare-and-swap updates and rejects undo after a later change", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];
    const taskIds: string[] = [];
    const planDate = "2030-05-13";

    try {
      const owner = await createFixtureUser(admin, userIds);
      const taskAId = await insertPriorityTask(
        owner.client,
        owner.userId,
        "Concurrent priority A",
        planDate,
      );
      const taskBId = await insertPriorityTask(
        owner.client,
        owner.userId,
        "Concurrent priority B",
        planDate,
      );
      taskIds.push(taskAId, taskBId);
      const operationA = crypto.randomUUID();
      const operationB = crypto.randomUUID();

      const competing = await Promise.all([
        owner.client.rpc("set_daily_plan_priorities_atomic", {
          p_operation_id: operationA,
          p_plan_date: planDate,
          p_priority_task_ids: [taskAId],
          p_expected_version: 0,
        }),
        owner.client.rpc("set_daily_plan_priorities_atomic", {
          p_operation_id: operationB,
          p_plan_date: planDate,
          p_priority_task_ids: [taskBId],
          p_expected_version: 0,
        }),
      ]);
      expect(competing.map((result) => result.error)).toEqual([null, null]);
      const responses = competing.map(
        (result) =>
          result.data as {
            status: "applied" | "conflict";
            reason?: string;
            operationId: string;
            priorityTaskIds?: string[];
            version?: number;
          },
      );
      expect(responses.map((result) => result.status).sort()).toEqual(["applied", "conflict"]);
      const applied = responses.find((result) => result.status === "applied")!;
      const conflicted = responses.find((result) => result.status === "conflict")!;
      expect(applied).toMatchObject({ version: 1 });
      expect(conflicted).toMatchObject({ reason: "version_conflict", version: 1 });

      const laterOperationId = crypto.randomUUID();
      const laterChange = await owner.client.rpc("set_daily_plan_priorities_atomic", {
        p_operation_id: laterOperationId,
        p_plan_date: planDate,
        p_priority_task_ids: [taskAId, taskBId],
        p_expected_version: 1,
      });
      expect(laterChange.error).toBeNull();
      expect(laterChange.data).toMatchObject({ status: "applied", version: 2 });

      const staleUndo = await owner.client.rpc("undo_daily_plan_priorities_atomic", {
        p_operation_id: applied.operationId,
      });
      expect(staleUndo.error).toBeNull();
      expect(staleUndo.data).toMatchObject({
        status: "conflict",
        reason: "version_conflict",
        operationId: applied.operationId,
        priorityTaskIds: [taskAId, taskBId],
        version: 2,
      });

      const { data: order, error: orderError } = await admin
        .from("daily_plan_priority_orders")
        .select("priority_task_ids, version")
        .eq("user_id", owner.userId)
        .eq("plan_date", planDate)
        .single();
      expect(orderError).toBeNull();
      expect(order).toEqual({ priority_task_ids: [taskAId, taskBId], version: 2 });
    } finally {
      if (taskIds.length) await admin.from("tasks").delete().in("id", taskIds);
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });
});
