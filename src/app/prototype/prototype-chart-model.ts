import {
  formatPrototypeDate,
  getPrototypeDayRecords,
  getPrototypeWeekDates,
  type PrototypeDateKey,
  type PrototypeRecord,
  type PrototypeScope,
} from "./prototype-model";

export type PrototypeChartDay = {
  date: PrototypeDateKey;
  label: string;
  minutes: number | null;
  knownMinutes: number;
  missingEstimateCount: number;
  itemCount: number;
};

/** Estimates and event durations only. Task time blocks are not additional work. */
export function getPrototypeEstimatedWeek(
  records: PrototypeRecord[],
  date: PrototypeDateKey,
  scope: PrototypeScope,
): PrototypeChartDay[] {
  return getPrototypeWeekDates(date).map((day) => {
    const items = getPrototypeDayRecords(records, day, scope).filter(
      (record) => record.type === "task" || record.type === "habit" || record.type === "event",
    );
    let knownMinutes = 0;
    let missingEstimateCount = 0;
    for (const item of items) {
      const minutes = item.durationMinutes;
      if (minutes === undefined || !Number.isFinite(minutes) || minutes < 0) {
        missingEstimateCount += 1;
      } else {
        knownMinutes += minutes;
      }
    }
    return {
      date: day,
      label: formatPrototypeDate(day, { weekday: "short" }),
      minutes: missingEstimateCount ? null : knownMinutes,
      knownMinutes,
      missingEstimateCount,
      itemCount: items.length,
    };
  });
}

export function getPrototypeChartCeiling(values: Array<number | null>): number {
  const peak = Math.max(0, ...values.filter(
    (value): value is number => value !== null && Number.isFinite(value) && value >= 0,
  ));
  if (!peak) return 60;
  const step = peak <= 60 ? 15 : peak <= 240 ? 60 : peak <= 720 ? 120 : 240;
  return Math.ceil(peak / step) * step;
}

export function getPrototypeBarPercent(minutes: number | null, ceiling: number): number {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(ceiling) || ceiling <= 0) return 0;
  return Math.min(100, minutes / ceiling * 100);
}

/** Only the visual track is capped; overspend remains visible in the label. */
export function getPrototypeBudgetUsage(expenses: number, budget: number) {
  if (!Number.isFinite(expenses) || expenses < 0 || !Number.isFinite(budget) || budget <= 0) {
    return { percent: null, barPercent: 0, overAmount: 0 };
  }
  const percent = expenses / budget * 100;
  return {
    percent,
    barPercent: Math.min(100, percent),
    overAmount: Math.max(0, expenses - budget),
  };
}
