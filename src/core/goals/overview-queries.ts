import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";

import { selectNextActionByGoal, type GoalNextAction } from "./next-actions";
import type { GoalWithProgress } from "./queries";

/** Fetch one upcoming open, non-recurring task per selected active goal in one batched read. */
export async function getGoalNextActions(goals: GoalWithProgress[]) {
  const activeGoalIds = goals.filter((goal) => goal.status === "active").map((goal) => goal.id);
  if (activeGoalIds.length === 0) return new Map<string, GoalNextAction>();

  const supabase = await createServerSupabase();
  const pageSize = 1000;
  const tasks: {
    id: string;
    goal_id: string;
    title: string;
    planned_date: string | null;
    due_date: string | null;
    created_at: string;
  }[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, goal_id, title, planned_date, due_date, created_at")
      .in("goal_id", activeGoalIds)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .in("status", ["inbox", "planned"])
      .is("completed_at", null)
      .is("archived_at", null)
      .is("deleted_at", null)
      .is("recurrence_rule", null)
      .order("planned_date", { ascending: true, nullsFirst: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[goals] next action lookup failed", { code: error.code });
      throw new QueryError("goals.getNextActions", error.code);
    }

    const rows = (data ?? []).filter(
      (task): task is typeof task & { goal_id: string } => task.goal_id !== null,
    );
    tasks.push(...rows);
    if (rows.length < pageSize) break;
  }

  return selectNextActionByGoal(tasks);
}
