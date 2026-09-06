"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import type { DayTaskItem, PlanTask } from "@/core/domain/dayplan";
import type { Domain } from "@/core/domain/domains";
import { type ISODate, startOfMonthISO } from "@/lib/date";
import { formatThaiDate, formatWeekdayNarrow } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-is-mobile";

import { calendarHref } from "./CalendarNav";
import { DOMAIN_STYLES } from "./DomainTag";

const MAX_DOTS = 4;
const MAX_CHIPS = 2;

type Props = {
  date: ISODate;
  weeks: ISODate[][];
  byDay: Record<ISODate, DayTaskItem<PlanTask>[]>;
  today: ISODate;
  /** วันที่เลือกอยู่ (desktop): ช่องพื้น brand-50 + แผงงานด้านขวา (Claude Design 4d) */
  selected?: ISODate;
};

/**
 * เดือน: มือถือ = การ์ดขาว grid 7 คอลัมน์ จุดสี domain + จำนวนงาน แตะ → มุมมองวัน (Design §8.2)
 * desktop = ช่องสูง 112px มีเส้นแบ่ง ชื่องาน 2 รายการ + "+N งาน" แตะ → เลือกวัน (คงมุมมองเดือน)
 */
export function CalendarMonth({ date, weeks, byDay, today, selected }: Props) {
  const t = useTranslations("calendar");
  const isMobile = useIsMobile();
  const monthStart = startOfMonthISO(date);
  const headerDays = weeks[0] ?? [];

  if (!isMobile) {
    return (
      <div className="overflow-hidden rounded-xl bg-bg-surface shadow-md">
        <div className="grid grid-cols-7 px-0 pt-4 pb-2" aria-hidden="true">
          {headerDays.map((day, i) => (
            <div
              key={day}
              className={cn(
                "text-center text-caption font-medium",
                i === 0 ? "text-brand-500" : "text-text-secondary",
              )}
            >
              {formatWeekdayNarrow(day)}
            </div>
          ))}
        </div>
        <ol className="grid grid-cols-7 border-l border-border">
          {weeks.flat().map((day) => {
            const items = byDay[day] ?? [];
            const inMonth = startOfMonthISO(day) === monthStart;
            const isToday = day === today;
            const isSelected = day === selected;
            return (
              <li key={day} className="min-w-0">
                <Link
                  href={calendarHref("month", day)}
                  aria-label={`${formatThaiDate(day, "long")} · ${t("tasksCount", { count: items.length })}`}
                  aria-current={isSelected ? "date" : undefined}
                  className={cn(
                    "flex min-h-28 flex-col items-start gap-1 border-t border-r border-border px-2.5 py-2 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none focus-visible:ring-inset",
                    isSelected ? "bg-brand-50" : "bg-bg-surface hover:bg-bg-subtle",
                  )}
                >
                  <span
                    className={cn(
                      "mb-0.5 flex size-7 items-center justify-center rounded-full text-small font-semibold",
                      !inMonth && "text-border-strong",
                      inMonth && isSelected && "bg-brand-500 text-neutral-0",
                      inMonth && !isSelected && "text-text-primary",
                      isToday && !isSelected && "border-[1.5px] border-brand-500",
                    )}
                  >
                    {formatThaiDate(day, "day")}
                  </span>
                  {inMonth
                    ? items.slice(0, MAX_CHIPS).map((item) => (
                        <span
                          key={item.key}
                          className={cn(
                            "flex max-w-full items-center gap-1.5 text-caption font-medium",
                            DOMAIN_STYLES[item.task.domain as Domain].text,
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              DOMAIN_STYLES[item.task.domain as Domain].dot,
                            )}
                            aria-hidden="true"
                          />
                          <span className={cn("truncate", item.done && "line-through opacity-70")}>
                            {item.task.title}
                          </span>
                        </span>
                      ))
                    : null}
                  {inMonth && items.length > MAX_CHIPS ? (
                    <span className="text-caption font-medium text-text-secondary">
                      {t("more", { count: items.length - MAX_CHIPS })} {t("tasksUnitShort")}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-bg-surface p-3 shadow-md">
      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {headerDays.map((day) => (
          <div key={day} className="py-1 text-center text-caption text-text-secondary">
            {formatWeekdayNarrow(day)}
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const items = byDay[day] ?? [];
          const inMonth = startOfMonthISO(day) === monthStart;
          const isToday = day === today;
          const domains = [...new Set(items.map((i) => i.task.domain as Domain))];
          return (
            <li key={day}>
              <Link
                href={calendarHref("day", day)}
                aria-label={`${formatThaiDate(day, "long")} · ${t("tasksCount", { count: items.length })}`}
                className={cn(
                  "flex min-h-14 flex-col items-center gap-1 rounded-md p-1 transition-colors hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none",
                  !inMonth && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-full text-small font-semibold",
                    isToday ? "bg-brand-500 text-neutral-0" : "text-text-primary",
                  )}
                >
                  {formatThaiDate(day, "day")}
                </span>
                {items.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-0.5">
                    {domains.slice(0, MAX_DOTS).map((d) => (
                      <span
                        key={d}
                        className={cn("size-1.5 rounded-full", DOMAIN_STYLES[d].dot)}
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
