"use server";

import { revalidatePath } from "next/cache";

import { occursOn, parseRRule } from "@/core/domain/recurrence";
import { emitEvent } from "@/core/events/emit";
import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

import {
  dailyPlanSchema,
  applyRescueSchema,
  setTimeBlockStatusSchema,
  timeBlockSchema,
  undoRescueSchema,
  updateTimeBlockSchema,
} from "./schema";
import { planningPreferencesSchema } from "./preferences";

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function savePlanningPreferences(input: unknown): Promise<ActionResult> {
  const parsed = planningPreferencesSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase.from("planning_preferences").upsert(
    {
      user_id: user.id,
      timezone: parsed.data.timezone,
      working_windows: parsed.data.workingWindows,
      break_windows: parsed.data.breakWindows,
    },
    { onConflict: "user_id" },
  );
  if (error) return fail("generic");

  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/plan");
  return ok(null);
}

export async function saveDailyPlan(input: unknown): Promise<ActionResult> {
  const parsed = dailyPlanSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase.from("daily_plans").upsert(
    {
      user_id: user.id,
      plan_date: parsed.data.planDate,
      available_minutes: parsed.data.availableMinutes,
      top_priorities: parsed.data.topPriorities,
      notes: parsed.data.notes ?? null,
    },
    { onConflict: "user_id,plan_date" },
  );
  if (error) return fail("generic");

  const { data: notificationProfile } = await supabase
    .from("user_profiles")
    .select("notify_daily_brief")
    .eq("id", user.id)
    .maybeSingle();

  if (notificationProfile?.notify_daily_brief) {
    await emitEvent(
      supabase,
      user.id,
      "daily.plan.ready",
      { date: parsed.data.planDate },
      { dedupeKey: `daily.plan.ready:${user.id}:${parsed.data.planDate}` },
    );
  }

  revalidatePath("/today");
  revalidatePath("/calendar");
  return ok(null);
}

export async function createTimeBlock(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = timeBlockSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");
  const userId = user.id;

  let taskOccurrenceId: string | undefined;
  let createdTaskOccurrenceId: string | undefined;

  async function cleanupUnlinkedOccurrence() {
    if (!createdTaskOccurrenceId) return;
    // A failed RPC is normally rolled back, but a network error can leave an
    // uncertain outcome. Keep the occurrence if a block was actually linked;
    // only remove the row when we can prove it is still unlinked.
    const { data: linkedBlock, error: linkedBlockError } = await supabase
      .from("time_blocks")
      .select("id")
      .eq("task_occurrence_id", createdTaskOccurrenceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (linkedBlockError || linkedBlock) return;
    await supabase
      .from("task_occurrences")
      .delete()
      .eq("id", createdTaskOccurrenceId)
      .eq("user_id", userId);
  }
  if (parsed.data.taskOccurrenceDate) {
    if (!parsed.data.taskId || !parsed.data.taskScheduledDate) return fail("invalidDate");

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, recurrence_rule, due_date")
      .eq("id", parsed.data.taskId)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .eq("user_id", user.id)
      .is("archived_at", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (taskError) return fail("generic");
    if (!task?.recurrence_rule || !task.due_date) return fail("notFound");

    const rule = parseRRule(task.recurrence_rule);
    if (!rule || !occursOn(rule, task.due_date, parsed.data.taskOccurrenceDate)) {
      return fail("invalidDate");
    }

    const { data: existing, error: existingError } = await supabase
      .from("task_occurrences")
      .select("id, scheduled_date")
      .eq("task_id", task.id)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .eq("occurrence_date", parsed.data.taskOccurrenceDate)
      .maybeSingle();
    if (existingError) return fail("generic");

    if (existing) {
      if (existing.scheduled_date !== parsed.data.taskScheduledDate) {
        return fail("occurrenceConflict");
      }
      taskOccurrenceId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from("task_occurrences")
        .insert({
          task_id: task.id,
          user_id: user.id,
          occurrence_date: parsed.data.taskOccurrenceDate,
          scheduled_date: parsed.data.taskScheduledDate,
          status: "planned",
        })
        .select("id")
        .single();
      if (createError || !created) return fail("generic");
      taskOccurrenceId = created.id;
      createdTaskOccurrenceId = created.id;
    }
  }

  const rpcArgs = {
    p_title: parsed.data.title,
    p_start_at: parsed.data.startAt,
    p_end_at: parsed.data.endAt,
    p_source: parsed.data.source,
    ...(parsed.data.taskId ? { p_task_id: parsed.data.taskId } : {}),
    ...(taskOccurrenceId ? { p_task_occurrence_id: taskOccurrenceId } : {}),
  };
  const { data: id, error } = await supabase.rpc("create_time_block_atomic", rpcArgs);
  if (error) {
    console.error("[planning] createTimeBlock failed", { code: error.code });
    await cleanupUnlinkedOccurrence();
    return fail("generic");
  }
  if (!id) {
    await cleanupUnlinkedOccurrence();
    return fail("timeBlockConflict");
  }

  revalidatePath("/today");
  revalidatePath("/calendar");
  return ok({ id });
}

export async function updateTimeBlock(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateTimeBlockSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");

  const { data: id, error } = await supabase.rpc("update_time_block_atomic", {
    p_id: parsed.data.id,
    p_title: parsed.data.title,
    p_start_at: parsed.data.startAt,
    p_end_at: parsed.data.endAt,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error) {
    console.error("[planning] updateTimeBlock failed", { code: error.code });
    return fail("generic");
  }
  if (!id) return fail("timeBlockConflict");

  revalidatePath("/today");
  revalidatePath("/calendar");
  return ok({ id });
}

export async function setTimeBlockStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = setTimeBlockStatusSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");

  const { data: id, error } = await supabase.rpc("set_time_block_status_atomic", {
    p_id: parsed.data.id,
    p_expected_version: parsed.data.expectedVersion,
    p_status: parsed.data.status,
  });
  if (error) {
    console.error("[planning] setTimeBlockStatus failed", { code: error.code });
    return fail("generic");
  }
  if (!id) return fail("timeBlockConflict");

  revalidatePath("/today");
  revalidatePath("/calendar");
  return ok({ id });
}

export async function confirmRescue(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = applyRescueSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");

  const { data: id, error } = await supabase.rpc("apply_rescue_operation", {
    p_operation_id: parsed.data.operationId,
    p_target_date: parsed.data.targetDate,
    p_plan: {
      proposalVersion: parsed.data.proposalVersion,
      items: parsed.data.items,
    } as Json,
  });
  if (error) {
    console.error("[planning] confirmRescue failed", { code: error.code });
    return fail(error.code === "40001" ? "rescueConflict" : "generic");
  }
  if (!id) return fail("rescueConflict");

  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/rescue");
  return ok({ id });
}

export async function undoRescue(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = undoRescueSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const { supabase, user } = await requireUser();
  if (!user) return fail("unauthorized");

  const { data: id, error } = await supabase.rpc("undo_rescue_operation", {
    p_operation_id: parsed.data.operationId,
  });
  if (error) {
    console.error("[planning] undoRescue failed", { code: error.code });
    return fail(error.code === "40001" ? "rescueConflict" : "generic");
  }
  if (!id) return fail("rescueConflict");

  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/rescue");
  return ok({ id });
}
