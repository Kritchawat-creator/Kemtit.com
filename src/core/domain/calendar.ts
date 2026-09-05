import {
  addDaysISO,
  addMonthsISO,
  eachDayISO,
  endOfMonthISO,
  endOfWeekISO,
  type ISODate,
  startOfMonthISO,
  startOfWeekISO,
} from "@/lib/date";

import { itemsForDate, type DayTaskItem, type PlanCompletion, type PlanTask } from "./dayplan";

/** ปฏิทิน POC (Decision 3): วัน / สัปดาห์ / เดือน — ไม่มีมุมมองปี */
export const CALENDAR_VIEWS = ["day", "week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export function parseCalendarView(value: unknown): CalendarView {
  return typeof value === "string" && (CALENDAR_VIEWS as readonly string[]).includes(value) ? (value as CalendarView) : "week";
}

/** ช่วงวันที่ต้องดึงข้อมูล — เดือนใช้ช่วง grid (อาทิตย์แรก → เสาร์สุดท้าย) */
export function calendarRange(view: CalendarView, date: ISODate): { from: ISODate; to: ISODate } {
  switch (view) {
    case "day":
      return { from: date, to: date };
    case "week":
      return { from: startOfWeekISO(date), to: endOfWeekISO(date) };
    case "month":
      return { from: startOfWeekISO(startOfMonthISO(date)), to: endOfWeekISO(endOfMonthISO(date)) };
  }
}

export function shiftCalendarDate(view: CalendarView, date: ISODate, delta: 1 | -1): ISODate {
  switch (view) {
    case "day":
      return addDaysISO(date, delta);
    case "week":
      return addDaysISO(date, 7 * delta);
    case "month":
      return addMonthsISO(startOfMonthISO(date), delta);
  }
}

/** grid เดือน: แถวละ 7 วัน เริ่มอาทิตย์ (5-6 แถว) */
export function monthGrid(date: ISODate): ISODate[][] {
  const { from, to } = calendarRange("month", date);
  const days = eachDayISO(from, to);
  const rows: ISODate[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

/** งานต่อวันในช่วง (รวม occurrence ของ task ซ้ำ) */
export function itemsByDay<T extends PlanTask>(
  tasks: T[],
  completions: PlanCompletion[],
  from: ISODate,
  to: ISODate,
): Record<ISODate, DayTaskItem<T>[]> {
  const result: Record<ISODate, DayTaskItem<T>[]> = {};
  for (const day of eachDayISO(from, to)) {
    const items = itemsForDate(tasks, completions, day);
    if (items.length > 0) result[day] = items;
  }
  return result;
}
