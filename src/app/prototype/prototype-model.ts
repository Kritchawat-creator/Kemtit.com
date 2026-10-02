export type PrototypeScope = "all" | "work" | "life";
export type PrototypeRecordScope = Exclude<PrototypeScope, "all">;
export type PrototypeItemArea = PrototypeRecordScope | "unassigned";
export type PrototypeDateKey = `${number}-${number}-${number}`;
export type PrototypeRecordType = "task" | "event" | "bill" | "habit" | "note";
export type PrototypeRecordStatus = "inbox" | "planned" | "done" | "archived";

export type PrototypeRecord = {
  id: string;
  type: PrototypeRecordType;
  title: string;
  date: PrototypeDateKey;
  scope: PrototypeItemArea;
  tone: "work" | "personal" | "finance" | "health" | "growth";
  status?: PrototypeRecordStatus;
  dueDate?: PrototypeDateKey;
  projectId?: string;
  goalId?: string;
  durationMinutes?: number;
  startTime?: string;
  amount?: number;
  recurrence?: string;
  reminderMinutes?: number;
  createdInPrototype?: boolean;
};

export type PrototypeProject = {
  id: string;
  title: string;
  scope: PrototypeRecordScope;
  goalId?: string;
  status: "active" | "paused" | "done";
};

export type PrototypeTimeBlock = {
  id: string;
  itemId: string;
  date: PrototypeDateKey;
  startTime: string;
  durationMinutes: number;
  locked?: boolean;
  createdInPrototype?: boolean;
};

export type PrototypeGoal = {
  id: string;
  title: string;
  scope: PrototypeRecordScope;
  progress: number;
};

export type PrototypeLedgerEntry = {
  id: string;
  title: string;
  date: PrototypeDateKey;
  scope: PrototypeRecordScope;
  direction: "income" | "expense";
  amount: number;
};

export const PROTOTYPE_DEMO_TODAY: PrototypeDateKey = "2026-09-24";

export const INITIAL_PROTOTYPE_RECORDS: PrototypeRecord[] = [
  {
    id: "task-kemtit-redesign",
    type: "task",
    title: "Finish Kemtit redesign",
    date: "2026-09-24",
    dueDate: "2026-09-25",
    scope: "work",
    tone: "work",
    status: "planned",
    projectId: "project-kemtit-vnext",
    goalId: "goal-kemtit-redesign",
    durationMinutes: 120,
  },
  {
    id: "event-daily-standup",
    type: "event",
    title: "Daily standup",
    date: "2026-09-24",
    scope: "work",
    tone: "work",
    startTime: "09:00",
    durationMinutes: 30,
  },
  {
    id: "event-client-meeting",
    type: "event",
    title: "Client meeting",
    date: "2026-09-24",
    scope: "work",
    tone: "personal",
    startTime: "10:30",
    durationMinutes: 60,
  },
  {
    id: "event-lunch",
    type: "event",
    title: "Lunch",
    date: "2026-09-24",
    scope: "life",
    tone: "health",
    startTime: "12:00",
    durationMinutes: 60,
  },
  {
    id: "event-deep-work",
    type: "event",
    title: "Deep work",
    date: "2026-09-24",
    scope: "work",
    tone: "work",
    startTime: "14:00",
    durationMinutes: 90,
  },
  {
    id: "event-design-review",
    type: "event",
    title: "Review design",
    date: "2026-09-24",
    scope: "work",
    tone: "growth",
    startTime: "16:00",
    durationMinutes: 60,
  },
  {
    id: "habit-workout",
    type: "habit",
    title: "Exercise 30 minutes",
    date: "2026-09-24",
    scope: "life",
    tone: "health",
    status: "planned",
    durationMinutes: 30,
    recurrence: "Mon · Wed · Fri",
    reminderMinutes: 30,
  },
  {
    id: "task-roadmap",
    type: "task",
    title: "Draft product roadmap",
    date: "2026-09-25",
    dueDate: "2026-09-26",
    scope: "work",
    tone: "work",
    status: "planned",
    projectId: "project-kemtit-vnext",
    goalId: "goal-kemtit-redesign",
    durationMinutes: 60,
  },
  {
    id: "bill-electricity",
    type: "bill",
    title: "Pay electricity bill",
    date: "2026-09-26",
    dueDate: "2026-09-26",
    scope: "life",
    tone: "finance",
    status: "planned",
    amount: 1200,
    recurrence: "Monthly",
    reminderMinutes: 1440,
  },
  {
    id: "event-family-dinner",
    type: "event",
    title: "Family dinner",
    date: "2026-09-27",
    scope: "life",
    tone: "personal",
    startTime: "18:00",
    durationMinutes: 120,
  },
  {
    id: "task-weekend-plan",
    type: "task",
    title: "Plan the week ahead",
    date: "2026-09-27",
    dueDate: "2026-09-27",
    scope: "life",
    tone: "personal",
    status: "planned",
    durationMinutes: 30,
    recurrence: "Every Sunday",
    reminderMinutes: 30,
  },
  {
    id: "task-listing-images",
    type: "task",
    title: "Prepare new listing images",
    date: "2026-09-24",
    dueDate: "2026-09-25",
    scope: "work",
    tone: "growth",
    status: "inbox",
    projectId: "project-digital-launch",
    goalId: "goal-digital-income",
    durationMinutes: 45,
  },
];

