"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { APP_TIME_ZONE } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { formatInTimeZone } from "date-fns-tz";

import {
  mutateTaskCardGroupSchema,
  scheduleTaskCardSchema,
  undoTaskCardGroupSchema,
  undoTaskCardScheduleSchema,
} from "./card-schema";

const groupMutationResponseSchema = z.object({
  operationId: z.uuid(),
  action: z.enum(["create", "add", "remove", "rename", "dissolve"]),
  groupId: z.uuid(),
  canUndo: z.boolean(),
});

function groupMutationError(message: string | undefined) {
  const value = message?.toLowerCase() ?? "";
  if (value.includes("group_version_conflict") || value.includes("task_version_conflict")) return "conflict";
  if (value.includes("undo_conflict")) return "undoConflict";
  if (value.includes("task_not_found") || value.includes("group_not_found")) return "notFound";
  if (value.includes("task_already") || value.includes("membership_conflict")) return "groupConflict";
  if (value.includes("idempotency_conflict")) return "idempotencyConflict";
  return "generic";
}

function revalidateTaskCardViews() {
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/plan");
  revalidatePath("/today");
}

const taskCardScheduleResponseSchema = z.object({
  operationId: z.uuid(),
  taskId: z.uuid(),
  targetDate: z.string(),
  blockIds: z.array(z.uuid()),
  canUndo: z.boolean(),
  undone: z.boolean().optional(),
});

function taskCardScheduleError(message: string | undefined) {
  const value = message?.toLowerCase() ?? "";
  if (value.includes("deadline_conflict")) return "deadlineConflict";
  if (value.includes("calendar_event_conflict")) return "calendarEventConflict";
  if (value.includes("time_block_overlap") || value.includes("time_block_conflict")) return "timeBlockConflict";
  if (value.includes("time_block_locked")) return "timeBlockLocked";
  if (value.includes("task_not_found") || value.includes("occurrence_not_found")) return "notFound";
  if (value.includes("task_not_schedulable") || value.includes("occurrence_not_schedulable")) return "conflict";
  if (value.includes("occurrence_required")) return "validation";
  if (value.includes("occurrence_invalid") || value.includes("invalid_input")) return "validation";
  if (value.includes("undo_conflict")) return "undoConflict";
  if (value.includes("idempotency_conflict") || value.includes("version_conflict") || value.includes("anchor_")) return "conflict";
  return "generic";
}

export async function mutateTaskCardGroup(input: unknown): Promise<ActionResult<z.infer<typeof groupMutationResponseSchema>>> {
  const parsed = mutateTaskCardGroupSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("mutate_task_card_group_atomic", {
    p_operation_id: parsed.data.operationId,
    p_action: parsed.data.action,
    p_group_id: parsed.data.groupId,
    p_task_ids: parsed.data.taskIds,
    p_title: parsed.data.title,
    p_expected_group_versions: parsed.data.expectedGroupVersions as Json,
    p_expected_task_states: parsed.data.expectedTaskStates as Json,
  });
  if (error) {
    console.error("[task-cards] group mutation failed", { code: error.code });
    return fail(groupMutationError(error.message));
  }
  const response = groupMutationResponseSchema.safeParse(data);
  if (!response.success) return fail("generic");

  revalidateTaskCardViews();
  return ok(response.data);
}

export async function undoTaskCardGroup(input: unknown): Promise<ActionResult<{ operationId: string; undone: boolean }>> {
  const parsed = undoTaskCardGroupSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("undo_task_card_group_atomic", {
    p_operation_id: parsed.data.operationId,
  });
  if (error) {
    console.error("[task-cards] group undo failed", { code: error.code });
    return fail(groupMutationError(error.message));
  }
  const response = z.object({ operationId: z.uuid(), undone: z.boolean() }).safeParse(data);
  if (!response.success || !response.data.undone) return fail("generic");

  revalidateTaskCardViews();
  return ok(response.data);
}

export async function scheduleTaskCard(
  input: unknown,
): Promise<ActionResult<z.infer<typeof taskCardScheduleResponseSchema>>> {
  const parsed = scheduleTaskCardSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  if (parsed.data.startAt) {
    const localDate = formatInTimeZone(new Date(parsed.data.startAt), APP_TIME_ZONE, "yyyy-MM-dd");
    if (localDate !== parsed.data.targetDate) return fail("invalidDate");
  }

  const { data, error } = await supabase.rpc("schedule_task_card_atomic", {
    p_operation_id: parsed.data.operationId,
    p_task_id: parsed.data.taskId,
    p_expected_task_updated_at: parsed.data.taskUpdatedAt,
    p_occurrence_date: parsed.data.occurrenceDate,
    p_expected_occurrence_updated_at: parsed.data.occurrenceUpdatedAt,
    p_target_date: parsed.data.targetDate,
    p_start_at: parsed.data.startAt,
    p_end_at: parsed.data.endAt,
    p_block_id: parsed.data.blockId,
    p_expected_blocks: parsed.data.blocks.map((block) => ({
      id: block.id,
      version: block.version,
      startAt: block.startAt,
      endAt: block.endAt,
    })) as Json,
  });
  if (error) {
    console.error("[task-cards] schedule failed", { code: error.code });
    return fail(taskCardScheduleError(error.message));
  }
  const response = taskCardScheduleResponseSchema.safeParse(data);
  if (!response.success || response.data.operationId !== parsed.data.operationId) return fail("generic");
  revalidateTaskCardViews();
  return ok(response.data);
}

export async function undoTaskCardSchedule(
  input: unknown,
): Promise<ActionResult<{ operationId: string; undone: boolean; canUndo: boolean }>> {
  const parsed = undoTaskCardScheduleSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("undo_task_card_schedule_atomic", {
    p_operation_id: parsed.data.operationId,
  });
  if (error) {
    console.error("[task-cards] schedule undo failed", { code: error.code });
    return fail(taskCardScheduleError(error.message));
  }
  const response = z.object({ operationId: z.uuid(), undone: z.boolean(), canUndo: z.boolean() }).safeParse(data);
  if (!response.success || !response.data.undone || response.data.operationId !== parsed.data.operationId) {
    return fail("generic");
  }
  revalidateTaskCardViews();
  return ok(response.data);
}
