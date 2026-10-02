import { isBeforeISO, type ISODate } from "@/lib/date";

export type TaskDateDisplayItem = {
  date: ISODate;
  done: boolean;
  skipped?: boolean;
  actionable?: boolean;
  recurring: boolean;
  task: {
    due_date?: ISODate | null;
    planned_date?: ISODate | null;
    deadline?: ISODate | null;
  };
};

export type TaskDateDisplay = {
  plannedDate: ISODate | null;
  deadline: ISODate | null;
  overdueSince: ISODate | null;
};

/** Keep a scheduled occurrence date distinct from its optional delivery deadline. */
export function getTaskDateDisplay(item: TaskDateDisplayItem, today: ISODate): TaskDateDisplay {
  const plannedDate = item.recurring
    ? item.date
    : (item.task.planned_date ?? item.task.due_date ?? null);
  const deadline = item.task.deadline ?? null;
  const overdueSince =
    !item.done &&
    !item.skipped &&
    item.actionable !== false &&
    deadline !== null &&
    isBeforeISO(deadline, today)
      ? deadline
      : null;

  return { plannedDate, deadline, overdueSince };
}