export const INITIAL_PROTOTYPE_GOALS: PrototypeGoal[] = [
  { id: "goal-kemtit-redesign", title: "Kemtit redesign", scope: "work", progress: 68 },
  { id: "goal-stay-healthy", title: "Stay healthy", scope: "life", progress: 50 },
  { id: "goal-digital-income", title: "Grow digital income", scope: "work", progress: 75 },
];

export const INITIAL_PROTOTYPE_PROJECTS: PrototypeProject[] = [
  { id: "project-kemtit-vnext", title: "Kemtit Prototype VNext", scope: "work", goalId: "goal-kemtit-redesign", status: "active" },
  { id: "project-digital-launch", title: "Digital Product Launch", scope: "work", goalId: "goal-digital-income", status: "active" },
];

export const INITIAL_PROTOTYPE_TIME_BLOCKS: PrototypeTimeBlock[] = [
  { id: "block-kemtit-redesign-1", itemId: "task-kemtit-redesign", date: "2026-09-24", startTime: "13:00", durationMinutes: 60 },
];

export const PROTOTYPE_WORKDAY = {
  startTime: "09:00",
  endTime: "18:00",
  bufferMinutes: 30,
} as const;

export const INITIAL_PROTOTYPE_LEDGER: PrototypeLedgerEntry[] = [
  { id: "income-monthly", title: "Monthly income", date: "2026-09-01", scope: "life", direction: "income", amount: 30000 },
  { id: "expense-housing", title: "Housing", date: "2026-09-02", scope: "life", direction: "expense", amount: 12000 },
  { id: "expense-living", title: "Living expenses", date: "2026-09-03", scope: "life", direction: "expense", amount: 5550 },
];

export const PROTOTYPE_MONTHLY_BUDGET = 20000;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parsePrototypeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toPrototypeDateKey(date: Date): PrototypeDateKey {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as PrototypeDateKey;
}

export function shiftPrototypeDays(
  dateKey: PrototypeDateKey,
  days: number,
): PrototypeDateKey {
  const date = parsePrototypeDate(dateKey);
  if (!date) return PROTOTYPE_DEMO_TODAY;
  date.setDate(date.getDate() + days);
  return toPrototypeDateKey(date);
}

export function shiftPrototypeMonths(
  dateKey: PrototypeDateKey,
  months: number,
): PrototypeDateKey {
  const date = parsePrototypeDate(dateKey);
  if (!date) return PROTOTYPE_DEMO_TODAY;
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toPrototypeDateKey(date);
}

export function getPrototypeWeekDates(dateKey: PrototypeDateKey): PrototypeDateKey[] {
  const date = parsePrototypeDate(dateKey);
  if (!date) return getPrototypeWeekDates(PROTOTYPE_DEMO_TODAY);
  const mondayOffset = (date.getDay() + 6) % 7;
  const weekStart = shiftPrototypeDays(toPrototypeDateKey(date), -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => shiftPrototypeDays(weekStart, index));
}

