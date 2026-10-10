import type { GoalWithProgress } from "./queries";

/** An empty execution goal has no measured progress value to display yet. */
export function hasMeasuredGoalProgress(goal: Pick<GoalWithProgress, "progress">): boolean {
  return (
    goal.progress.kind === "metric" ||
    (goal.progress.tasksTotal ?? 0) > 0 ||
    goal.progress.childCount > 0
  );
}
