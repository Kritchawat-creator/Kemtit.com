export const DEFAULT_TASK_MINUTES = 30;

export type CapacityTask = {
  id?: string;
  estimated_minutes?: number | null;
  done?: boolean;
  status?: "inbox" | "planned" | "completed" | "archived";
};

export type CapacityResult = {
  availableMinutes: number;
  plannedMinutes: number;
  remainingMinutes: number;
  overCapacityMinutes: number;
  taskCount: number;
  estimatedTaskCount: number;
  scheduledTaskMinutes: number;
  unscheduledTaskMinutes: number;
};

export type CapacityOptions = {
  /** Minutes already satisfied by linked time blocks. They are not counted twice. */
  linkedTaskMinutes?: number;
};

/** Apply a saved day budget without counting the same time blocks twice. */
export function calculateEffectiveAvailableMinutes(
  configuredMinutes: number | null | undefined,
  calendarFreeMinutes: number,
  plannedBlockMinutes: number,
): number {
  const calendarFree = Math.max(0, calendarFreeMinutes);
  if (configuredMinutes == null) return calendarFree;

  const unblockedBudget = Math.max(0, configuredMinutes - Math.max(0, plannedBlockMinutes));
  return Math.min(unblockedBudget, calendarFree);
}

/** Pure capacity calculation shared by Today, Calendar, and future calendar adapters. */
export function calculateCapacity(
  availableMinutes: number,
  tasks: readonly CapacityTask[],
  options: CapacityOptions = {},
): CapacityResult {
  const openTasks = tasks.filter(
    (task) => !task.done && task.status !== "completed" && task.status !== "archived",
  );
  const plannedMinutes = openTasks.reduce(
    (total, task) => total + (task.estimated_minutes ?? DEFAULT_TASK_MINUTES),
    0,
  );
  const scheduledTaskMinutes = Math.min(
    plannedMinutes,
    Math.max(0, options.linkedTaskMinutes ?? 0),
  );
  const unscheduledTaskMinutes = Math.max(0, plannedMinutes - scheduledTaskMinutes);
  const remainingMinutes = Math.max(0, availableMinutes - unscheduledTaskMinutes);

  return {
    availableMinutes,
    plannedMinutes,
    remainingMinutes,
    overCapacityMinutes: Math.max(0, unscheduledTaskMinutes - availableMinutes),
    taskCount: openTasks.length,
    estimatedTaskCount: openTasks.filter((task) => task.estimated_minutes != null).length,
    scheduledTaskMinutes,
    unscheduledTaskMinutes,
  };
}
