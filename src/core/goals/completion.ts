import "server-only";

import { computeProgress, isMetricComplete } from "@/core/domain/progress";
import type { ServerSupabase } from "@/lib/supabase/server";

import type { Goal } from "./schema";

/**
 * Transition one goal to completed exactly once.
 * The PostgreSQL function updates only rows whose completed_at is still null and
 * writes goal.completed in the same transaction, so concurrent callers cannot
 * create duplicate completion events.
 */
export async function completeGoalOnce(
  supabase: ServerSupabase,
  goalId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("complete_goal_once", {
    p_goal_id: goalId,
  });
  if (error) {
    console.error("[goals] completeGoalOnce failed", { code: error.code });
    return false;
  }
  return data === true;
}

/**
 * Check whether a metric goal has reached its target, then perform the shared
 * exactly-once completion transition. current_value is maintained by the
 * goal_entries trigger, so this reads the latest row before evaluating progress.
 */
export async function markMetricCompletedIfReached(
  supabase: ServerSupabase,
  userId: string,
  goalId: string,
): Promise<{ current: number; percent: number; completed: boolean } | null> {
  void userId; // compatibility while callers still pass the authenticated user id

  const { data: goal } = await supabase.from("goals").select("*").eq("id", goalId).maybeSingle();
  if (!goal) return null;
  const typed = goal as Goal;
  const percent = computeProgress(typed, [], []);

  const completed =
    isMetricComplete(typed) && !typed.completed_at ? await completeGoalOnce(supabase, goalId) : false;

  return { current: typed.current_value, percent, completed };
}
