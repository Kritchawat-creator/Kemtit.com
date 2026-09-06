import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { CALENDAR_VIEWS, shiftCalendarDate, type CalendarView } from "@/core/domain/calendar";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { SegmentedNav } from "@/components/ui/segmented-nav";

type Props = { view: CalendarView; date: ISODate; today: ISODate; label?: string };

export function calendarHref(view: CalendarView, date: ISODate) {
  return `/calendar?view=${view}&date=${date}`;
}

/**
 * สลับมุมมอง + เลื่อนช่วง (Claude Design 3m): segmented control เต็มความกว้าง → แถวลูกศร ‹ ช่วงที่ดู › พร้อมลิงก์ "วันนี้"
 * ใช้ลิงก์เพื่อให้ back/forward และ SSR ทำงาน
 */
export function CalendarNav({ view, date, today, label }: Props) {
  const t = useTranslations("calendar");
  return (
    <div className="space-y-2">
      <SegmentedNav
        label={t("views.label")}
        items={CALENDAR_VIEWS.map((v) => ({
          key: v,
          href: calendarHref(v, date),
          label: t(`views.${v}`),
          active: view === v,
        }))}
      />
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" className="text-brand-800" asChild>
          <Link
            href={calendarHref(view, shiftCalendarDate(view, date, -1))}
            aria-label={t("nav.prev")}
          >
            <ChevronLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          {label ? (
            <span className="max-w-full truncate text-base font-medium text-brand-800">
              {label}
            </span>
          ) : null}
          {date !== today ? (
            <Link
              href={calendarHref(view, today)}
              className="rounded-full px-2 text-caption font-medium text-brand-600 hover:underline focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            >
              {t("nav.today")}
            </Link>
          ) : (
            <Link
              href={calendarHref(view, today)}
              className="rounded-full px-2 text-caption text-text-secondary focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            >
              {t("nav.today")}
            </Link>
          )}
        </div>
        <Button variant="ghost" size="icon" className="text-brand-800" asChild>
          <Link
            href={calendarHref(view, shiftCalendarDate(view, date, 1))}
            aria-label={t("nav.next")}
          >
            <ChevronRight className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
