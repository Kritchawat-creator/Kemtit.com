import {
  addDaysISO,
  addMonthsISO,
  addWeeksISO,
  daysBetween,
  endOfMonthISO,
  endOfWeekISO,
  endOfYearISO,
  fromISO,
  isAfterISO,
  isBeforeISO,
  type ISODate,
  startOfMonthISO,
  startOfWeekISO,
  startOfYearISO,
  toISO,
} from "@/lib/date";

/**
 * Goal Cascade Engine (Scope §5.1) — คำนวณขอบ period และเสนอช่วงลูกจากแม่ (pure, ไม่แตะ DB)
 * POC แสดง ปี → เดือน → สัปดาห์ (+ task เป็นหน่วยวัน); quarter/day คงไว้ใน enum แต่ไม่โชว์ใน UI (Q9)
 */
export const PERIOD_TYPES = ["year", "quarter", "month", "week", "day"] as const;
export type PeriodType = (typeof PERIOD_TYPES)[number];

export const POC_PERIOD_TYPES = ["year", "month", "week"] as const satisfies readonly PeriodType[];

export type Period = { type: PeriodType; start: ISODate; end: ISODate };

/** snap วันที่ให้ตรงขอบต้น period (สัปดาห์เริ่มอาทิตย์) */
export function normalizePeriodStart(type: PeriodType, date: ISODate): ISODate {
  switch (type) {
    case "year":
      return startOfYearISO(date);
    case "quarter": {
      const d = fromISO(date);
      const quarterMonth = Math.floor(d.getMonth() / 3) * 3;
      return toISO(new Date(d.getFullYear(), quarterMonth, 1));
    }
    case "month":
      return startOfMonthISO(date);
    case "week":
      return startOfWeekISO(date);
    case "day":
      return date;
  }
}

export function periodEnd(type: PeriodType, start: ISODate): ISODate {
  switch (type) {
    case "year":
      return endOfYearISO(start);
    case "quarter":
      return addDaysISO(addMonthsISO(start, 3), -1);
    case "month":
      return endOfMonthISO(start);
    case "week":
      return endOfWeekISO(start);
    case "day":
      return start;
  }
}

export function periodOf(type: PeriodType, date: ISODate): Period {
  const start = normalizePeriodStart(type, date);
  return { type, start, end: periodEnd(type, start) };
}

export function nextPeriod(period: Period): Period {
  return periodOf(period.type, addDaysISO(period.end, 1));
}

export function previousPeriod(period: Period): Period {
  return periodOf(period.type, addDaysISO(period.start, -1));
}

export function periodContains(period: Period, date: ISODate): boolean {
  return !isBeforeISO(date, period.start) && !isAfterISO(date, period.end);
}

/** ช่วงลูกต้อง "ทับ" กับช่วงแม่ (ไม่ใช่อยู่ภายในทั้งหมด) เพราะสัปดาห์คร่อมขอบเดือนได้ (Decision 1.4) */
export function overlaps(a: Period, b: Period): boolean {
  return !isAfterISO(a.start, b.end) && !isAfterISO(b.start, a.end);
}

/** ระดับลูกถัดไปใน POC: ปี → เดือน → สัปดาห์ → (task) */
export function childPeriodType(parent: PeriodType): PeriodType | null {
  switch (parent) {
    case "year":
      return "month";
    case "quarter":
      return "month";
    case "month":
      return "week";
    case "week":
      return null;
    case "day":
      return null;
  }
}

export function parentPeriodType(child: PeriodType): PeriodType | null {
  switch (child) {
    case "day":
      return "week";
    case "week":
      return "month";
    case "month":
      return "year";
    case "quarter":
      return "year";
    case "year":
      return null;
  }
}

/** เสนอช่วงลูกทั้งหมดที่ทับกับแม่ เช่น ทุกสัปดาห์ (เริ่มอาทิตย์) ที่ทับเดือนนี้ */
export function suggestChildPeriods(parent: Period, childType: PeriodType): Period[] {
  const result: Period[] = [];
  let cursor = periodOf(childType, parent.start);
  while (!isAfterISO(cursor.start, parent.end)) {
    result.push(cursor);
    cursor = nextPeriod(cursor);
  }
  return result;
}

/** สัดส่วนเวลาที่ผ่านไปของ period ณ วันนี้ (0 ก่อนเริ่ม, 1 หลังจบ) — นับวันที่ผ่านไปเทียบจำนวนวันทั้งหมด */
export function elapsedRatio(period: Period, today: ISODate): number {
  const total = daysBetween(period.start, period.end) + 1;
  if (isBeforeISO(today, period.start)) return 0;
  if (isAfterISO(today, period.end)) return 1;
  const elapsed = daysBetween(period.start, today) + 1;
  return Math.min(1, Math.max(0, elapsed / total));
}

export function daysLeft(period: Period, today: ISODate): number {
  if (isAfterISO(today, period.end)) return 0;
  return daysBetween(today, period.end) + 1;
}

/** ปีที่มีใน UI สำหรับเลือก period ปี */
export function addWeeks(period: Period, weeks: number): Period {
  return periodOf(period.type, addWeeksISO(period.start, weeks));
}
