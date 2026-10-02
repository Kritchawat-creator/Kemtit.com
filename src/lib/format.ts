import type { AppLocale } from "@/i18n/config";
import { intlLocale } from "@/i18n/config";
import { APP_TIME_ZONE, fromISO, type ISODate } from "@/lib/date";

export type DateStyle =
  | "short"
  | "medium"
  | "long"
  | "weekday"
  | "longWeekday"
  | "monthYear"
  | "monthShort"
  | "day";

function numberLocale(locale: AppLocale) {
  return locale === "th" ? "th-TH" : "en-GB";
}

function dateOnly(date: ISODate) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatTHB(amount: number, locale: AppLocale = "th"): string {
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  };
  return new Intl.NumberFormat(numberLocale(locale), options).format(amount);
}

export function formatNumber(value: number, locale: AppLocale = "th"): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

export function formatPercent(ratio: number, locale: AppLocale = "th"): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.min(1, ratio)));
}

export function formatValueWithUnit(
  value: number,
  unit?: string | null,
  locale: AppLocale = "th",
): string {
  if (unit === "THB" || unit === "บาท") return formatTHB(value, locale);
  return unit ? `${formatNumber(value, locale)} ${unit}` : formatNumber(value, locale);
}

export function formatValueParts(
  value: number,
  unit?: string | null,
  locale: AppLocale = "th",
): { value: string; unit: string | null } {
  if (unit === "THB" || unit === "บาท") {
    return {
      value: formatNumber(value, locale),
      unit: locale === "th" ? "บาท" : "THB",
    };
  }
  return { value: formatNumber(value, locale), unit: unit || null };
}

function dateOptions(style: DateStyle): Intl.DateTimeFormatOptions {
  switch (style) {
    case "short":
      return { day: "numeric", month: "short", timeZone: "UTC" };
    case "medium":
      return { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
    case "long":
      return { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" };
    case "weekday":
      return { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
    case "longWeekday":
      return {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      };
    case "monthYear":
      return { month: "long", year: "numeric", timeZone: "UTC" };
    case "monthShort":
      return { month: "short", timeZone: "UTC" };
    case "day":
      return { day: "numeric", timeZone: "UTC" };
  }
}

/** Locale-aware display only. Stored date values remain ISO YYYY-MM-DD. */
export function formatDate(
  date: ISODate,
  style: DateStyle = "medium",
  locale: AppLocale = "th",
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), dateOptions(style)).format(dateOnly(date));
}

/** Backward-compatible Thai formatter for legacy call sites. */
export function formatThaiDate(date: ISODate, style: DateStyle = "medium"): string {
  return formatDate(date, style, "th");
}

export function formatYear(date: ISODate, locale: AppLocale = "th"): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    timeZone: "UTC",
  }).format(dateOnly(date));
}

/** Backward-compatible alias. */
export function formatThaiYear(date: ISODate): string {
  return formatYear(date, "th");
}

export function formatWeekdayShort(date: ISODate, locale: AppLocale = "th"): string {
  return new Intl.DateTimeFormat(numberLocale(locale), {
    weekday: "short",
    timeZone: "UTC",
  }).format(dateOnly(date));
}

/**
 * Thai uses narrow weekday labels; English uses short labels (Sun, Mon, ...)
 * so the calendar remains readable without ambiguous single-letter weekdays.
 */
export function formatWeekdayNarrow(date: ISODate, locale: AppLocale = "th"): string {
  return new Intl.DateTimeFormat(numberLocale(locale), {
    weekday: locale === "th" ? "narrow" : "short",
    timeZone: "UTC",
  }).format(dateOnly(date));
}

export function formatDateTime(
  timestamp: Date | string,
  locale: AppLocale = "th",
  timeZone = APP_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(typeof timestamp === "string" ? new Date(timestamp) : timestamp);
}

export function formatRelative(
  target: Date | string,
  now: Date = new Date(),
  locale: AppLocale = "th",
): string {
  const relative = new Intl.RelativeTimeFormat(locale === "th" ? "th" : "en", {
    numeric: "auto",
  });
  const t = typeof target === "string" ? new Date(target) : target;
  const diffSec = Math.round((t.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return relative.format(diffSec, "second");
  if (abs < 3600) return relative.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(diffSec / 3600), "hour");
  return relative.format(Math.round(diffSec / 86400), "day");
}

export function formatDayDistance(
  date: ISODate,
  today: ISODate,
  locale: AppLocale = "th",
): string {
  const relative = new Intl.RelativeTimeFormat(locale === "th" ? "th" : "en", {
    numeric: "auto",
  });
  const diffDays = Math.round(
    (fromISO(date).getTime() - fromISO(today).getTime()) / 86_400_000,
  );
  return relative.format(diffDays, "day");
}

export function avatarLetter(
  displayName: string | null | undefined,
  email?: string | null,
): string {
  const source = displayName?.trim() || email?.trim() || "";
  return Array.from(source)[0] ?? "?";
}
