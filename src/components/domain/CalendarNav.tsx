import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import { CALENDAR_VIEWS, shiftCalendarDate, type CalendarView } from "@/core/domain/calendar";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";

type Props = { view: CalendarView; date: ISODate; today: ISODate };

export function calendarHref(view: CalendarView, date: ISODate) {
  return `/calendar?view=${view}&date=${date}`;
}

/** สลับมุมมอง + เลื่อนช่วง (Design §8.2 ปฏิทิน: PeriodSwitcher → grid) — ใช้ลิงก์เพื่อให้ back/forward และ SSR ทำงาน */
export function CalendarNav({ view, date, today }: Props) {
  const t = useTranslations("calendar");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label={t("views.label")} className="inline-flex rounded-md border border-border bg-bg-surface p-0.5">
        {CALENDAR_VIEWS.map((v) => (
          <Link
            key={v}
            href={calendarHref(v, date)}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-sm px-4 text-small transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:min-h-8",
              view === v ? "bg-brand-50 font-medium text-brand-800" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {t(`views.${v}`)}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" asChild>
          <Link href={calendarHref(view, shiftCalendarDate(view, date, -1))} aria-label={t("nav.prev")}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={calendarHref(view, today)}>{t("nav.today")}</Link>
        </Button>
        <Button variant="outline" size="icon" asChild>
          <Link href={calendarHref(view, shiftCalendarDate(view, date, 1))} aria-label={t("nav.next")}>
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
