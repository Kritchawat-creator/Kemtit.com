import { fromZonedTime } from "date-fns-tz";

import { addDaysISO, APP_TIME_ZONE, type ISODate } from "@/lib/date";

import { DEFAULT_TASK_MINUTES } from "./capacity";

export type Interval = {
  start: number;
  end: number;
};

export type TaskBlockInterval = Interval & {
  id?: string;
  taskId?: string | null;
};

export type AvailabilityTask = {
  id: string;
  estimatedMinutes?: number | null;
};

export type AvailabilityInput = {
  workingWindows: readonly Interval[];
  busyIntervals?: readonly Interval[];
  breakIntervals?: readonly Interval[];
  taskBlocks?: readonly TaskBlockInterval[];
  tasks?: readonly AvailabilityTask[];
};

export type AvailabilityResult = {
  workingMinutes: number;
  busyMinutes: number;
  breakMinutes: number;
  plannedBlockMinutes: number;
  linkedTaskMinutes: number;
  taskDemandMinutes: number;
  unscheduledTaskMinutes: number;
  availableMinutes: number;
  overCapacityMinutes: number;
  estimatedTaskCount: number;
  freeIntervals: Interval[];
  conflictingBlockIds: string[];
};

const CLOCK_TIME = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)(?::[0-5]\d)?$/;

function clockMinutes(value: string): number {
  const match = CLOCK_TIME.exec(value);
  if (!match) throw new RangeError("invalid clock time");
  if (value.startsWith("24:00")) return 1440;
  return Number(match[1]) * 60 + Number(match[2]);
}

function localTimestamp(date: ISODate, value: string, timeZone: string): number {
  const minutes = clockMinutes(value);
  const timestampDate = minutes === 1440 ? addDaysISO(date, 1) : date;
  const clock = minutes === 1440 ? "00:00" : value.slice(0, 5);
  return fromZonedTime(`${timestampDate}T${clock}:00`, timeZone).getTime();
}

/** Convert a local calendar window into an absolute interval without server-timezone drift. */
export function intervalFromLocalDate(
  date: ISODate,
  startTime: string,
  endTime: string,
  timeZone = APP_TIME_ZONE,
): Interval {
  const startMinutes = clockMinutes(startTime);
  const endMinutes = clockMinutes(endTime);
  const endDate = endMinutes <= startMinutes ? addDaysISO(date, 1) : date;
  const start = localTimestamp(date, startTime, timeZone);
  const end = localTimestamp(endDate, endTime, timeZone);
  if (end <= start) throw new RangeError("invalid local interval");
  return { start, end };
}

export type CalendarEventSchedule = {
  eventDate: ISODate;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  blocksTime?: boolean;
};

export type ClockWindow = {
  start: string;
  end: string;
};

export type TimeBlockSchedule = {
  id: string;
  startAt: string;
  endAt: string;
  taskId: string | null;
};

/** Treat all-day events as unavailable for the date; timed events preserve their local timezone. */
export function intervalForCalendarEvent(
  event: CalendarEventSchedule,
  timeZone = APP_TIME_ZONE,
): Interval | null {
  if (event.blocksTime === false) return null;
  if (event.allDay) return intervalFromLocalDate(event.eventDate, "00:00", "24:00", timeZone);
  if (!event.startTime || !event.endTime) return null;
  return intervalFromLocalDate(event.eventDate, event.startTime, event.endTime, timeZone);
}

/** Build the single availability result consumed by Today and Calendar. */
export function calculateDayAvailability(input: {
  date: ISODate;
  timezone: string;
  workingWindows: readonly ClockWindow[];
  breakWindows: readonly ClockWindow[];
  events: readonly CalendarEventSchedule[];
  timeBlocks: readonly TimeBlockSchedule[];
  tasks: readonly AvailabilityTask[];
}): AvailabilityResult {
  return calculateAvailability({
    workingWindows: input.workingWindows.map((window) =>
      intervalFromLocalDate(input.date, window.start, window.end, input.timezone),
    ),
    breakIntervals: input.breakWindows.map((window) =>
      intervalFromLocalDate(input.date, window.start, window.end, input.timezone),
    ),
    busyIntervals: input.events.flatMap((event) => {
      const interval = intervalForCalendarEvent(event, input.timezone);
      return interval ? [interval] : [];
    }),
    taskBlocks: input.timeBlocks.map((block) => ({
      ...intervalFromISO(block.startAt, block.endAt),
      id: block.id,
      taskId: block.taskId,
    })),
    tasks: input.tasks,
  });
}

/** Parse provider timestamps without losing their explicit timezone offset. */
export function intervalFromISO(startAt: string, endAt: string): Interval {
  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new RangeError("invalid interval");
  }
  return { start, end };
}

