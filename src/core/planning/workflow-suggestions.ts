import { formatInTimeZone } from "date-fns-tz";

import type { Interval } from "./availability";
import { intervalFromLocalDate } from "./availability";
import { DEFAULT_TASK_MINUTES } from "./capacity";
import { APP_TIME_ZONE, type ISODate } from "@/lib/date";

export type PrioritySuggestionTask = {
  id: string;
  deadline?: string | null;
  overdue?: boolean;
  priority?: "high" | "normal" | "low" | null;
  goalId?: string | null;
  projectId?: string | null;
};

export type SuggestedTimeSlot = {
  startAtLocal: string;
  endAtLocal: string;
  durationMinutes: number;
};

const MAX_DAILY_PLAN_BUDGET_MINUTES = 1440;

/** Keep the saved plan budget compatible with calculateEffectiveAvailableMinutes. */
export function defaultDailyPlanBudget(
  calendarFreeMinutes: number,
  plannedBlockMinutes: number,
): number {
  return Math.min(
    MAX_DAILY_PLAN_BUDGET_MINUTES,
    Math.max(0, Math.round(calendarFreeMinutes)) + Math.max(0, Math.round(plannedBlockMinutes)),
  );
}

/** Order visible tasks by urgency first, then user priority and stable relationships. */
export function suggestTopPriorityTaskIds(
  tasks: readonly PrioritySuggestionTask[],
  planDate: ISODate,
  limit = 3,
): string[] {
  const uniqueTasks = deduplicatePriorityTasks(tasks, planDate);
  return orderTasksByPriority(uniqueTasks, planDate)
    .slice(0, Math.max(0, limit))
    .map((task) => task.id);
}

/** Keep the first task order while retaining the strongest occurrence metadata per ID. */
export function deduplicatePriorityTasks<T extends PrioritySuggestionTask>(
  tasks: readonly T[],
  planDate: ISODate,
): T[] {
  const uniqueById = new Map<string, T>();
  for (const task of tasks) {
    const existing = uniqueById.get(task.id);
    if (!existing || compareSuggestionTasks(task, existing, planDate) < 0) {
      uniqueById.set(task.id, task);
    }
  }
  return [...uniqueById.values()];
}

/** Apply saved task choices first while keeping each source row, including occurrences. */
export function orderTasksByPriority<T extends PrioritySuggestionTask>(
  tasks: readonly T[],
  planDate: ISODate,
  preferredTaskIds: readonly string[] = [],
): T[] {
  const preferredOrder = new Map(
    preferredTaskIds.map((taskId, index) => [taskId, index] as const),
  );
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((left, right) => {
      const preferredDifference =
        (preferredOrder.get(left.task.id) ?? Number.MAX_SAFE_INTEGER) -
        (preferredOrder.get(right.task.id) ?? Number.MAX_SAFE_INTEGER);
      if (preferredDifference !== 0) return preferredDifference;

      const priorityDifference = compareSuggestionTasks(left.task, right.task, planDate);
      return priorityDifference || left.index - right.index;
    })
    .map(({ task }) => task);
}

function compareSuggestionTasks(
  left: PrioritySuggestionTask,
  right: PrioritySuggestionTask,
  planDate: ISODate,
): number {
  const deadlineOrder = deadlineUrgency(left.deadline, planDate) - deadlineUrgency(right.deadline, planDate);
  if (deadlineOrder !== 0) return deadlineOrder;

  const planOrder = Number(!left.overdue) - Number(!right.overdue);
  if (planOrder !== 0) return planOrder;

  const priorityOrder = taskPriorityOrder(left.priority) - taskPriorityOrder(right.priority);
  if (priorityOrder !== 0) return priorityOrder;

  const linkedOrder = Number(!hasLinkedContext(left)) - Number(!hasLinkedContext(right));
  if (linkedOrder !== 0) return linkedOrder;

  return 0;
}

/** Find the earliest same-day free interval that fits the task estimate. */
export function suggestTimeBlockSlot(input: {
  date: ISODate;
  freeIntervals: readonly Interval[];
  durationMinutes: number;
  now: number;
}): SuggestedTimeSlot | null {
  const durationMinutes =
    Number.isFinite(input.durationMinutes) && input.durationMinutes > 0
      ? input.durationMinutes
      : DEFAULT_TASK_MINUTES;
  const dayWindow = intervalFromLocalDate(input.date, "00:00", "24:00", APP_TIME_ZONE);
  const earliestStart = Math.max(dayWindow.start, input.now);
  const durationMs = durationMinutes * 60_000;

  for (const interval of [...input.freeIntervals].sort((left, right) => left.start - right.start)) {
    const intervalStart = Math.max(interval.start, dayWindow.start, earliestStart);
    const intervalEnd = Math.min(interval.end, dayWindow.end);
    // datetime-local inputs have minute precision, so round a partial minute up.
    const start = Math.ceil(intervalStart / 60_000) * 60_000;
    const end = start + durationMs;
    if (start < dayWindow.end && end <= intervalEnd) {
      return {
        startAtLocal: formatInTimeZone(start, APP_TIME_ZONE, "yyyy-MM-dd'T'HH:mm"),
        endAtLocal: formatInTimeZone(end, APP_TIME_ZONE, "yyyy-MM-dd'T'HH:mm"),
        durationMinutes,
      };
    }
  }

  return null;
}

/** Keep a usable manual time range when availability has no fitting suggestion. */
export function defaultManualTimeBlockSlot(
  date: ISODate,
  durationMinutes: number,
): SuggestedTimeSlot {
  const duration =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : DEFAULT_TASK_MINUTES;
  const start = intervalFromLocalDate(date, "09:00", "09:01", APP_TIME_ZONE).start;
  const end = start + duration * 60_000;
  return {
    startAtLocal: formatInTimeZone(start, APP_TIME_ZONE, "yyyy-MM-dd'T'HH:mm"),
    endAtLocal: formatInTimeZone(end, APP_TIME_ZONE, "yyyy-MM-dd'T'HH:mm"),
    durationMinutes: duration,
  };
}

function deadlineUrgency(deadline: string | null | undefined, planDate: ISODate): number {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return 2;
  if (deadline < planDate) return 0;
  if (deadline === planDate) return 1;
  return 2;
}

function taskPriorityOrder(priority: PrioritySuggestionTask["priority"]): number {
  switch (priority) {
    case "high":
      return 0;
    case "low":
      return 2;
    default:
      return 1;
  }
}

function hasLinkedContext(task: PrioritySuggestionTask): boolean {
  return Boolean(task.goalId || task.projectId);
}