export function getPrototypeMonthCells(dateKey: PrototypeDateKey): Array<PrototypeDateKey | null> {
  const date = parsePrototypeDate(dateKey);
  if (!date) return getPrototypeMonthCells(PROTOTYPE_DEMO_TODAY);

  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingDays + 1;
    return day < 1 || day > daysInMonth
      ? null
      : toPrototypeDateKey(new Date(date.getFullYear(), date.getMonth(), day));
  });
}

export function formatPrototypeDate(
  dateKey: PrototypeDateKey,
  options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" },
): string {
  const date = parsePrototypeDate(dateKey);
  if (!date) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function formatPrototypeMonth(dateKey: PrototypeDateKey): string {
  return formatPrototypeDate(dateKey, { month: "long", year: "numeric" });
}

export function formatPrototypeDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function getRecordsInScope<T extends { scope: PrototypeItemArea }>(
  records: T[],
  scope: PrototypeScope,
): T[] {
  return scope === "all" ? records : records.filter((record) => record.scope === scope);
}

export function getPrototypeDayRecords(
  records: PrototypeRecord[],
  date: PrototypeDateKey,
  scope: PrototypeScope,
): PrototypeRecord[] {
  return getRecordsInScope(records, scope)
    .filter((record) => record.date === date && record.status !== "inbox" && record.status !== "archived")
    .slice()
    .sort((left, right) => (left.startTime ?? "").localeCompare(right.startTime ?? ""));
}

export function getPrototypeActionRecords(
  records: PrototypeRecord[],
  date: PrototypeDateKey,
  scope: PrototypeScope,
): PrototypeRecord[] {
  return getPrototypeDayRecords(records, date, scope).filter(
    (record) => record.type === "task" || record.type === "habit",
  );
}

export function getPrototypeUpcomingRecords(
  records: PrototypeRecord[],
  date: PrototypeDateKey,
  scope: PrototypeScope,
  limit = 3,
): PrototypeRecord[] {
  return getRecordsInScope(records, scope)
    .filter((record) => record.status !== "inbox" && record.status !== "archived" && record.status !== "done" && (record.dueDate ?? record.date) > date && record.type !== "note")
    .slice()
    .sort((left, right) => (left.dueDate ?? left.date).localeCompare(right.dueDate ?? right.date) || (left.startTime ?? "").localeCompare(right.startTime ?? ""))
    .slice(0, limit);
}

export function getPrototypeMetrics(
  records: PrototypeRecord[],
  goals: PrototypeGoal[],
  ledger: PrototypeLedgerEntry[],
  date: PrototypeDateKey,
  scope: PrototypeScope,
  completedIds: Set<string>,
) {
  const dayRecords = getPrototypeDayRecords(records, date, scope);
  const dayTasks = dayRecords.filter((record) => record.type === "task");
  const actionRecords = dayRecords.filter((record) => record.type === "task" || record.type === "habit");
  const scheduledRecords = dayRecords.filter((record) => record.type === "event" && record.startTime);
  const scopedGoals = getRecordsInScope(goals, scope);
  const monthKey = date.slice(0, 7);
  const scopedLedger = getRecordsInScope(ledger, scope).filter((entry) => entry.date.startsWith(monthKey));
  const monthlyIncome = scopedLedger
    .filter((entry) => entry.direction === "income")
    .reduce((total, entry) => total + entry.amount, 0);
  const monthlyExpenses = scopedLedger
    .filter((entry) => entry.direction === "expense")
    .reduce((total, entry) => total + entry.amount, 0);
  const balance = scopedLedger.length > 0
    ? monthlyIncome - monthlyExpenses
    : null;

  return {
    taskCount: dayTasks.length,
    completedTaskCount: dayTasks.filter((record) => completedIds.has(record.id)).length,
    completedCount: actionRecords.filter((record) => completedIds.has(record.id)).length,
    focusMinutes: actionRecords.reduce((total, record) => total + (record.durationMinutes ?? 0), 0),
    scheduledMinutes: scheduledRecords.reduce((total, record) => total + (record.durationMinutes ?? 0), 0),
    goalProgress: scopedGoals.length > 0
      ? Math.round(scopedGoals.reduce((total, goal) => total + goal.progress, 0) / scopedGoals.length)
      : null,
    monthlyIncome: scopedLedger.length > 0 ? monthlyIncome : null,
    monthlyExpenses: scopedLedger.length > 0 ? monthlyExpenses : null,
    monthlyBalance: balance,
  };
}

export function getPrototypeWeekFocus(
  records: PrototypeRecord[],
  date: PrototypeDateKey,
  scope: PrototypeScope,
) {
  return getPrototypeWeekDates(date).map((dateKey) => {
    const scheduledMinutes = getPrototypeDayRecords(records, dateKey, scope)
      .filter((record) => record.type === "event" && record.startTime)
      .reduce((total, record) => total + (record.durationMinutes ?? 0), 0);
    const actionMinutes = getPrototypeActionRecords(records, dateKey, scope)
      .reduce((total, record) => total + (record.durationMinutes ?? 0), 0);
    return {
      date: dateKey,
      label: formatPrototypeDate(dateKey, { weekday: "short" }),
      minutes: scheduledMinutes + actionMinutes,
    };
  });
}

function clockToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToClock(value: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const minutes = String(safe % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function occupiedIntervals(
  records: PrototypeRecord[],
  timeBlocks: PrototypeTimeBlock[],
  date: PrototypeDateKey,
) {
  const intervals = [
    ...records
      .filter((record) => record.date === date && record.type === "event" && record.startTime && record.durationMinutes)
      .map((record) => {
        const start = clockToMinutes(record.startTime!);
        return { start, end: start + (record.durationMinutes ?? 0) };
      }),
    ...timeBlocks
      .filter((block) => block.date === date)
      .map((block) => {
        const start = clockToMinutes(block.startTime);
        return { start, end: start + block.durationMinutes };
      }),
  ].sort((left, right) => left.start - right.start);

  return intervals.reduce<Array<{ start: number; end: number }>>((merged, interval) => {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
    return merged;
  }, []);
}

export function getPrototypeCapacity(
  records: PrototypeRecord[],
  timeBlocks: PrototypeTimeBlock[],
  date: PrototypeDateKey,
) {
  const workdayStart = clockToMinutes(PROTOTYPE_WORKDAY.startTime);
  const workdayEnd = clockToMinutes(PROTOTYPE_WORKDAY.endTime);
  const totalMinutes = workdayEnd - workdayStart;
  const intervals = occupiedIntervals(records, timeBlocks, date)
    .map((interval) => ({
      start: Math.max(workdayStart, interval.start),
      end: Math.min(workdayEnd, interval.end),
    }))
    .filter((interval) => interval.end > interval.start);
  const bookedMinutes = intervals.reduce((total, interval) => total + interval.end - interval.start, 0);
  const freeMinutes = Math.max(0, totalMinutes - bookedMinutes - PROTOTYPE_WORKDAY.bufferMinutes);

  return {
    totalMinutes,
    bookedMinutes,
    bufferMinutes: PROTOTYPE_WORKDAY.bufferMinutes,
    freeMinutes,
    overCapacityMinutes: Math.max(0, bookedMinutes + PROTOTYPE_WORKDAY.bufferMinutes - totalMinutes),
  };
}

export function findPrototypeTimeSlot(
  records: PrototypeRecord[],
  timeBlocks: PrototypeTimeBlock[],
  date: PrototypeDateKey,
  durationMinutes: number,
): string | null {
  const workdayStart = clockToMinutes(PROTOTYPE_WORKDAY.startTime);
  const workdayEnd = clockToMinutes(PROTOTYPE_WORKDAY.endTime) - PROTOTYPE_WORKDAY.bufferMinutes;
  const intervals = occupiedIntervals(records, timeBlocks, date)
    .map((interval) => ({
      start: Math.max(workdayStart, interval.start),
      end: Math.min(workdayEnd, interval.end),
    }))
    .filter((interval) => interval.end > interval.start);

  let cursor = workdayStart;
  for (const interval of intervals) {
    if (interval.start - cursor >= durationMinutes) return minutesToClock(cursor);
    cursor = Math.max(cursor, interval.end);
  }
  return workdayEnd - cursor >= durationMinutes ? minutesToClock(cursor) : null;
}

export function getPrototypeMonth(dateKey: PrototypeDateKey): string {
  return dateKey.slice(0, 7);
}