/** Merge overlap and touching intervals. The output is sorted and immutable. */
export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end))
    .filter((interval) => interval.end > interval.start)
    .map((interval) => ({ start: interval.start, end: interval.end }))
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push(interval);
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }
  return merged;
}

export function subtractIntervals(
  windows: readonly Interval[],
  reservations: readonly Interval[],
): Interval[] {
  const reserved = mergeIntervals(reservations);
  const free: Interval[] = [];

  for (const window of mergeIntervals(windows)) {
    let cursor = window.start;
    for (const reservation of reserved) {
      if (reservation.end <= window.start) continue;
      if (reservation.start >= window.end) break;

      const start = Math.max(window.start, reservation.start);
      const end = Math.min(window.end, reservation.end);
      if (start > cursor) free.push({ start: cursor, end: start });
      cursor = Math.max(cursor, end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) free.push({ start: cursor, end: window.end });
  }

  return free;
}

export function intervalMinutes(interval: Interval): number {
  return Math.max(0, Math.round((interval.end - interval.start) / 60_000));
}

function totalMinutes(intervals: readonly Interval[]): number {
  return intervals.reduce((total, interval) => total + intervalMinutes(interval), 0);
}

function clipToWindows(
  intervals: readonly Interval[],
  windows: readonly Interval[],
): Interval[] {
  const clipped: Interval[] = [];
  for (const interval of intervals) {
    for (const window of windows) {
      const start = Math.max(interval.start, window.start);
      const end = Math.min(interval.end, window.end);
      if (end > start) clipped.push({ start, end });
    }
  }
  return mergeIntervals(clipped);
}

function taskBlockMinutesByTask(blocks: readonly TaskBlockInterval[]): Map<string, number> {
  const intervalsByTask = new Map<string, Interval[]>();
  for (const block of blocks) {
    if (!block.taskId) continue;
    const intervals = intervalsByTask.get(block.taskId) ?? [];
    intervals.push(block);
    intervalsByTask.set(block.taskId, intervals);
  }

  return new Map(
    [...intervalsByTask.entries()].map(([taskId, intervals]) => [taskId, totalMinutes(mergeIntervals(intervals))]),
  );
}

/**
 * Calculate usable windows once for Today, Plan, and Calendar.
 *
 * Busy events, breaks, and task blocks are unioned before subtraction, so an
 * overlapping event never removes time twice. A task's linked blocks satisfy
 * that portion of its estimate and are not added to the remaining demand.
 */
export function calculateAvailability(input: AvailabilityInput): AvailabilityResult {
  const workingWindows = mergeIntervals(input.workingWindows);
  const busyIntervals = mergeIntervals(input.busyIntervals ?? []);
  const breakIntervals = mergeIntervals(input.breakIntervals ?? []);
  const taskBlocks = (input.taskBlocks ?? []).filter((block) => block.end > block.start);
  const blockIntervals = mergeIntervals(taskBlocks);
  const reservations = mergeIntervals([...busyIntervals, ...breakIntervals, ...blockIntervals]);
  const freeIntervals = subtractIntervals(workingWindows, reservations);
  const tasks = input.tasks ?? [];
  const blockMinutesByTask = taskBlockMinutesByTask(taskBlocks);
  const taskDemandMinutes = tasks.reduce(
    (total, task) => total + (task.estimatedMinutes ?? DEFAULT_TASK_MINUTES),
    0,
  );
  const linkedTaskMinutes = tasks.reduce((total, task) => {
    const estimate = task.estimatedMinutes ?? DEFAULT_TASK_MINUTES;
    return total + Math.min(estimate, blockMinutesByTask.get(task.id) ?? 0);
  }, 0);
  const unscheduledTaskMinutes = Math.max(0, taskDemandMinutes - linkedTaskMinutes);
  const availableMinutes = totalMinutes(freeIntervals);

  const conflictingBlockIds = taskBlocks
    .filter((block) =>
      [...busyIntervals, ...breakIntervals, ...taskBlocks].some(
        (other) =>
          other !== block && other.start < block.end && other.end > block.start,
      ),
    )
    .flatMap((block) => (block.id ? [block.id] : []));

  return {
    workingMinutes: totalMinutes(workingWindows),
    busyMinutes: totalMinutes(clipToWindows(busyIntervals, workingWindows)),
    breakMinutes: totalMinutes(clipToWindows(breakIntervals, workingWindows)),
    plannedBlockMinutes: totalMinutes(blockIntervals),
    linkedTaskMinutes,
    taskDemandMinutes,
    unscheduledTaskMinutes,
    availableMinutes,
    overCapacityMinutes: Math.max(0, unscheduledTaskMinutes - availableMinutes),
    estimatedTaskCount: tasks.filter((task) => task.estimatedMinutes != null).length,
    freeIntervals,
    conflictingBlockIds: [...new Set(conflictingBlockIds)],
  };
}
