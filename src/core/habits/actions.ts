"use server";

import { revalidatePath } from "next/cache";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { habitCompletionSchema, habitSchema } from "./schema";

export async function createHabit(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  if (parsed.data.goalId) {
    const { data: goal } = await supabase
      .from("goals")
      .select("id")
      .eq("id", parsed.data.goalId)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .maybeSingle();
    if (!goal) return fail("invalidGoal");
  }

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      domain: parsed.data.domain,
      cadence: parsed.data.cadence,
      target_per_week: parsed.data.targetPerWeek,
      goal_id: parsed.data.goalId ?? null,
      estimated_minutes: parsed.data.estimatedMinutes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail("generic");
  revalidatePath("/life");
  revalidatePath("/today");
  return ok({ id: data.id });
}

export async function toggleHabit(input: unknown): Promise<ActionResult> {
  const parsed = habitCompletionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", parsed.data.habitId)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .maybeSingle();
  if (!habit) return fail("notFound");

  const result = parsed.data.done
    ? await supabase
        .from("habit_completions")
        .upsert(
          { habit_id: parsed.data.habitId, user_id: user.id, completed_on: parsed.data.date },
          { onConflict: "habit_id,completed_on", ignoreDuplicates: true },
        )
    : await supabase
        .from("habit_completions")
        .delete()
        .eq("habit_id", parsed.data.habitId)
        .eq("completed_on", parsed.data.date);
  if (result.error) return fail("generic");

  revalidatePath("/life");
  revalidatePath("/today");
  return ok(null);
}
