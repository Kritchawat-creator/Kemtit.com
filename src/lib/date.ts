import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * วันที่ทั้งแอปเป็น ISO date string (YYYY-MM-DD) ไม่มีเวลา ไม่มี timezone — ตรงกับคอลัมน์ `date` ใน Postgres
 * เวลา "ตอนนี้" ตีความเป็น Asia/Bangkok เสมอ (server รันเป็น UTC) — R6 ใน implementation-plan
 * สัปดาห์เริ่มวันอาทิตย์ตามปฏิทินไทย (Design §12)
 */
export const APP_TIME_ZONE = "Asia/Bangkok";
export const WEEK_STARTS_ON = 0 as const; // อาทิตย์

export type ISODate = string; // YYYY-MM-DD

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is ISODate {
  return (
    typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(parseISO(value).getTime())
  );
}

/** date-fns parseISO ตีความ date-only เป็น local midnight → format กลับได้ค่าเดิมทุก timezone */
export function fromISO(date: ISODate): Date {
  return parseISO(date);
}

export function toISO(date: Date): ISODate {
  return format(date, "yyyy-MM-dd");
}

/** วันนี้ตามเวลาไทย */
export function todayBkk(now: Date = new Date()): ISODate {
  return formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd");
}

/** แปลง timestamptz เป็นวันตามเวลาไทย (ใช้กับ completed_at → completed_on) */
export function toBkkDate(timestamp: Date | string): ISODate {
  const d = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return formatInTimeZone(d, APP_TIME_ZONE, "yyyy-MM-dd");
}

export function addDaysISO(date: ISODate, days: number): ISODate {
  return toISO(addDays(fromISO(date), days));
}

export function addWeeksISO(date: ISODate, weeks: number): ISODate {
  return toISO(addWeeks(fromISO(date), weeks));
}

export function addMonthsISO(date: ISODate, months: number): ISODate {
  return toISO(addMonths(fromISO(date), months));
}

export function startOfWeekISO(date: ISODate): ISODate {
  return toISO(startOfWeek(fromISO(date), { weekStartsOn: WEEK_STARTS_ON }));
}

export function endOfWeekISO(date: ISODate): ISODate {
  return toISO(endOfWeek(fromISO(date), { weekStartsOn: WEEK_STARTS_ON }));
}

export function startOfMonthISO(date: ISODate): ISODate {
  return toISO(startOfMonth(fromISO(date)));
}

export function endOfMonthISO(date: ISODate): ISODate {
  return toISO(endOfMonth(fromISO(date)));
}

export function startOfYearISO(date: ISODate): ISODate {
  return toISO(startOfYear(fromISO(date)));
}

export function endOfYearISO(date: ISODate): ISODate {
  return toISO(endOfYear(fromISO(date)));
}

/** จำนวนวันจาก a ถึง b (b - a) ตามปฏิทิน */
export function daysBetween(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(fromISO(b), fromISO(a));
}

export function isBeforeISO(a: ISODate, b: ISODate): boolean {
  return isBefore(fromISO(a), fromISO(b));
}

export function isAfterISO(a: ISODate, b: ISODate): boolean {
  return isAfter(fromISO(a), fromISO(b));
}

/** 0 = อาทิตย์ … 6 = เสาร์ */
export function weekdayOf(date: ISODate): number {
  return fromISO(date).getDay();
}

/** รายการวันที่จาก start ถึง end (รวมทั้งสองข้าง) */
export function eachDayISO(start: ISODate, end: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let d = start; !isAfterISO(d, end); d = addDaysISO(d, 1)) days.push(d);
  return days;
}
