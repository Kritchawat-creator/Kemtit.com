export type TaskDateFields = {
  deadline?: string | null;
  planned_date?: string | null;
  due_date: string | null;
};

export type PrintTaskDateStatus = { kind: "overdue" } | { kind: "planned"; date: string } | null;

/** Only an elapsed explicit deadline is overdue; a past plan date stays informational. */
export function getPrintTaskDateStatus(
  task: TaskDateFields,
  displayDate: string,
): PrintTaskDateStatus {
  if (task.deadline && task.deadline < displayDate) return { kind: "overdue" };

  const plannedDate = task.planned_date ?? task.due_date;
  if (plannedDate && plannedDate < displayDate) return { kind: "planned", date: plannedDate };

  return null;
}
