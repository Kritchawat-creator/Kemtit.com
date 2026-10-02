import { periodOf, type Period } from "@/core/domain/periods";
import { addDaysISO, addMonthsISO, type ISODate } from "@/lib/date";

export const PLANNER_VIEWS = ["year", "month", "week"] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

export function parsePlannerView(value: unknown): PlannerView {
  return typeof value === "string" && (PLANNER_VIEWS as readonly string[]).includes(value)
    ? (value as PlannerView)
    : "month";
}

export function plannerPeriod(view: PlannerView, date: ISODate): Period {
  return periodOf(view, date);
}

export function shiftPlannerDate(
  view: PlannerView,
  date: ISODate,
  delta: 1 | -1,
): ISODate {
  const current = plannerPeriod(view, date);
  if (view === "year") return addMonthsISO(current.start, 12 * delta);
  if (view === "month") return addMonthsISO(current.start, delta);
  return addDaysISO(current.start, 7 * delta);
}

export function childPlannerView(view: PlannerView): PlannerView | null {
  if (view === "year") return "month";
  if (view === "month") return "week";
  return null;
}
