import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import type { DayTaskItem, PlanTask } from "@/core/domain/dayplan";
import type { Domain } from "@/core/domain/domains";
import type { ISODate } from "@/lib/date";
import { formatThaiDate, formatWeekdayShort } from "@/lib/format";

import { calendarHref } from "./CalendarNav";
import { DOMAIN_STYLES } from "./DomainTag";

const MAX_ROWS = 4;

type Props = { days: ISODate[]; byDay: Record<ISODate, DayTaskItem<PlanTask>[]>; today: ISODate };

/** สัปดาห์: 7 คอลัมน์บน md+ / เรียงเป็นวันบนมือถือ — task เป็นจุดสี domain + ชื่อ (Design §8.2) */
export function CalendarWeek({ days, byDay, today }: Props) {
  const t = useTranslations("calendar");
  return (
    <ol className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const items = byDay[day] ?? [];
        const isToday = day === today;
        return (
          <li
            key={day}
            className={cn(
              "rounded-lg border bg-bg-surface p-2",
              isToday ? "border-brand-500" : "border-border",
            )}
          >
            <Link
              href={calendarHref("day", day)}
              aria-label={t("openDay", { date: formatThaiDate(day, "long") })}
              className="flex items-baseline justify-between gap-2 rounded-md px-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="text-caption text-text-secondary">{formatWeekdayShort(day)}</span>
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
