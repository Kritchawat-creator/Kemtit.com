import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database, Json } from "@/types/database";

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

describe.skipIf(!integrationEnabled)("planner rescue local Supabase", () => {
  it("applies once, creates the proposed block, and undoes only the same state", async () => {
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");
    const admin = serviceClient();
    const email = `kemtit-rescue-${crypto.randomUUID()}@example.test`;
    const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(createError).toBeNull();
    expect(created.user).not.toBeNull();
    const client = userClient();
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    expect(signInError).toBeNull();
    const userId = created.user!.id;

    try {
      const { data: task, error: taskError } = await client
        .from("tasks")
        .insert({
          user_id: userId,
          title: "Rescue integration task",
          due_date: "2030-04-01",
          planned_date: "2030-04-01",
          deadline: "2030-04-05",
          domain: "work",
          status: "planned",
          priority: "high",
          estimated_minutes: 60,
        })
        .select("id, updated_at")
        .single();
      expect(taskError).toBeNull();
      expect(task).not.toBeNull();

      const { data: archiveTask, error: archiveTaskError } = await client
        .from("tasks")
        .insert({
          user_id: userId,
          title: "Archive recovery task",
          due_date: "2030-04-01",
          planned_date: "2030-04-01",
          domain: "work",
          status: "planned",
          priority: "normal",
          estimated_minutes: 30,
        })
        .select("id, updated_at")
        .single();
      expect(archiveTaskError).toBeNull();
      expect(archiveTask).not.toBeNull();

      const { data: archiveBlock, error: archiveBlockError } = await client
        .from("time_blocks")
        .insert({
          user_id: userId,
          task_id: archiveTask!.id,
          title: "Archive recovery focus",
          start_at: "2030-04-02T02:00:00.000Z",
          end_at: "2030-04-02T02:30:00.000Z",
        })
        .select("id")
        .single();
      expect(archiveBlockError).toBeNull();
      expect(archiveBlock).not.toBeNull();

      const { data: preparedBlock, error: preparedBlockError } = await client
        .from("time_blocks")
        .insert({
          user_id: userId,
          title: "Prepared rescue overlap",
          start_at: "2030-04-02T02:00:00.000Z",
          end_at: "2030-04-02T03:00:00.000Z",
        })
        .select("id")
        .single();
      expect(preparedBlockError).toBeNull();
      expect(preparedBlock).not.toBeNull();
      const { error: preparedOriginError } = await admin
        .from("time_blocks")
        .update({ data_origin: "SYSTEM" })
        .eq("id", preparedBlock!.id);
      expect(preparedOriginError).toBeNull();

      const operationId = crypto.randomUUID();
      const plan = {
        proposalVersion: "rescue-integration",
        items: [
          {
            taskId: task!.id,
            title: "Rescue integration task",
            action: "move",
            reason: "movedToFreeWindow",
            targetDate: "2030-04-02",
            startAt: "2030-04-02T02:00:00.000Z",
            endAt: "2030-04-02T02:30:00.000Z",
            blockId: null,
            expectedBlockVersion: null,
            expectedTaskUpdatedAt: task!.updated_at,
          },
          {
            taskId: archiveTask!.id,
            title: "Archive recovery task",
            action: "move",
            reason: "movedToFreeWindow",
            targetDate: "2030-04-02",
            startAt: "2030-04-02T02:30:00.000Z",
            endAt: "2030-04-02T03:00:00.000Z",
            blockId: archiveBlock!.id,
            expectedBlockVersion: 1,
            expectedTaskUpdatedAt: archiveTask!.updated_at,
          },
        ],
      } as Json;

      const applied = await client.rpc("apply_rescue_operation", {
        p_operation_id: operationId,
        p_target_date: "2030-04-02",
        p_plan: plan,
      });
      expect(applied.error).toBeNull();
      expect(applied.data).toBe(operationId);

      const retried = await client.rpc("apply_rescue_operation", {
        p_operation_id: operationId,
        p_target_date: "2030-04-02",
        p_plan: plan,
      });
      expect(retried.error).toBeNull();
      expect(retried.data).toBe(operationId);

      const { data: movedTask, error: movedTaskError } = await admin
        .from("tasks")
        .select("planned_date, due_date, deadline")
        .eq("id", task!.id)
        .single();
      expect(movedTaskError).toBeNull();
      expect(movedTask).toMatchObject({
        planned_date: "2030-04-02",
        due_date: "2030-04-02",
        deadline: "2030-04-05",
      });

      const { data: createdBlocks, error: blockError } = await admin
        .from("time_blocks")
        .select("id, start_at, end_at")
        .eq("task_id", task!.id);
      expect(blockError).toBeNull();
      expect(createdBlocks).toHaveLength(1);

      const { data: movedArchiveBlock, error: movedArchiveBlockError } = await admin
        .from("time_blocks")
        .select("start_at, end_at, version")
        .eq("id", archiveBlock!.id)
        .single();
      expect(movedArchiveBlockError).toBeNull();
      expect(movedArchiveBlock).toMatchObject({
        start_at: "2030-04-02T02:30:00+00:00",
        end_at: "2030-04-02T03:00:00+00:00",
        version: 2,
      });

      const collisionTaskAResult = await client
        .from("tasks")
        .insert({
          user_id: userId,
          title: "Rescue collision task A",
          due_date: "2030-04-01",
          planned_date: "2030-04-01",
          domain: "work",
          status: "planned",
          priority: "normal",
        })
        .select("id, updated_at")
        .single();
      expect(collisionTaskAResult.error).toBeNull();
      expect(collisionTaskAResult.data).not.toBeNull();
      const collisionBlockAResult = await client
        .from("time_blocks")
        .insert({
          user_id: userId,
          task_id: collisionTaskAResult.data!.id,
          title: "Rescue collision block A",
          start_at: "2030-04-04T02:00:00.000Z",
          end_at: "2030-04-04T02:30:00.000Z",
        })
        .select("id")
        .single();
      expect(collisionBlockAResult.error).toBeNull();
      expect(collisionBlockAResult.data).not.toBeNull();

      const collisionTaskBResult = await client
        .from("tasks")
        .insert({
          user_id: userId,
          title: "Rescue collision task B",
          due_date: "2030-04-01",
          planned_date: "2030-04-01",
          domain: "work",
          status: "planned",
          priority: "normal",
        })
        .select("id, updated_at")
        .single();
      expect(collisionTaskBResult.error).toBeNull();
      expect(collisionTaskBResult.data).not.toBeNull();
      const collisionBlockBResult = await client
        .from("time_blocks")
        .insert({
          user_id: userId,
          task_id: collisionTaskBResult.data!.id,
          title: "Rescue collision block B",
          start_at: "2030-04-04T03:00:00.000Z",
          end_at: "2030-04-04T03:30:00.000Z",
        })
        .select("id")
        .single();
      expect(collisionBlockBResult.error).toBeNull();
      expect(collisionBlockBResult.data).not.toBeNull();

      const collidingOperationId = crypto.randomUUID();
      const collidingPlan = await client.rpc("apply_rescue_operation", {
        p_operation_id: collidingOperationId,
        p_target_date: "2030-04-04",
        p_plan: {
          proposalVersion: "rescue-final-overlap",
          items: [
            {
              taskId: collisionTaskAResult.data!.id,
              title: "Rescue collision task A",
              action: "move",
              reason: "movedToFreeWindow",
              targetDate: "2030-04-04",
              startAt: "2030-04-04T02:30:00.000Z",
              endAt: "2030-04-04T03:00:00.000Z",
              blockId: collisionBlockAResult.data!.id,
              expectedBlockVersion: 1,
              expectedTaskUpdatedAt: collisionTaskAResult.data!.updated_at,
            },
            {
              taskId: collisionTaskBResult.data!.id,
              title: "Rescue collision task B",
              action: "move",
              reason: "movedToFreeWindow",
              targetDate: "2030-04-04",
              startAt: "2030-04-04T02:30:00.000Z",
              endAt: "2030-04-04T03:00:00.000Z",
              blockId: collisionBlockBResult.data!.id,
              expectedBlockVersion: 1,
              expectedTaskUpdatedAt: collisionTaskBResult.data!.updated_at,
            },
          ],
        } as Json,
      });
      expect(collidingPlan.error?.code).toBe("40001");
      expect(collidingPlan.data).toBeNull();

      const { data: unchangedCollisionTasks, error: unchangedCollisionTasksError } = await admin
        .from("tasks")
        .select("id, planned_date, due_date")
        .in("id", [collisionTaskAResult.data!.id, collisionTaskBResult.data!.id])
        .order("id");
      expect(unchangedCollisionTasksError).toBeNull();
      expect(unchangedCollisionTasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: collisionTaskAResult.data!.id,
            planned_date: "2030-04-01",
            due_date: "2030-04-01",
          }),
          expect.objectContaining({
            id: collisionTaskBResult.data!.id,
            planned_date: "2030-04-01",
            due_date: "2030-04-01",
          }),
        ]),
      );
      const { data: unchangedCollisionBlocks, error: unchangedCollisionBlocksError } = await admin
        .from("time_blocks")
        .select("id, start_at, end_at, version")
        .in("id", [collisionBlockAResult.data!.id, collisionBlockBResult.data!.id])
        .order("id");
      expect(unchangedCollisionBlocksError).toBeNull();
      expect(unchangedCollisionBlocks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: collisionBlockAResult.data!.id,
            start_at: "2030-04-04T02:00:00+00:00",
            end_at: "2030-04-04T02:30:00+00:00",
            version: 1,
          }),
          expect.objectContaining({
            id: collisionBlockBResult.data!.id,
            start_at: "2030-04-04T03:00:00+00:00",
            end_at: "2030-04-04T03:30:00+00:00",
            version: 1,
          }),
        ]),
      );
      const { data: collidingOperation, error: collidingOperationError } = await admin
        .from("rescue_operations")
        .select("id")
        .eq("id", collidingOperationId);
      expect(collidingOperationError).toBeNull();
      expect(collidingOperation).toEqual([]);

      const rollbackTaskInsert = await client
        .from("tasks")
        .insert({
          user_id: userId,
          title: "Rescue rollback task",
          due_date: "2030-04-01",
          planned_date: "2030-04-01",
          domain: "work",
          status: "planned",
          priority: "normal",
        })
        .select("id, updated_at")
        .single();
      expect(rollbackTaskInsert.error).toBeNull();
      expect(rollbackTaskInsert.data).not.toBeNull();

      const stationaryBlockInsert = await client
        .from("time_blocks")
        .insert({
          user_id: userId,
          title: "Stationary rescue conflict",
          start_at: "2030-04-03T02:00:00.000Z",
          end_at: "2030-04-03T03:00:00.000Z",
        })
        .select("id")
        .single();
      expect(stationaryBlockInsert.error).toBeNull();
      expect(stationaryBlockInsert.data).not.toBeNull();

      const rejectedOperationId = crypto.randomUUID();
      const rejected = await client.rpc("apply_rescue_operation", {
        p_operation_id: rejectedOperationId,
        p_target_date: "2030-04-03",
        p_plan: {
          proposalVersion: "rescue-stationary-conflict",
          items: [
            {
              taskId: rollbackTaskInsert.data!.id,
              title: "Rescue rollback task",
              action: "move",
              reason: "movedToFreeWindow",
              targetDate: "2030-04-03",
              startAt: "2030-04-03T02:00:00.000Z",
              endAt: "2030-04-03T03:00:00.000Z",
              blockId: null,
              expectedBlockVersion: null,
              expectedTaskUpdatedAt: rollbackTaskInsert.data!.updated_at,
            },
          ],
        } as Json,
      });
      expect(rejected.error?.code).toBe("40001");
      expect(rejected.data).toBeNull();

      const { data: unchangedRollbackTask, error: unchangedRollbackTaskError } = await admin
        .from("tasks")
        .select("planned_date, due_date")
        .eq("id", rollbackTaskInsert.data!.id)
        .single();
      expect(unchangedRollbackTaskError).toBeNull();
      expect(unchangedRollbackTask).toMatchObject({
        planned_date: "2030-04-01",
        due_date: "2030-04-01",
      });
      const { data: rollbackTaskBlocks, error: rollbackTaskBlocksError } = await admin
        .from("time_blocks")
        .select("id")
        .eq("task_id", rollbackTaskInsert.data!.id);
      expect(rollbackTaskBlocksError).toBeNull();
      expect(rollbackTaskBlocks).toEqual([]);
      const { data: rejectedOperation, error: rejectedOperationError } = await admin
        .from("rescue_operations")
        .select("id")
        .eq("id", rejectedOperationId);
      expect(rejectedOperationError).toBeNull();
      expect(rejectedOperation).toEqual([]);

      const undone = await client.rpc("undo_rescue_operation", { p_operation_id: operationId });
      expect(undone.error).toBeNull();
      expect(undone.data).toBe(operationId);

      const { data: restoredTask, error: restoredTaskError } = await admin
        .from("tasks")
        .select("planned_date, due_date, deadline")
        .eq("id", task!.id)
        .single();
      expect(restoredTaskError).toBeNull();
      expect(restoredTask).toMatchObject({
        planned_date: "2030-04-01",
        due_date: "2030-04-01",
        deadline: "2030-04-05",
      });

      const { data: restoredArchiveTask, error: restoredArchiveTaskError } = await admin
        .from("tasks")
        .select("planned_date, due_date")
        .eq("id", archiveTask!.id)
        .single();
      expect(restoredArchiveTaskError).toBeNull();
      expect(restoredArchiveTask).toMatchObject({
        planned_date: "2030-04-01",
        due_date: "2030-04-01",
      });
      const { data: restoredArchiveBlock, error: restoredArchiveBlockError } = await admin
        .from("time_blocks")
        .select("start_at, end_at, version")
        .eq("id", archiveBlock!.id)
        .single();
      expect(restoredArchiveBlockError).toBeNull();
      expect(restoredArchiveBlock).toMatchObject({
        start_at: "2030-04-02T02:00:00+00:00",
        end_at: "2030-04-02T02:30:00+00:00",
        version: 3,
      });

      const { data: remainingBlocks, error: remainingBlockError } = await admin
        .from("time_blocks")
        .select("id")
        .eq("task_id", task!.id);
      expect(remainingBlockError).toBeNull();
      expect(remainingBlocks).toEqual([]);
    } finally {
      await admin.from("time_blocks").delete().eq("user_id", userId);
      await admin.from("rescue_operations").delete().eq("user_id", userId);
      await admin.from("tasks").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  });
});
