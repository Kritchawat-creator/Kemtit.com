"use client";

import { CalendarClock, Clock3, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import type { DayTaskItem, PlanTask } from "@/core/domain/dayplan";
import type { CalendarContextByDay } from "@/core/domain/calendar-context";
import type { Domain } from "@/core/domain/domains";
import type { AppLocale } from "@/i18n/config";
import { type ISODate, startOfMonthISO } from "@/lib/date";
import { formatDate, formatWeekdayNarrow } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-is-mobile";

import { calendarHref } from "./CalendarNav";
import { DOMAIN_STYLES } from "./DomainTag";

const MAX_DOTS = 4;

type Props = {
  date: ISODate;
  weeks: ISODate[][];
  byDay: Record<ISODate, DayTaskItem<PlanTask>[]>;
  contextByDay?: CalendarContextByDay;
  today: ISODate;
  selected?: ISODate;
};

export function CalendarMonth({ date, weeks, byDay, contextByDay = {}, today, selected }: Props) {
  const t = useTranslations("calendar");
  const ta = useTranslations();
  const locale = useLocale() as AppLocale;
  const isMobile = useIsMobile();
  const monthStart = startOfMonthISO(date);
  const headerDays = weeks[0] ?? [];

  return (
    <section
      aria-label={formatDate(date, "monthYear", locale)}
      className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs min-[761px]:p-6"
    >
      <h2 className="mb-3 text-h3 font-semibold text-text-primary">
        {formatDate(date, "monthYear", locale)}
      </h2>
      <div className="grid grid-cols-7 gap-[3px] min-[761px]:gap-1" aria-hidden="true">
        {headerDays.map((day) => (
          <div
            key={day}
            className="min-w-0 py-1 text-center text-caption font-medium text-text-secondary"
          >
            {formatWeekdayNarrow(day, locale)}
          </div>
        ))}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-[3px] min-[761px]:gap-1">
        {weeks.flat().map((day) => {
          const items = byDay[day] ?? [];
          const context = contextByDay[day];
          const inMonth = startOfMonthISO(day) === monthStart;
          const isToday = day === today;
          const isSelected = day === selected;
          const domains = [...new Set(items.map((item) => item.task.domain as Domain))];
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
            <li key={day} className="min-w-0">
              <Link
                href={calendarHref(isMobile ? "day" : "month", day)}
                aria-label={`${formatDate(day, "long", locale)} · ${t("tasksCount", { count: items.length })}${contextLabels.length ? ` · ${contextLabels.join(" · ")}` : ""}`}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  "flex min-h-11 min-w-0 flex-col items-start justify-between gap-1 rounded-[9px] border p-1.5 text-small transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none min-[761px]:min-h-12",
                  isSelected
                    ? "border-brand-500 bg-brand-500 text-neutral-0"
                    : isToday
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-transparent text-text-primary hover:border-border hover:bg-bg-subtle",
                  !inMonth && !isSelected && "opacity-40",
                )}
              >
                <span className="font-semibold">{formatDate(day, "day", locale)}</span>
                <span className="flex min-h-1.5 flex-wrap gap-[3px]" aria-hidden="true">
                  {contextKinds.map((kind) => (
                    <span
                      key={kind}
                      className={cn(
                        "size-1.5",
                        isSelected
                          ? "rounded-full bg-neutral-0"
                          : kind === "bill"
                            ? "rounded-sm bg-warning-500"
                            : kind === "timeBlock"
                              ? "rounded-none bg-brand-700"
                              : "rounded-full bg-brand-500",
                      )}
                    />
                  ))}
                  {domains.slice(0, Math.max(0, MAX_DOTS - contextKinds.length)).map((domain) => (
                    <span
                      key={domain}
                      className={cn(
                        "size-1.5 rounded-full",
                        isSelected ? "bg-neutral-0" : DOMAIN_STYLES[domain].dot,
                      )}
                    />
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-caption text-text-secondary" aria-label={ta("today.scheduleHeading")}>
        <li className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-brand-500" aria-hidden="true" />
          {ta("today.calendarEvent")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5 text-brand-700" aria-hidden="true" />
          {ta("today.timeBlock")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <ReceiptText className="size-3.5 text-warning-800" aria-hidden="true" />
          {ta("capture.types.bill")}
        </li>
      </ul>
    </section>
  );
}
