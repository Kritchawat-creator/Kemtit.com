import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { signInAndApproveFixtureSession } from "@/integration/support/auth";
import type { Database, Json } from "@/types/database";

type DbClient = SupabaseClient<Database>;
type BlockSnapshot = { id: string; version: number; startAt: string; endAt: string };
type ScheduleInput = {
  operationId: string;
  taskId: string;
  taskUpdatedAt: string;
  occurrenceDate?: string | null;
  occurrenceUpdatedAt?: string | null;
  targetDate: string;
  startAt?: string | null;
  endAt?: string | null;
  blockId?: string | null;
  blocks?: BlockSnapshot[];
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
  const hostname = new URL(supabaseUrl).hostname;
  expect(
    ["127.0.0.1", "localhost", "[::1]"],
    "integration writes must target local Supabase",
  ).toContain(hostname);
}

async function createFixtureUser(admin: DbClient, userIds: string[]) {
  const email = `kemtit-task-card-schedule-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Could not create scheduling integration user");
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

async function insertTask(
  client: DbClient,
  userId: string,
  input: {
    title: string;
    dueDate: string;
    plannedDate: string;
    deadline?: string | null;
    recurrenceRule?: string | null;
    status?: "inbox" | "planned";
  },
) {
  const { data, error } = await client
    .from("tasks")
    .insert({
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
    .select("id,updated_at")
    .single();
  if (error || !data) throw error ?? new Error("Could not create scheduling integration task");
  return data;
}

async function insertBlock(
  client: DbClient,
  userId: string,
  input: { title: string; startAt: string; endAt: string; taskId?: string | null },
) {
  const { data, error } = await client
    .from("time_blocks")
    .insert({
      user_id: userId,
      task_id: input.taskId ?? null,
      title: input.title,
      start_at: input.startAt,
      end_at: input.endAt,
      source: "manual",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not create scheduling integration block");
  return data.id;
}

async function schedule(client: DbClient, input: ScheduleInput) {
  return client.rpc("schedule_task_card_atomic", {
    p_operation_id: input.operationId,
    p_task_id: input.taskId,
    p_expected_task_updated_at: input.taskUpdatedAt,
    p_occurrence_date: input.occurrenceDate ?? null,
    p_expected_occurrence_updated_at: input.occurrenceUpdatedAt ?? null,
    p_target_date: input.targetDate,
    p_start_at: input.startAt ?? null,
    p_end_at: input.endAt ?? null,
    p_block_id: input.blockId ?? null,
    p_expected_blocks: (input.blocks ?? []) as Json,
  });
}

async function readTask(admin: DbClient, taskId: string) {
  const { data, error } = await admin
    .from("tasks")
    .select("id,planned_date,due_date,deadline,recurrence_rule,status,completed_at,updated_at")
    .eq("id", taskId)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function readBlock(admin: DbClient, blockId: string) {
  const { data, error } = await admin
    .from("time_blocks")
    .select("id,task_id,task_occurrence_id,start_at,end_at,version,status")
    .eq("id", blockId)
    .single();
  expect(error).toBeNull();
  return data!;
}

function snapshot(block: Awaited<ReturnType<typeof readBlock>>): BlockSnapshot {
  return {
    id: block.id,
    version: block.version,
    startAt: block.start_at,
    endAt: block.end_at,
  };
}

describe.skipIf(!integrationEnabled)("task-card scheduling atomic RPC on local Supabase", () => {
  it("promotes an inbox task to planned and restores its status on Undo", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const task = await insertTask(owner.client, owner.id, {
        title: "Inbox schedule fixture",
        dueDate: "2030-05-01",
        plannedDate: "2030-05-01",
        status: "inbox",
      });
      const request: ScheduleInput = {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: task.updated_at,
        targetDate: "2030-05-02",
      };

      const scheduled = await schedule(owner.client, request);
      expect(scheduled.error).toBeNull();
      expect(await readTask(admin, task.id)).toMatchObject({
        status: "planned",
        planned_date: "2030-05-02",
        due_date: "2030-05-02",
      });

      const undone = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: request.operationId,
      });
      expect(undone.error).toBeNull();
      expect(await readTask(admin, task.id)).toMatchObject({
        status: "inbox",
        planned_date: "2030-05-01",
        due_date: "2030-05-01",
      });
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("rejects a completed task and leaves its completion unchanged", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const task = await insertTask(owner.client, owner.id, {
        title: "Completed schedule fixture",
        dueDate: "2030-05-03",
        plannedDate: "2030-05-03",
      });
      const completedAt = "2030-05-03T09:00:00.000Z";
      const completion = await owner.client
        .from("tasks")
        .update({ status: "completed", completed_at: completedAt })
        .eq("id", task.id)
        .select("updated_at")
        .single();
      expect(completion.error).toBeNull();

      const rejected = await schedule(owner.client, {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: completion.data!.updated_at,
        targetDate: "2030-05-04",
      });
      expect(rejected.error?.message).toContain("task_not_schedulable");
      const unchangedTask = await readTask(admin, task.id);
      expect(unchangedTask).toMatchObject({
        status: "completed",
        planned_date: "2030-05-03",
        due_date: "2030-05-03",
      });
      expect(Date.parse(unchangedTask.completed_at ?? "")).toBe(Date.parse(completedAt));
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("rejects recurring occurrences with completion or skip timestamps despite planned status", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const task = await insertTask(owner.client, owner.id, {
        title: "Inconsistent recurring occurrence fixture",
        dueDate: "2030-06-10",
        plannedDate: "2030-06-10",
        recurrenceRule: "FREQ=DAILY",
      });
      const inconsistentOccurrences = [
        {
          occurrenceDate: "2030-06-11",
          completedAt: "2030-06-11T09:00:00.000Z",
          skippedAt: null,
        },
        {
          occurrenceDate: "2030-06-12",
          completedAt: null,
          skippedAt: "2030-06-12T09:00:00.000Z",
        },
      ];

      for (const occurrence of inconsistentOccurrences) {
        const inserted = await owner.client
          .from("task_occurrences")
          .insert({
            task_id: task.id,
            user_id: owner.id,
            occurrence_date: occurrence.occurrenceDate,
            scheduled_date: occurrence.occurrenceDate,
            status: "planned",
            completed_at: occurrence.completedAt,
            skipped_at: occurrence.skippedAt,
          })
          .select("updated_at")
          .single();
        expect(inserted.error).toBeNull();

        const rejected = await schedule(owner.client, {
          operationId: crypto.randomUUID(),
          taskId: task.id,
          taskUpdatedAt: task.updated_at,
          occurrenceDate: occurrence.occurrenceDate,
          occurrenceUpdatedAt: inserted.data!.updated_at,
          targetDate: occurrence.occurrenceDate,
        });
        expect(rejected.error?.message).toContain("occurrence_not_schedulable");
      }

      const { data: occurrences, error } = await admin
        .from("task_occurrences")
        .select("occurrence_date,status,completed_at,skipped_at")
        .eq("task_id", task.id)
        .order("occurrence_date");
      expect(error).toBeNull();
      expect(occurrences).toMatchObject([
        {
          occurrence_date: "2030-06-11",
          status: "planned",
          completed_at: "2030-06-11T09:00:00+00:00",
          skipped_at: null,
        },
        {
          occurrence_date: "2030-06-12",
          status: "planned",
          completed_at: null,
          skipped_at: "2030-06-12T09:00:00+00:00",
        },
      ]);
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("rejects timed schedules that overlap timed or all-day blocking calendar events", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const timedEvent = await owner.client.from("calendar_events").insert({
        user_id: owner.id,
        title: "Timed blocking event fixture",
        event_date: "2030-06-01",
        start_time: "10:00",
        end_time: "11:00",
        all_day: false,
        blocks_time: true,
        data_origin: "USER",
      });
      expect(timedEvent.error).toBeNull();

      const timedTask = await insertTask(owner.client, owner.id, {
        title: "Timed event conflict fixture",
        dueDate: "2030-06-01",
        plannedDate: "2030-06-01",
        deadline: "2030-06-30",
      });
      const timedConflict = await schedule(owner.client, {
        operationId: crypto.randomUUID(),
        taskId: timedTask.id,
        taskUpdatedAt: timedTask.updated_at,
        targetDate: "2030-06-01",
        startAt: "2030-06-01T03:15:00.000Z",
        endAt: "2030-06-01T03:45:00.000Z",
      });
      expect(timedConflict.error?.message).toContain("calendar_event_conflict");
      expect(await readTask(admin, timedTask.id)).toMatchObject({
        planned_date: "2030-06-01",
        due_date: "2030-06-01",
      });

      const allDayEvent = await owner.client.from("calendar_events").insert({
        user_id: owner.id,
        title: "All-day blocking event fixture",
        event_date: "2030-06-02",
        all_day: true,
        blocks_time: true,
        data_origin: "USER",
      });
      expect(allDayEvent.error).toBeNull();

      const allDayTask = await insertTask(owner.client, owner.id, {
        title: "All-day event conflict fixture",
        dueDate: "2030-06-02",
        plannedDate: "2030-06-02",
        deadline: "2030-06-30",
      });
      const allDayConflict = await schedule(owner.client, {
        operationId: crypto.randomUUID(),
        taskId: allDayTask.id,
        taskUpdatedAt: allDayTask.updated_at,
        targetDate: "2030-06-02",
        startAt: "2030-06-02T02:00:00.000Z",
        endAt: "2030-06-02T02:30:00.000Z",
      });
      expect(allDayConflict.error?.message).toContain("calendar_event_conflict");
      expect(await readTask(admin, allDayTask.id)).toMatchObject({
        planned_date: "2030-06-02",
        due_date: "2030-06-02",
      });

      const overnightTask = await insertTask(owner.client, owner.id, {
        title: "Overnight schedule boundary fixture",
        dueDate: "2030-06-03",
        plannedDate: "2030-06-03",
        deadline: "2030-06-30",
      });
      const overnightRejected = await schedule(owner.client, {
        operationId: crypto.randomUUID(),
        taskId: overnightTask.id,
        taskUpdatedAt: overnightTask.updated_at,
        targetDate: "2030-06-03",
        startAt: "2030-06-03T16:00:00.000Z",
        endAt: "2030-06-03T17:00:00.000Z",
      });
      expect(overnightRejected.error?.message).toContain("invalid_input");
      expect(await readTask(admin, overnightTask.id)).toMatchObject({
        planned_date: "2030-06-03",
        due_date: "2030-06-03",
      });

      const { data: blocks, error: blockError } = await admin
        .from("time_blocks")
        .select("id")
        .in("task_id", [timedTask.id, allDayTask.id, overnightTask.id]);
      expect(blockError).toBeNull();
      expect(blocks).toEqual([]);
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("blocks Undo when a new all-day event covers the schedule's original interval", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const task = await insertTask(owner.client, owner.id, {
        title: "Calendar event Undo conflict fixture",
        dueDate: "2030-06-05",
        plannedDate: "2030-06-05",
        deadline: "2030-06-30",
      });
      const created = await schedule(owner.client, {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: task.updated_at,
        targetDate: "2030-06-05",
        startAt: "2030-06-05T03:00:00.000Z",
        endAt: "2030-06-05T03:30:00.000Z",
      });
      expect(created.error).toBeNull();
      const blockId = (created.data as { blockIds: string[] }).blockIds[0];

      const movedTaskBefore = await readTask(admin, task.id);
      const movedBlockBefore = await readBlock(admin, blockId);
      const move = await schedule(owner.client, {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: movedTaskBefore.updated_at,
        targetDate: "2030-06-06",
        blocks: [snapshot(movedBlockBefore)],
      });
      expect(move.error).toBeNull();

      const allDayEvent = await owner.client.from("calendar_events").insert({
        user_id: owner.id,
        title: "New all-day event covering old schedule",
        event_date: "2030-06-05",
        all_day: true,
        blocks_time: true,
        data_origin: "USER",
      });
      expect(allDayEvent.error).toBeNull();

      const undo = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: (move.data as { operationId: string }).operationId,
      });
      expect(undo.error?.message).toContain("undo_conflict");
      expect(await readTask(admin, task.id)).toMatchObject({
        planned_date: "2030-06-06",
        due_date: "2030-06-06",
      });
      expect(await readBlock(admin, blockId)).toMatchObject({
        start_at: "2030-06-06T03:00:00+00:00",
        end_at: "2030-06-06T03:30:00+00:00",
      });
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("creates, moves, resizes, retries, and safely undoes nonrecurring schedules", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const other = await createFixtureUser(admin, userIds);
      const task = await insertTask(owner.client, owner.id, {
        title: "Nonrecurring schedule fixture",
        dueDate: "2030-04-01",
        plannedDate: "2030-04-01",
        deadline: "2030-04-07",
      });

      const dateOnlyRequest: ScheduleInput = {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: task.updated_at,
        targetDate: "2030-04-02",
      };
      const dateOnly = await schedule(owner.client, dateOnlyRequest);
      expect(dateOnly.error).toBeNull();
      expect(dateOnly.data).toMatchObject({
        operationId: dateOnlyRequest.operationId,
        taskId: task.id,
        targetDate: "2030-04-02",
        blockIds: [],
        canUndo: true,
      });
      const firstDateOnlyState = await readTask(admin, task.id);
      expect(firstDateOnlyState).toMatchObject({
        planned_date: "2030-04-02",
        due_date: "2030-04-02",
        deadline: "2030-04-07",
      });

      const dateOnlyReplay = await schedule(owner.client, dateOnlyRequest);
      expect(dateOnlyReplay.error).toBeNull();
      expect(dateOnlyReplay.data).toEqual(dateOnly.data);
      const conflictingReplay = await schedule(owner.client, {
        ...dateOnlyRequest,
        targetDate: "2030-04-03",
      });
      expect(conflictingReplay.error?.message).toContain("idempotency_conflict");

      const firstDateOnlyUndo = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: dateOnlyRequest.operationId,
      });
      expect(firstDateOnlyUndo.error).toBeNull();
      expect(firstDateOnlyUndo.data).toMatchObject({ undone: true, canUndo: false });
      const restoredTask = await readTask(admin, task.id);
      expect(restoredTask).toMatchObject({
        planned_date: "2030-04-01",
        due_date: "2030-04-01",
        deadline: "2030-04-07",
      });
      const dateOnlyReplayAfterUndo = await schedule(owner.client, dateOnlyRequest);
      expect(dateOnlyReplayAfterUndo.error).toBeNull();
      expect(dateOnlyReplayAfterUndo.data).toMatchObject({ canUndo: false, undone: true });

      const dateOnlyRequestAfterUndo: ScheduleInput = {
        ...dateOnlyRequest,
        operationId: crypto.randomUUID(),
        taskUpdatedAt: restoredTask.updated_at,
      };
      const rescheduledDateOnly = await schedule(owner.client, dateOnlyRequestAfterUndo);
      expect(rescheduledDateOnly.error).toBeNull();
      const afterDateOnly = await readTask(admin, task.id);
      expect(afterDateOnly).toMatchObject({
        planned_date: "2030-04-02",
        due_date: "2030-04-02",
        deadline: "2030-04-07",
      });

      const staleTaskVersion = await schedule(owner.client, {
        ...dateOnlyRequest,
        operationId: crypto.randomUUID(),
        taskUpdatedAt: task.updated_at,
        targetDate: "2030-04-03",
      });
      expect(staleTaskVersion.error?.message).toContain("task_version_conflict");
      const beyondDeadline = await schedule(owner.client, {
        ...dateOnlyRequestAfterUndo,
        operationId: crypto.randomUUID(),
        taskUpdatedAt: afterDateOnly.updated_at,
        targetDate: "2030-04-08",
      });
      expect(beyondDeadline.error?.message).toContain("deadline_conflict");
      expect(await readTask(admin, task.id)).toMatchObject({
        planned_date: "2030-04-02",
        due_date: "2030-04-02",
        deadline: "2030-04-07",
      });

      const timedCreateRequest: ScheduleInput = {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: afterDateOnly.updated_at,
        targetDate: "2030-04-02",
        startAt: "2030-04-02T02:00:00.000Z",
        endAt: "2030-04-02T02:30:00.000Z",
      };
      const [timedCreate, concurrentReplay] = await Promise.all([
        schedule(owner.client, timedCreateRequest),
        schedule(owner.client, timedCreateRequest),
      ]);
      expect(timedCreate.error).toBeNull();
      expect(concurrentReplay.error).toBeNull();
      expect(concurrentReplay.data).toEqual(timedCreate.data);
      expect(timedCreate.data).toMatchObject({ canUndo: true, blockIds: [expect.any(String)] });
      const blockId = (timedCreate.data as { blockIds: string[] }).blockIds[0];
      const createdBlock = await readBlock(admin, blockId);
      expect(createdBlock).toMatchObject({
        task_id: task.id,
        task_occurrence_id: null,
        start_at: "2030-04-02T02:00:00+00:00",
        end_at: "2030-04-02T02:30:00+00:00",
        version: 1,
        status: "active",
      });
      const afterTimedCreate = await readTask(admin, task.id);

      const collisionTask = await insertTask(owner.client, owner.id, {
        title: "Overlapping schedule fixture",
        dueDate: "2030-04-02",
        plannedDate: "2030-04-02",
        deadline: "2030-04-07",
      });
      const overlap = await schedule(owner.client, {
        operationId: crypto.randomUUID(),
        taskId: collisionTask.id,
        taskUpdatedAt: collisionTask.updated_at,
        targetDate: "2030-04-02",
        startAt: "2030-04-02T02:15:00.000Z",
        endAt: "2030-04-02T02:45:00.000Z",
      });
      expect(overlap.error?.message).toContain("time_block_overlap");
      expect(await readTask(admin, collisionTask.id)).toMatchObject({
        planned_date: "2030-04-02",
        due_date: "2030-04-02",
        deadline: "2030-04-07",
      });
      const collisionBlocks = await admin
        .from("time_blocks")
        .select("id")
        .eq("task_id", collisionTask.id);
      expect(collisionBlocks.error).toBeNull();
      expect(collisionBlocks.data).toEqual([]);

      const originalSnapshot = snapshot(createdBlock);
      const externallyAdjustedStart = "2030-04-02T02:05:00.000Z";
      const externallyAdjustedEnd = "2030-04-02T02:35:00.000Z";
      const externalEdit = await admin
        .from("time_blocks")
        .update({
          start_at: externallyAdjustedStart,
          end_at: externallyAdjustedEnd,
          version: 2,
        })
        .eq("id", blockId);
      expect(externalEdit.error).toBeNull();
      const staleBlockVersion = await schedule(owner.client, {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: afterTimedCreate.updated_at,
        targetDate: "2030-04-02",
        startAt: "2030-04-02T03:00:00.000Z",
        endAt: "2030-04-02T03:30:00.000Z",
        blockId,
        blocks: [originalSnapshot],
      });
      expect(staleBlockVersion.error?.message).toContain("time_block_version_conflict");

      const externallyAdjustedBlock = await readBlock(admin, blockId);
      const moveRequest: ScheduleInput = {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: afterTimedCreate.updated_at,
        targetDate: "2030-04-03",
        blocks: [snapshot(externallyAdjustedBlock)],
      };
      const moved = await schedule(owner.client, moveRequest);
      expect(moved.error).toBeNull();
      expect(moved.data).toMatchObject({
        canUndo: true,
        targetDate: "2030-04-03",
        blockIds: [blockId],
      });
      const movedTask = await readTask(admin, task.id);
      expect(movedTask).toMatchObject({
        planned_date: "2030-04-03",
        due_date: "2030-04-03",
        deadline: "2030-04-07",
      });
      const movedBlock = await readBlock(admin, blockId);
      expect(movedBlock).toMatchObject({
        start_at: "2030-04-03T02:05:00+00:00",
        end_at: "2030-04-03T02:35:00+00:00",
        version: 3,
      });

      const resizeRequest: ScheduleInput = {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: movedTask.updated_at,
        targetDate: "2030-04-03",
        startAt: "2030-04-03T03:00:00.000Z",
        endAt: "2030-04-03T03:45:00.000Z",
        blockId,
        blocks: [snapshot(movedBlock)],
      };
      const resized = await schedule(owner.client, resizeRequest);
      expect(resized.error).toBeNull();
      expect(await readBlock(admin, blockId)).toMatchObject({
        start_at: "2030-04-03T03:00:00+00:00",
        end_at: "2030-04-03T03:45:00+00:00",
        version: 4,
      });
      const resizeUndo = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: resizeRequest.operationId,
      });
      expect(resizeUndo.error).toBeNull();
      expect(resizeUndo.data).toMatchObject({ undone: true, canUndo: false });
      expect(await readBlock(admin, blockId)).toMatchObject({
        start_at: "2030-04-03T02:05:00+00:00",
        end_at: "2030-04-03T02:35:00+00:00",
        version: 5,
      });
      expect(await readTask(admin, task.id)).toMatchObject({
        planned_date: "2030-04-03",
        due_date: "2030-04-03",
        deadline: "2030-04-07",
      });

      const beforeMoveBlock = await readBlock(admin, blockId);
      const undoConflictMove: ScheduleInput = {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: (await readTask(admin, task.id)).updated_at,
        targetDate: "2030-04-04",
        blocks: [snapshot(beforeMoveBlock)],
      };
      const movedForUndo = await schedule(owner.client, undoConflictMove);
      expect(movedForUndo.error).toBeNull();
      const blockerId = await insertBlock(owner.client, owner.id, {
        title: "New block in the original slot",
        startAt: beforeMoveBlock.start_at,
        endAt: beforeMoveBlock.end_at,
      });
      const blockedUndo = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: undoConflictMove.operationId,
      });
      expect(blockedUndo.error?.message).toContain("undo_conflict");
      expect(await readTask(admin, task.id)).toMatchObject({
        planned_date: "2030-04-04",
        due_date: "2030-04-04",
        deadline: "2030-04-07",
      });
      expect(await readBlock(admin, blockId)).toMatchObject({
        start_at: "2030-04-04T02:05:00+00:00",
        end_at: "2030-04-04T02:35:00+00:00",
      });
      const removeBlocker = await admin.from("time_blocks").delete().eq("id", blockerId);
      expect(removeBlocker.error).toBeNull();

      const undoneMove = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: undoConflictMove.operationId,
      });
      expect(undoneMove.error).toBeNull();
      expect(undoneMove.data).toMatchObject({ undone: true, canUndo: false });
      expect(await readTask(admin, task.id)).toMatchObject({
        planned_date: "2030-04-03",
        due_date: "2030-04-03",
        deadline: "2030-04-07",
      });
      expect(await readBlock(admin, blockId)).toMatchObject({
        start_at: "2030-04-03T02:05:00+00:00",
        end_at: "2030-04-03T02:35:00+00:00",
        version: 7,
      });
      const repeatedUndo = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: undoConflictMove.operationId,
      });
      expect(repeatedUndo.error).toBeNull();
      expect(repeatedUndo.data).toMatchObject({ undone: true, canUndo: false });
      const retryUndoneSchedule = await schedule(owner.client, undoConflictMove);
      expect(retryUndoneSchedule.error).toBeNull();
      expect(retryUndoneSchedule.data).toMatchObject({ canUndo: false, undone: true });

      const foreignTaskAttempt = await schedule(other.client, {
        operationId: crypto.randomUUID(),
        taskId: task.id,
        taskUpdatedAt: movedTask.updated_at,
        targetDate: "2030-04-05",
      });
      expect(foreignTaskAttempt.error?.message).toContain("task_not_found");
      const foreignUndo = await other.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: undoConflictMove.operationId,
      });
      expect(foreignUndo.error?.message).toContain("operation_not_found");
      const hiddenOperation = await (other.client as SupabaseClient)
        .from("task_card_schedule_operations")
        .select("operation_id")
        .eq("operation_id", undoConflictMove.operationId)
        .maybeSingle();
      expect(hiddenOperation.error).toBeNull();
      expect(hiddenOperation.data).toBeNull();
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("creates a dated recurring occurrence without changing its task, then removes only that occurrence on Undo", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];

    try {
      const owner = await createFixtureUser(admin, userIds);
      const recurringTask = await insertTask(owner.client, owner.id, {
        title: "Daily recurring schedule fixture",
        dueDate: "2030-04-01",
        plannedDate: "2030-04-01",
        deadline: "2030-04-10",
        recurrenceRule: "FREQ=DAILY",
      });
      const request: ScheduleInput = {
        operationId: crypto.randomUUID(),
        taskId: recurringTask.id,
        taskUpdatedAt: recurringTask.updated_at,
        occurrenceDate: "2030-04-02",
        targetDate: "2030-04-03",
        startAt: "2030-04-03T05:00:00.000Z",
        endAt: "2030-04-03T05:45:00.000Z",
      };

      const created = await schedule(owner.client, request);
      expect(created.error).toBeNull();
      expect(created.data).toMatchObject({
        operationId: request.operationId,
        taskId: recurringTask.id,
        targetDate: "2030-04-03",
        canUndo: true,
        blockIds: [expect.any(String)],
      });
      const repeated = await schedule(owner.client, request);
      expect(repeated.error).toBeNull();
      expect(repeated.data).toEqual(created.data);

      const { data: occurrences, error: occurrenceError } = await admin
        .from("task_occurrences")
        .select("id,occurrence_date,scheduled_date,status")
        .eq("task_id", recurringTask.id)
        .eq("occurrence_date", "2030-04-02");
      expect(occurrenceError).toBeNull();
      expect(occurrences).toHaveLength(1);
      const occurrence = occurrences![0];
      expect(occurrence).toMatchObject({
        occurrence_date: "2030-04-02",
        scheduled_date: "2030-04-03",
        status: "planned",
      });
      const recurringState = await readTask(admin, recurringTask.id);
      expect(recurringState).toMatchObject({
        planned_date: "2030-04-01",
        due_date: "2030-04-01",
        deadline: "2030-04-10",
        recurrence_rule: "FREQ=DAILY",
      });
      const blockIds = (created.data as { blockIds: string[] }).blockIds;
      const { data: occurrenceBlocks, error: blocksError } = await admin
        .from("time_blocks")
        .select("id,task_id,task_occurrence_id,start_at,end_at")
        .eq("task_id", recurringTask.id)
        .eq("task_occurrence_id", occurrence.id);
      expect(blocksError).toBeNull();
      expect(occurrenceBlocks).toHaveLength(1);
      expect(occurrenceBlocks?.[0]).toMatchObject({
        id: blockIds[0],
        task_id: recurringTask.id,
        task_occurrence_id: occurrence.id,
        start_at: "2030-04-03T05:00:00+00:00",
        end_at: "2030-04-03T05:45:00+00:00",
      });

      const undone = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: request.operationId,
      });
      expect(undone.error).toBeNull();
      expect(undone.data).toMatchObject({ undone: true, canUndo: false });
      const { data: removedOccurrence, error: removedOccurrenceError } = await admin
        .from("task_occurrences")
        .select("id")
        .eq("task_id", recurringTask.id)
        .eq("occurrence_date", "2030-04-02");
      expect(removedOccurrenceError).toBeNull();
      expect(removedOccurrence).toEqual([]);
      const { data: removedBlocks, error: removedBlocksError } = await admin
        .from("time_blocks")
        .select("id")
        .in("id", blockIds);
      expect(removedBlocksError).toBeNull();
      expect(removedBlocks).toEqual([]);
      expect(await readTask(admin, recurringTask.id)).toMatchObject({
        planned_date: "2030-04-01",
        due_date: "2030-04-01",
        deadline: "2030-04-10",
        recurrence_rule: "FREQ=DAILY",
      });

      const replayAfterUndo = await schedule(owner.client, request);
      expect(replayAfterUndo.error).toBeNull();
      expect(replayAfterUndo.data).toMatchObject({ canUndo: false, undone: true });
      const secondUndo = await owner.client.rpc("undo_task_card_schedule_atomic", {
        p_operation_id: request.operationId,
      });
      expect(secondUndo.error).toBeNull();
      expect(secondUndo.data).toMatchObject({ undone: true, canUndo: false });
    } finally {
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });
});
