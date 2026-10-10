export type GoalTaskCandidate = {
  id: string;
  goal_id: string;
  title: string;
  planned_date: string | null;
  due_date: string | null;
  created_at: string;
};

export type GoalNextAction = Pick<
  GoalTaskCandidate,
  "id" | "goal_id" | "title" | "planned_date" | "due_date"
>;

function actionDate(task: GoalTaskCandidate): string {
  return task.planned_date ?? task.due_date ?? task.created_at.slice(0, 10);
}

/** Select one earliest open, non-recurring task for each goal using its actual schedule. */
export function selectNextActionByGoal(tasks: GoalTaskCandidate[]): Map<string, GoalNextAction> {
  const candidates = [...tasks].sort(
    (a, b) =>
      actionDate(a).localeCompare(actionDate(b)) ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
  const nextActions = new Map<string, GoalNextAction>();

  for (const task of candidates) {
    if (nextActions.has(task.goal_id)) continue;
    const { id, goal_id, title, planned_date, due_date } = task;
    nextActions.set(goal_id, { id, goal_id, title, planned_date, due_date });
  }

  return nextActions;
}
