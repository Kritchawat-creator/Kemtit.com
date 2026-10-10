import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { signInAndApproveFixtureSession } from "@/integration/support/auth";
import type { Database, Json } from "@/types/database";

type DbClient = SupabaseClient<Database>;
type BlockState = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  version: number;
  status: string;
  is_locked: boolean;
};

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
  expect(["127.0.0.1", "localhost", "[::1]"], "integration writes must target local Supabase").toContain(
    new URL(supabaseUrl).hostname,
  );
}

async function createFixtureUser(admin: DbClient, userIds: string[]) {
  const email = `kemtit-schedule-conflict-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("Could not create schedule-conflict fixture user");
  userIds.push(data.user.id);

  const client = userClient();
  try {
    await signInAndApproveFixtureSession(client, admin, { email, password, userId: data.user.id });
  } catch (signInError) {
    await admin.auth.admin.deleteUser(data.user.id);
    userIds.splice(userIds.indexOf(data.user.id), 1);
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
      due_date: "2030-05-10",
      planned_date: "2030-05-10",
      domain: "work",
      status: "planned",
      priority: "normal",
    })
    .select("id,updated_at")
    .single();
  if (error || !data) throw error ?? new Error("Could not create schedule-conflict fixture task");
  return data;
}

async function insertEvent(
  client: DbClient,
  userId: string,
  input: { title: string; eventDate?: string; startTime: string; endTime: string; blocksTime?: boolean },
) {
  const { data, error } = await client
    .from("calendar_events")
    .insert({
      user_id: userId,
      title: input.title,
      event_date: input.eventDate ?? "2030-05-10",
      all_day: false,
      start_time: input.startTime,
      end_time: input.endTime,
      blocks_time: input.blocksTime ?? true,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not create schedule-conflict fixture event");
  return data.id;
}

async function readBlock(admin: DbClient, blockId: string): Promise<BlockState> {
  const { data, error } = await admin
    .from("time_blocks")
    .select("id,title,start_at,end_at,version,status,is_locked")
    .eq("id", blockId)
    .single();
  expect(error).toBeNull();
  return data as BlockState;
}

describe.skipIf(!integrationEnabled)("persistent scheduling conflicts on local Supabase", () => {
  it("rejects conflicting legacy create, update, restore, and event writes while allowing adjacency and nonblocking events", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const eventId = await insertEvent(owner.client, owner.id, {
        title: "Blocking event",
        startTime: "09:00",
        endTime: "10:00",
      });

      const rejectedCreate = await owner.client.rpc("create_time_block_atomic", {
        p_title: "Must not create",
        p_start_at: "2030-05-10T02:30:00.000Z",
        p_end_at: "2030-05-10T03:30:00.000Z",
        p_source: "manual",
      });
      expect(rejectedCreate.error?.code).toBe("23P01");
      expect(rejectedCreate.error?.message).toContain("calendar_event_conflict");

      const adjacent = await owner.client.rpc("create_time_block_atomic", {
        p_title: "Adjacent block",
        p_start_at: "2030-05-10T03:00:00.000Z",
        p_end_at: "2030-05-10T04:00:00.000Z",
        p_source: "manual",
      });
      expect(adjacent.error).toBeNull();
      const blockId = adjacent.data!;
      const beforeUpdate = await readBlock(admin, blockId);

      const rejectedUpdate = await owner.client.rpc("update_time_block_atomic", {
        p_id: blockId,
        p_title: "Changed title must roll back",
        p_start_at: "2030-05-10T02:30:00.000Z",
        p_end_at: "2030-05-10T03:30:00.000Z",
        p_expected_version: beforeUpdate.version,
      });
      expect(rejectedUpdate.error?.code).toBe("23P01");
      expect(rejectedUpdate.error?.message).toContain("calendar_event_conflict");
      expect(await readBlock(admin, blockId)).toEqual(beforeUpdate);

      const cancelled = await owner.client
        .from("time_blocks")
        .insert({
          user_id: owner.id,
          title: "Cancelled before restore",
          start_at: "2030-05-10T02:00:00.000Z",
          end_at: "2030-05-10T02:30:00.000Z",
          source: "manual",
          status: "cancelled",
        })
        .select("id")
        .single();
      expect(cancelled.error).toBeNull();
      const cancelledBeforeRestore = await readBlock(admin, cancelled.data!.id);
      const rejectedRestore = await owner.client.rpc("set_time_block_status_atomic", {
        p_id: cancelled.data!.id,
        p_expected_version: cancelledBeforeRestore.version,
        p_status: "active",
      });
      expect(rejectedRestore.error?.code).toBe("23P01");
      expect(rejectedRestore.error?.message).toContain("calendar_event_conflict");
      expect(await readBlock(admin, cancelled.data!.id)).toEqual(cancelledBeforeRestore);

      await insertEvent(owner.client, owner.id, {
        title: "Nonblocking event",
        startTime: "11:00",
        endTime: "12:00",
        blocksTime: false,
      });
      const overlappingNonblockingEvent = await owner.client.rpc("create_time_block_atomic", {
        p_title: "Permitted beside nonblocking event",
        p_start_at: "2030-05-10T04:00:00.000Z",
        p_end_at: "2030-05-10T05:00:00.000Z",
        p_source: "manual",
      });
      expect(overlappingNonblockingEvent.error).toBeNull();

      const blockForEventConflict = await owner.client.rpc("create_time_block_atomic", {
        p_title: "Existing block",
        p_start_at: "2030-05-10T05:00:00.000Z",
        p_end_at: "2030-05-10T06:00:00.000Z",
        p_source: "manual",
      });
      expect(blockForEventConflict.error).toBeNull();
      const eventAgainstBlock = await owner.client
        .from("calendar_events")
        .insert({
          user_id: owner.id,
          title: "Event must not overlap a block",
          event_date: "2030-05-10",
          all_day: false,
          start_time: "12:30",
          end_time: "13:30",
          blocks_time: true,
        })
        .select("id")
        .maybeSingle();
      expect(eventAgainstBlock.error?.code).toBe("23P01");
      expect(eventAgainstBlock.error?.message).toContain("calendar_event_conflict");
      expect(eventAgainstBlock.data).toBeNull();
      const absentEvent = await admin
        .from("calendar_events")
        .select("id")
        .eq("user_id", owner.id)
        .eq("title", "Event must not overlap a block")
        .maybeSingle();
      expect(absentEvent.data).toBeNull();

      const allDayEvent = await owner.client
        .from("calendar_events")
        .insert({
          user_id: owner.id,
          title: "All-day blocking event",
          event_date: "2030-05-11",
          all_day: true,
          start_time: null,
          end_time: null,
          blocks_time: true,
        })
        .select("id")
        .single();
      expect(allDayEvent.error).toBeNull();
      const allDayConflict = await owner.client.rpc("create_time_block_atomic", {
        p_title: "Block during all-day event",
        p_start_at: "2030-05-11T02:00:00.000Z",
        p_end_at: "2030-05-11T03:00:00.000Z",
        p_source: "manual",
      });
      expect(allDayConflict.error?.code).toBe("23P01");
      expect(allDayConflict.error?.message).toContain("calendar_event_conflict");
      expect(eventId).toBeTruthy();
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("keeps locked, stale, and inactive mutations distinct without changing the block", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const blockInsert = await owner.client
        .from("time_blocks")
        .insert({
          user_id: owner.id,
          title: "Locked fixture",
          start_at: "2030-05-10T02:00:00.000Z",
          end_at: "2030-05-10T03:00:00.000Z",
          source: "manual",
          is_locked: true,
        })
        .select("id")
        .single();
      expect(blockInsert.error).toBeNull();
      const blockId = blockInsert.data!.id;
      const lockedBefore = await readBlock(admin, blockId);

      const locked = await owner.client.rpc("update_time_block_atomic_result", {
        p_id: blockId,
        p_title: "Must remain locked",
        p_start_at: "2030-05-10T04:00:00.000Z",
        p_end_at: "2030-05-10T05:00:00.000Z",
        p_expected_version: lockedBefore.version,
      });
      expect(locked.error).toBeNull();
      expect(locked.data).toEqual({ status: "locked" });
      expect(await readBlock(admin, blockId)).toEqual(lockedBefore);

      const bumped = await owner.client
        .from("time_blocks")
        .update({ is_locked: false, version: lockedBefore.version + 1 })
        .eq("id", blockId)
        .select("id")
        .single();
      expect(bumped.error).toBeNull();
      const stale = await owner.client.rpc("update_time_block_atomic_result", {
        p_id: blockId,
        p_title: "Stale edit",
        p_start_at: "2030-05-10T04:00:00.000Z",
        p_end_at: "2030-05-10T05:00:00.000Z",
        p_expected_version: lockedBefore.version,
      });
      expect(stale.error).toBeNull();
      expect(stale.data).toEqual({ status: "stale" });

      const current = await readBlock(admin, blockId);
      const cancelled = await owner.client.rpc("set_time_block_status_atomic", {
        p_id: blockId,
        p_expected_version: current.version,
        p_status: "cancelled",
      });
      expect(cancelled.error).toBeNull();
      const inactiveBefore = await readBlock(admin, blockId);
      const inactive = await owner.client.rpc("update_time_block_atomic_result", {
        p_id: blockId,
        p_title: "Inactive edit",
        p_start_at: "2030-05-10T04:00:00.000Z",
        p_end_at: "2030-05-10T05:00:00.000Z",
        p_expected_version: inactiveBefore.version,
      });
      expect(inactive.error).toBeNull();
      expect(inactive.data).toEqual({ status: "inactive" });
      expect(await readBlock(admin, blockId)).toEqual(inactiveBefore);
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("returns only the owner and selected date's current Rescue Undo candidate", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const otherOwner = await createFixtureUser(admin, userIds);
      const task = await insertTask(owner.client, owner.id, "Rescue readback scope");
      const blockId = await createActiveBlock(
        owner.client,
        owner.id,
        "Rescue readback original slot",
        "2030-05-10T10:00:00.000Z",
        "2030-05-10T11:00:00.000Z",
      );
      const firstOperationId = crypto.randomUUID();
      const targetDate = "2030-05-11";
      const firstApply = await owner.client.rpc("apply_rescue_operation", {
        p_operation_id: firstOperationId,
        p_target_date: targetDate,
        p_plan: {
          proposalVersion: "rescue-readback-positive",
          items: [{
            taskId: task.id,
            title: "Rescue readback scope",
            action: "move",
            targetDate,
            startAt: "2030-05-11T04:00:00.000Z",
            endAt: "2030-05-11T05:00:00.000Z",
            blockId,
            expectedBlockVersion: 1,
            expectedTaskUpdatedAt: task.updated_at,
          }],
        } as Json,
      });
      expect(firstApply.error).toBeNull();

      const eligibleUndo = await owner.client.rpc("latest_undoable_rescue_operation", {
        p_target_date: targetDate,
      });
      expect(eligibleUndo.error).toBeNull();
      expect(eligibleUndo.data).toEqual([{ operation_id: firstOperationId, target_date: targetDate }]);

      const wrongDate = await owner.client.rpc("latest_undoable_rescue_operation", {
        p_target_date: "2030-05-12",
      });
      expect(wrongDate.error).toBeNull();
      expect(wrongDate.data).toEqual([]);

      const wrongOwner = await otherOwner.client.rpc("latest_undoable_rescue_operation", {
        p_target_date: targetDate,
      });
      expect(wrongOwner.error).toBeNull();
      expect(wrongOwner.data).toEqual([]);

      const undo = await owner.client.rpc("undo_rescue_operation", {
        p_operation_id: eligibleUndo.data![0].operation_id,
      });
      expect(undo.error).toBeNull();

      const taskAfterUndo = await owner.client
        .from("tasks")
        .select("updated_at")
        .eq("id", task.id)
        .single();
      expect(taskAfterUndo.error).toBeNull();
      const blockAfterUndo = await readBlock(admin, blockId);
      const staleOperationId = crypto.randomUUID();
      const staleApply = await owner.client.rpc("apply_rescue_operation", {
        p_operation_id: staleOperationId,
        p_target_date: targetDate,
        p_plan: {
          proposalVersion: "rescue-readback-stale",
          items: [{
            taskId: task.id,
            title: "Rescue readback scope",
            action: "move",
            targetDate,
            startAt: "2030-05-11T04:00:00.000Z",
            endAt: "2030-05-11T05:00:00.000Z",
            blockId,
            expectedBlockVersion: blockAfterUndo.version,
            expectedTaskUpdatedAt: taskAfterUndo.data!.updated_at,
          }],
        } as Json,
      });
      expect(staleApply.error).toBeNull();

      const changedTask = await owner.client
        .from("tasks")
        .update({ title: "Changed after Rescue" })
        .eq("id", task.id)
        .select("updated_at")
        .single();
      expect(changedTask.error).toBeNull();
      expect(changedTask.data!.updated_at).not.toBe(taskAfterUndo.data!.updated_at);

      const staleSnapshot = await owner.client.rpc("latest_undoable_rescue_operation", {
        p_target_date: targetDate,
      });
      expect(staleSnapshot.error).toBeNull();
      expect(staleSnapshot.data).toEqual([]);
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("rolls back a conflicting Rescue apply and refuses Undo when its original slot is now blocked", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const applyTask = await insertTask(owner.client, owner.id, "Rescue apply conflict");
      const applyBlockId = await createActiveBlock(owner.client, owner.id, "Original apply slot", "2030-05-10T02:00:00.000Z", "2030-05-10T03:00:00.000Z");
      await insertEvent(owner.client, owner.id, {
        title: "Apply target conflict",
        eventDate: "2030-05-11",
        startTime: "14:00",
        endTime: "15:00",
      });

      const rejectedApply = await owner.client.rpc("apply_rescue_operation", {
        p_operation_id: crypto.randomUUID(),
        p_target_date: "2030-05-11",
        p_plan: {
          proposalVersion: "schedule-conflict-test",
          items: [{
            taskId: applyTask.id,
            title: "Rescue apply conflict",
            action: "move",
            targetDate: "2030-05-11",
            startAt: "2030-05-11T07:00:00.000Z",
            endAt: "2030-05-11T08:00:00.000Z",
            blockId: applyBlockId,
            expectedBlockVersion: 1,
            expectedTaskUpdatedAt: applyTask.updated_at,
          }],
        } as Json,
      });
      expect(rejectedApply.error?.code).toBe("23P01");
      expect(rejectedApply.error?.message).toContain("calendar_event_conflict");
      const applyTaskAfter = await admin.from("tasks").select("planned_date,due_date").eq("id", applyTask.id).single();
      expect(applyTaskAfter.data).toEqual({ planned_date: "2030-05-10", due_date: "2030-05-10" });
      expect(await readBlock(admin, applyBlockId)).toMatchObject({
        title: "Original apply slot",
        start_at: "2030-05-10T02:00:00+00:00",
        end_at: "2030-05-10T03:00:00+00:00",
        version: 1,
      });

      const undoTask = await insertTask(owner.client, owner.id, "Rescue undo conflict");
      const undoBlockId = await createActiveBlock(owner.client, owner.id, "Original undo slot", "2030-05-10T10:00:00.000Z", "2030-05-10T11:00:00.000Z");
      const operationId = crypto.randomUUID();
      const applied = await owner.client.rpc("apply_rescue_operation", {
        p_operation_id: operationId,
        p_target_date: "2030-05-11",
        p_plan: {
          proposalVersion: "schedule-undo-conflict-test",
          items: [{
            taskId: undoTask.id,
            title: "Rescue undo conflict",
            action: "move",
            targetDate: "2030-05-11",
            startAt: "2030-05-11T04:00:00.000Z",
            endAt: "2030-05-11T05:00:00.000Z",
            blockId: undoBlockId,
            expectedBlockVersion: 1,
            expectedTaskUpdatedAt: undoTask.updated_at,
          }],
        } as Json,
      });
      expect(applied.error).toBeNull();
      const afterApply = await readBlock(admin, undoBlockId);
      await insertEvent(owner.client, owner.id, { title: "New conflict at original slot", startTime: "17:00", endTime: "18:00" });

      const eligibleUndo = await owner.client.rpc("latest_undoable_rescue_operation", {
        p_target_date: "2030-05-11",
      });
      expect(eligibleUndo.error).toBeNull();
      expect(eligibleUndo.data).toEqual([]);

      const rejectedUndo = await owner.client.rpc("undo_rescue_operation", { p_operation_id: operationId });
      expect(rejectedUndo.error?.code).toBe("23P01");
      expect(rejectedUndo.error?.message).toContain("calendar_event_conflict");
      expect(await readBlock(admin, undoBlockId)).toEqual(afterApply);
      const operation = await admin
        .from("rescue_operations")
        .select("status")
        .eq("id", operationId)
        .single();
      expect(operation.data?.status).toBe("applied");
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });
});

async function createActiveBlock(client: DbClient, userId: string, title: string, startAt: string, endAt: string) {
  const { data, error } = await client
    .from("time_blocks")
    .insert({ user_id: userId, title, start_at: startAt, end_at: endAt, source: "manual" })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not create schedule-conflict fixture block");
  return data.id;
}
