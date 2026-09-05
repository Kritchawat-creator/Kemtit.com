import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import type { DayTaskItem, PlanTask } from "@/core/domain/dayplan";
import type { Domain } from "@/core/domain/domains";
import { type ISODate, startOfMonthISO } from "@/lib/date";
import { formatThaiDate, formatWeekdayShort } from "@/lib/format";

import { calendarHref } from "./CalendarNav";
import { DOMAIN_STYLES } from "./DomainTag";

const MAX_DOTS = 4;

type Props = { date: ISODate; weeks: ISODate[][]; byDay: Record<ISODate, DayTaskItem<PlanTask>[]>; today: ISODate };

/** เดือน: grid 7 คอลัมน์เริ่มอาทิตย์ แต่ละวันมีจุดสี domain + จำนวนงาน แตะ → มุมมองวัน (Design §8.2 "วันไหนแน่น วันไหนว่าง") */
export function CalendarMonth({ date, weeks, byDay, today }: Props) {
  const t = useTranslations("calendar");
  const monthStart = startOfMonthISO(date);
  const headerDays = weeks[0] ?? [];

  return (
    <div className="rounded-lg border border-border bg-bg-surface p-2">
      <div className="grid grid-cols-7 gap-1" aria-hidden="true">
        {headerDays.map((day) => (
          <div key={day} className="py-1 text-center text-caption text-text-secondary">
            {formatWeekdayShort(day)}
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
                  "flex min-h-14 flex-col items-center gap-1 rounded-md p-1 transition-colors hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-20 md:items-start md:p-2",
                  !inMonth && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full text-small font-medium",
                    isToday ? "bg-brand-500 text-neutral-0" : "text-text-primary",
                  )}
                >
                  {formatThaiDate(day, "day")}
                </span>
                {items.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-0.5">
                    {domains.slice(0, MAX_DOTS).map((d) => (
                      <span key={d} className={cn("size-1.5 rounded-full", DOMAIN_STYLES[d].dot)} aria-hidden="true" />
                    ))}
                    <span className="ml-0.5 hidden text-caption text-text-secondary md:inline">{t("tasksCount", { count: items.length })}</span>
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
