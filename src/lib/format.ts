import { APP_TIME_ZONE, fromISO, type ISODate } from "@/lib/date";

/**
 * Formatter กลาง — ตัวเลข/วันที่ทุกตัวใน UI ต้องผ่านที่นี่ (Design §16 DoD)
 * ปี พ.ศ. เป็น default (Q16) · สกุลเงินผ่าน Intl (Design §12) · ไม่ format เอง
 */
const LOCALE = "th-TH";
const LOCALE_BUDDHIST = "th-TH-u-ca-buddhist";

const thb = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const thbWithSatang = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });

/** 1234.5 → "฿1,235" (ปัดเป็นบาท) — ยอดขาย/เป้า */
export function formatTHB(amount: number): string {
  return Number.isInteger(amount) ? thb.format(amount) : thbWithSatang.format(amount);
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? integer.format(value) : decimal.format(value);
}

/** 0.42 → "42%" — รับสัดส่วน 0-1 */
export function formatPercent(ratio: number): string {
  return percent.format(Math.max(0, Math.min(1, ratio)));
}

/** ตัวเลขพร้อมหน่วย: unit "THB" → สกุลเงิน, อื่น ๆ ต่อท้ายด้วยช่องว่าง เช่น "12 เล่ม" */
export function formatValueWithUnit(value: number, unit?: string | null): string {
  if (unit === "THB" || unit === "บาท") return formatTHB(value);
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
}

type DateStyle = "short" | "medium" | "long" | "weekday" | "monthYear" | "day";

const dateFormatters: Record<DateStyle, Intl.DateTimeFormat> = {
  short: new Intl.DateTimeFormat(LOCALE_BUDDHIST, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }),
  medium: new Intl.DateTimeFormat(LOCALE_BUDDHIST, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }),
  long: new Intl.DateTimeFormat(LOCALE_BUDDHIST, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
  weekday: new Intl.DateTimeFormat(LOCALE_BUDDHIST, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }),
  monthYear: new Intl.DateTimeFormat(LOCALE_BUDDHIST, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }),
  day: new Intl.DateTimeFormat(LOCALE_BUDDHIST, { day: "numeric", timeZone: "UTC" }),
};

/** ISO date (YYYY-MM-DD) → ข้อความไทย พ.ศ. เช่น "5 ก.ย. 2569" */
export function formatThaiDate(date: ISODate, style: DateStyle = "medium"): string {
  // date-only: สร้าง Date ที่ UTC midnight แล้ว format ด้วย timeZone UTC เพื่อไม่ให้วันเลื่อน
  const [y, m, d] = date.split("-").map(Number);
  return dateFormatters[style].format(new Date(Date.UTC(y, m - 1, d)));
}

const buddhistYearOnly = new Intl.DateTimeFormat(LOCALE_BUDDHIST, {
  year: "numeric",
  timeZone: "UTC",
});

/** ISO date → "พ.ศ. 2569" */
export function formatThaiYear(date: ISODate): string {
  const [y, m, d] = date.split("-").map(Number);
  return buddhistYearOnly.format(new Date(Date.UTC(y, m - 1, d)));
}

const weekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" });

/** "อา." "จ." … สำหรับหัวคอลัมน์ปฏิทิน */
export function formatWeekdayShort(date: ISODate): string {
  const [y, m, d] = date.split("-").map(Number);
  return weekdayShort.format(new Date(Date.UTC(y, m - 1, d)));
}

const dateTime = new Intl.DateTimeFormat(LOCALE_BUDDHIST, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIME_ZONE,
});

/** timestamptz → "5 ก.ย. 2569 14:30" ตามเวลาไทย */
export function formatDateTime(timestamp: Date | string): string {
  return dateTime.format(typeof timestamp === "string" ? new Date(timestamp) : timestamp);
}

const relative = new Intl.RelativeTimeFormat("th", { numeric: "auto" });

/** "3 ชั่วโมงที่ผ่านมา" / "พรุ่งนี้" — ใช้กับ metadata (Design §9.4) */
export function formatRelative(target: Date | string, now: Date = new Date()): string {
  const t = typeof target === "string" ? new Date(target) : target;
  const diffSec = Math.round((t.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return relative.format(diffSec, "second");
  if (abs < 3600) return relative.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(diffSec / 3600), "hour");
  return relative.format(Math.round(diffSec / 86400), "day");
}

/** ระยะห่างเป็นวันจากวันนี้ → "วันนี้" / "พรุ่งนี้" / "เมื่อวาน" / "อีก 3 วัน" / "3 วันที่แล้ว" ผ่าน Intl */
export function formatDayDistance(date: ISODate, today: ISODate): string {
  const diffDays = Math.round((fromISO(date).getTime() - fromISO(today).getTime()) / 86_400_000);
  return relative.format(diffDays, "day");
}
