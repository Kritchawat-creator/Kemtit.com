"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { carryOverTasksSchema, weeklyReviewSchema } from "./schema";

export async function saveWeeklyReview(input: unknown): Promise<ActionResult> {
  const parsed = weeklyReviewSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase.from("weekly_reviews").upsert(
    {
      user_id: user.id,
      week_start: parsed.data.weekStart,
      wins: parsed.data.wins ?? null,
      blockers: parsed.data.blockers ?? null,
      next_focus: parsed.data.nextFocus ?? null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) return fail("generic");

  revalidatePath("/reviews");
  return ok(null);
}

/** Move selected canonical tasks to next week's plan without changing deadline. */
export async function carryOverReviewTasks(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const parsed = carryOverTasksSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data: updatedCount, error } = await supabase.rpc("carry_over_tasks_with_blocks_atomic", {
    p_task_ids: parsed.data.taskIds,
    p_new_date: parsed.data.plannedDate,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("deadline_conflict")) return fail("deadlineConflict");
    if (message.includes("recurring_occurrence_required"))
      return fail("recurringOccurrenceRequired");
    if (message.includes("task_not_found")) return fail("notFound");
    if (message.includes("time_block_overlap")) return fail("timeBlockConflict");
    if (message.includes("time_block_locked")) return fail("timeBlockLocked");
    if (message.includes("time_block_anchor_missing")) return fail("timeBlockAnchorMissing");
    if (message.includes("time_block_anchor_mismatch")) return fail("timeBlockAnchorMismatch");
    return fail("generic");
  }
  if (typeof updatedCount !== "number" || updatedCount !== parsed.data.taskIds.length) {
    return fail("generic");
  }

  for (const path of ["/today", "/calendar", "/plan", "/reviews"]) revalidatePath(path);
  return ok({ count: updatedCount });
}
