"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import type { DayTaskItem, PlanTask } from "@/core/domain/dayplan";
import type { Domain } from "@/core/domain/domains";
import type { ISODate } from "@/lib/date";
import { formatThaiDate, formatWeekdayNarrow } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-is-mobile";

import { calendarHref } from "./CalendarNav";
import { DOMAIN_STYLES } from "./DomainTag";

const MAX_ROWS = 4;
const MAX_DOTS = 3;

type Props = {
  days: ISODate[];
  byDay: Record<ISODate, DayTaskItem<PlanTask>[]>;
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
export function CalendarWeek({ days, byDay, today, selected, dayPanel }: Props) {
  const t = useTranslations("calendar");
  const isMobile = useIsMobile();

  if (isMobile) {
    const selectedCount = byDay[selected]?.length ?? 0;
    return (
      <div className="space-y-4">
        <ol className="grid grid-cols-7 rounded-xl bg-bg-surface px-1 py-3 shadow-md">
          {days.map((day) => {
            const items = byDay[day] ?? [];
            const isToday = day === today;
            const isSelected = day === selected;
            const domains = [...new Set(items.map((i) => i.task.domain as Domain))];
            return (
              <li key={day}>
                <Link
                  href={calendarHref("week", day)}
                  aria-label={`${formatThaiDate(day, "long")} · ${t("tasksCount", { count: items.length })}`}
                  aria-current={isSelected ? "date" : undefined}
                  className="flex flex-col items-center gap-1.5 rounded-md py-1 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "text-caption font-medium",
                      isToday ? "text-brand-500" : "text-text-secondary",
                    )}
                  >
                    {formatWeekdayNarrow(day)}
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
                    {formatThaiDate(day, "day")}
                  </span>
                  <span className="flex h-1.5 gap-[3px]" aria-hidden="true">
                    {domains.slice(0, MAX_DOTS).map((d) => (
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
            <h2 className="text-h2 text-brand-800">{formatThaiDate(selected, "weekday")}</h2>
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
    <ol className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const items = byDay[day] ?? [];
        const isToday = day === today;
        return (
          <li
            key={day}
            className={cn(
              "rounded-lg bg-bg-surface p-2 shadow-md",
              isToday && "ring-[1.5px] ring-brand-500",
            )}
          >
            <Link
              href={calendarHref("day", day)}
              aria-label={t("openDay", { date: formatThaiDate(day, "long") })}
              className="flex items-baseline justify-between gap-2 rounded-md px-1 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            >
              <span className="text-caption text-text-secondary">{formatWeekdayNarrow(day)}</span>
              <span
                className={cn(
                  "inline-flex min-w-7 justify-center rounded-full px-1.5 text-small font-medium",
                  isToday ? "bg-brand-500 text-neutral-0" : "text-text-primary",
                )}
              >
                {formatThaiDate(day, "day")}
              </span>
            </Link>
            <ul className="mt-2 space-y-1">
              {items.slice(0, MAX_ROWS).map((item) => (
                <li key={item.key} className="flex items-center gap-1.5 text-caption">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      DOMAIN_STYLES[item.task.domain as Domain].dot,
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "truncate",
                      item.done ? "text-text-muted line-through" : "text-text-primary",
                    )}
                  >
                    {item.task.title}
                  </span>
                </li>
              ))}
              {items.length > MAX_ROWS ? (
                <li className="text-caption text-text-secondary">
                  {t("more", { count: items.length - MAX_ROWS })}
                </li>
              ) : null}
              {items.length === 0 ? (
                <li className="text-caption text-text-muted">{t("noTasks")}</li>
              ) : null}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
