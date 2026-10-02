"use client";

import { CalendarClock, Clock3, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import type { DayTaskItem, PlanTask } from "@/core/domain/dayplan";
import type { CalendarContextByDay } from "@/core/domain/calendar-context";
import type { Domain } from "@/core/domain/domains";
import type { ISODate } from "@/lib/date";
import { APP_TIME_ZONE, type AppLocale } from "@/i18n/config";
import { formatDate, formatWeekdayNarrow } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-is-mobile";

import { calendarHref } from "./CalendarNav";
import { DOMAIN_STYLES } from "./DomainTag";

const MAX_ROWS = 5;
const MAX_CONTEXT_ROWS = 3;
const MAX_DOTS = 3;

type Props = {
  days: ISODate[];
  byDay: Record<ISODate, DayTaskItem<PlanTask>[]>;
  contextByDay?: CalendarContextByDay;
  today: ISODate;
  /** วันที่เลือกอยู่ (จาก `?date=`) — มือถือใช้ไฮไลต์ในแถบวันและแสดงงานของวันนั้นด้านล่าง */
  selected: ISODate;
  /** รายการงานของวันที่เลือก (TaskList ที่ render ฝั่ง server) — แสดงเฉพาะมือถือ */
  dayPanel?: ReactNode;
};

/**
 * สัปดาห์: มือถือ = แถบ 7 วันในการ์ดขาว (ชื่อวัน · เลขในวงกลม · จุดสี domain) แตะเลือกวัน → งานของวันนั้นด้านล่าง (Claude Design 3m)
 * desktop (md+) = 7 คอลัมน์ แต่ละคอลัมน์มีชื่องาน · render ทีละแบบตาม viewport เพื่อไม่ให้ชื่องานซ้ำใน DOM
 */
export function CalendarWeek({ days, byDay, contextByDay = {}, today, selected, dayPanel }: Props) {
  const t = useTranslations("calendar");
  const ta = useTranslations();
  const locale = useLocale() as AppLocale;
  const isMobile = useIsMobile();

  if (isMobile) {
    const selectedCount = byDay[selected]?.length ?? 0;
    return (
      <div className="space-y-4">
        <ol className="grid grid-cols-7 rounded-xl border border-border bg-bg-surface px-1 py-3 shadow-xs">
          {days.map((day) => {
            const items = byDay[day] ?? [];
            const context = contextByDay[day];
            const isToday = day === today;
            const isSelected = day === selected;
            const domains = [...new Set(items.map((i) => i.task.domain as Domain))];
            const contextKinds = [
              context?.events.length ? "event" : null,
              context?.timeBlocks.length ? "timeBlock" : null,
              context?.bills.length ? "bill" : null,
            ].filter((kind): kind is "event" | "timeBlock" | "bill" => kind !== null);
            const contextLabels = contextKinds.map((kind) =>
              kind === "event"
                ? ta("today.calendarEvent")
                : kind === "timeBlock"
                  ? ta("today.timeBlock")
                  : ta("capture.types.bill"),
            );
            return (
              <li key={day}>
                <Link
                  href={calendarHref("week", day)}
                  aria-label={`${formatDate(day, "long", locale)} · ${t("tasksCount", { count: items.length })}${contextLabels.length ? ` · ${contextLabels.join(" · ")}` : ""}`}
                  aria-current={isSelected ? "date" : undefined}
                  className="flex flex-col items-center gap-1.5 rounded-md py-1 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "text-caption font-medium",
                      isToday ? "text-brand-500" : "text-text-secondary",
                    )}
                  >
                    {formatWeekdayNarrow(day, locale)}
                  </span>
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-base font-semibold transition-colors",
                      isSelected
                        ? "bg-brand-500 text-neutral-0"
                        : isToday
                          ? "border-[1.5px] border-brand-500 text-text-primary"
                          : "text-text-primary",
                    )}
                  >
                    {formatDate(day, "day", locale)}
                  </span>
                  <span className="flex h-1.5 gap-[3px]" aria-hidden="true">
                    {contextKinds.map((kind) => (
                      <span
                        key={kind}
                        className={cn(
                          "size-1.5",
                          kind === "bill" ? "rounded-sm bg-warning-500" : "rounded-full bg-brand-500",
                          kind === "timeBlock" && "rounded-none",
                        )}
                      />
                    ))}
                    {domains.slice(0, Math.max(0, MAX_DOTS - contextKinds.length)).map((d) => (
                      <span key={d} className={cn("size-1.5 rounded-full", DOMAIN_STYLES[d].dot)} />
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-h2 text-text-primary">{formatDate(selected, "weekday", locale)}</h2>
            <span className="text-small text-text-secondary">
              {t("tasksCount", { count: selectedCount })}
            </span>
          </div>
          {dayPanel}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl p-1">
      <ol className="grid grid-cols-[repeat(7,minmax(136px,1fr))] gap-3">
        {days.map((day) => {
          const items = byDay[day] ?? [];
          const context = contextByDay[day];
          const contextRows = [
            ...(context?.events ?? []).map((event) => ({
              id: `event:${event.id}`,
              kind: "event" as const,
              title: event.title,
              detail: event.all_day || !event.start_time
                ? ta("today.allDay")
                : `${event.start_time.slice(0, 5)}–${event.end_time?.slice(0, 5) ?? ""}`,
              label: ta("today.calendarEvent"),
            })),
            ...(context?.timeBlocks ?? []).map((block) => ({
              id: `timeBlock:${block.id}`,
              kind: "timeBlock" as const,
              title: block.title,
              detail: `${formatCalendarTime(block.start_at, locale)}–${formatCalendarTime(block.end_at, locale)}`,
              label: ta("today.timeBlock"),
            })),
            ...(context?.bills ?? []).map((bill) => ({
              id: `bill:${bill.id}`,
              kind: "bill" as const,
              title: bill.title,
              detail: bill.status === "paid" ? t("billPaid") : t("billDue"),
              label: ta("capture.types.bill"),
            })),
          ];
          const remainingItems =
            Math.max(0, items.length - MAX_ROWS) +
            Math.max(0, contextRows.length - MAX_CONTEXT_ROWS);
          const isToday = day === today;
          return (
            <li
              key={day}
              className={cn(
                "grid min-w-0 grid-rows-[auto_1fr_auto] rounded-xl border border-border bg-bg-surface p-3 shadow-xs",
                isToday && "ring-[1.5px] ring-brand-500",
              )}
            >
              <Link
                href={calendarHref("day", day)}
                aria-label={t("openDay", { date: formatDate(day, "long", locale) })}
                className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-md px-1 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
              >
                <span className="text-caption text-text-secondary">{formatWeekdayNarrow(day, locale)}</span>
                <span
                  className={cn(
                    "inline-flex min-w-7 justify-center rounded-full px-1.5 text-small font-medium",
                    isToday ? "bg-brand-500 text-neutral-0" : "text-text-primary",
                  )}
                >
                  {formatDate(day, "day", locale)}
                </span>
              </Link>
              <ul className="mt-2 flex min-w-0 flex-col gap-1.5">
                {items.slice(0, MAX_ROWS).map((item) => (
                  <li key={item.key} className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-md bg-bg-subtle px-2 text-caption">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        DOMAIN_STYLES[item.task.domain as Domain].dot,
                      )}
                      aria-hidden="true"
                    />
                    <span
                      title={item.task.title}
                      className={cn(
                        "min-w-0 truncate",
                        item.done ? "text-text-muted line-through" : "text-text-primary",
                      )}
                    >
                      {item.task.title}
                    </span>
                  </li>
                ))}
                {contextRows.slice(0, MAX_CONTEXT_ROWS).map((item) => {
                  const Icon =
                    item.kind === "event"
                      ? CalendarClock
                      : item.kind === "timeBlock"
                        ? Clock3
                        : ReceiptText;
                  return (
                    <li
                      key={item.id}
                      className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-md bg-bg-subtle px-2 text-caption"
                    >
                      <Icon
                        className={cn(
                          "size-3.5 shrink-0",
                          item.kind === "bill" ? "text-warning-800" : "text-brand-600",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span title={item.title} className="block truncate text-text-primary">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-text-secondary">
                          {item.label} · {item.detail}
                        </span>
                      </span>
                    </li>
                  );
                })}
                {items.length === 0 && contextRows.length === 0 ? (
                  <li className="flex min-h-11 items-center justify-center text-caption text-text-muted">
                    {t("noTasks")}
                  </li>
                ) : null}
              </ul>
              <Link
                href={calendarHref("day", day)}
                aria-label={t("openDay", { date: formatDate(day, "long", locale) })}
                className="mt-3 flex min-h-11 min-w-0 items-center rounded-md border-t border-border px-1 text-caption font-medium text-brand-600 hover:underline focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
              >
                {remainingItems > 0
                  ? t("more", { count: remainingItems })
                  : contextRows.length > 0
                    ? t("openDay", { date: formatDate(day, "long", locale) })
                    : t("tasksCount", { count: items.length })}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatCalendarTime(timestamp: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}
