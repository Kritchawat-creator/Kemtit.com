import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";

export async function getActiveHabits(date: string) {
  const supabase = await createServerSupabase();
  const [{ data: habits, error: habitsError }, { data: completions, error: completionsError }] =
    await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .in("data_origin", [...COUNTED_DATA_ORIGINS])
        .is("archived_at", null)
        .order("created_at"),
      supabase.from("habit_completions").select("habit_id, completed_on").eq("completed_on", date),
    ]);
  if (habitsError || completionsError) {
    throw new QueryError("habits.getActiveHabits", habitsError?.code ?? completionsError?.code);
  }
  const done = new Set((completions ?? []).map((completion) => completion.habit_id));
  return (habits ?? []).map((habit) => ({ ...habit, done: done.has(habit.id) }));
}

export async function getHabitWeekStats(
  from: string,
  to: string,
): Promise<{ done: number; target: number; habits: number }> {
  const supabase = await createServerSupabase();
  const [{ data: habits, error: habitsError }, { data: completions, error: completionsError }] =
    await Promise.all([
      supabase
        .from("habits")
        .select("id, target_per_week")
        .in("data_origin", [...COUNTED_DATA_ORIGINS])
        .is("archived_at", null),
      supabase
        .from("habit_completions")
        .select("habit_id, completed_on")
        .gte("completed_on", from)
        .lte("completed_on", to),
    ]);

  if (habitsError || completionsError) {
    throw new QueryError("habits.getHabitWeekStats", habitsError?.code ?? completionsError?.code);
  }

  const activeIds = new Set((habits ?? []).map((habit) => habit.id));
  const done = (completions ?? []).filter((row) => activeIds.has(row.habit_id)).length;
  const target = (habits ?? []).reduce((sum, habit) => sum + habit.target_per_week, 0);
  return { done, target, habits: habits?.length ?? 0 };
}
