import { addDaysISO, isAfterISO, isBeforeISO, type ISODate, weekdayOf } from "@/lib/date";

/**
 * Recurrence subset ของ POC (Q4): FREQ=DAILY | FREQ=WEEKLY;BYDAY=SU,MO,...
 * เก็บเป็น RRULE string เพื่อขยายเป็น RRULE เต็มทีหลังโดยไม่ migrate — occurrence แรก = task.due_date (anchor)
 */
export const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export type Recurrence = { freq: "DAILY" } | { freq: "WEEKLY"; byDay: number[] };

const RULE_RE = /^FREQ=(DAILY|WEEKLY)(?:;BYDAY=((?:SU|MO|TU|WE|TH|FR|SA)(?:,(?:SU|MO|TU|WE|TH|FR|SA))*))?$/;

export function parseRRule(rule: string | null | undefined): Recurrence | null {
  if (!rule) return null;
  const match = RULE_RE.exec(rule);
  if (!match) return null;
  if (match[1] === "DAILY") return { freq: "DAILY" };
  const byDay = (match[2] ? match[2].split(",") : []).map((code) => WEEKDAY_CODES.indexOf(code as WeekdayCode));
  return { freq: "WEEKLY", byDay: [...new Set(byDay)].sort((a, b) => a - b) };
}

export function formatRRule(recurrence: Recurrence | null): string | null {
  if (!recurrence) return null;
  if (recurrence.freq === "DAILY") return "FREQ=DAILY";
  if (recurrence.byDay.length === 0) return "FREQ=WEEKLY";
  return `FREQ=WEEKLY;BYDAY=${recurrence.byDay.map((d) => WEEKDAY_CODES[d]).join(",")}`;
}

/** WEEKLY ที่ไม่ระบุ BYDAY = ทุกสัปดาห์ในวันเดียวกับ anchor */
export function occursOn(recurrence: Recurrence, anchor: ISODate, date: ISODate): boolean {
  if (isBeforeISO(date, anchor)) return false;
  if (recurrence.freq === "DAILY") return true;
  const days = recurrence.byDay.length ? recurrence.byDay : [weekdayOf(anchor)];
  return days.includes(weekdayOf(date));
}

export function occurrencesBetween(recurrence: Recurrence, anchor: ISODate, from: ISODate, to: ISODate): ISODate[] {
  const result: ISODate[] = [];
  let cursor = isBeforeISO(from, anchor) ? anchor : from;
  while (!isAfterISO(cursor, to)) {
    if (occursOn(recurrence, anchor, cursor)) result.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return result;
}
