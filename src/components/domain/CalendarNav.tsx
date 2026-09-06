import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import { CALENDAR_VIEWS, shiftCalendarDate, type CalendarView } from "@/core/domain/calendar";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { SegmentedNav } from "@/components/ui/segmented-nav";

export function calendarHref(view: CalendarView, date: ISODate) {
  return `/calendar?view=${view}&date=${date}`;
}

/** segmented control วัน/สัปดาห์/เดือน (Claude Design 3m/4d) — ใช้ลิงก์เพื่อให้ back/forward และ SSR ทำงาน */
export function CalendarViewNav({ view, date }: { view: CalendarView; date: ISODate }) {
  const t = useTranslations("calendar");
  return (
    <SegmentedNav
      label={t("views.label")}
      items={CALENDAR_VIEWS.map((v) => ({
        key: v,
        href: calendarHref(v, date),
        label: t(`views.${v}`),
        active: view === v,
      }))}
    />
  );
}

type RangeProps = {
  view: CalendarView;
  date: ISODate;
  today: ISODate;
  label: string;
  /** desktop = แถวเดียวใน toolbar (‹ ป้าย › + ปุ่ม "วันนี้" แบบ outline) · mobile = ‹ ป้าย + ลิงก์วันนี้ใต้ป้าย › */
  layout?: "mobile" | "desktop";
  className?: string;
};

/** เลื่อนช่วง ‹ › + ป้ายช่วงที่ดู + กลับวันนี้ */
export function CalendarRangeNav({
  view,
  date,
  today,
  label,
  layout = "mobile",
  className,
}: RangeProps) {
  const t = useTranslations("calendar");
  const prev = (
    <Button variant="ghost" size="icon" className="text-brand-800" asChild>
      <Link href={calendarHref(view, shiftCalendarDate(view, date, -1))} aria-label={t("nav.prev")}>
        <ChevronLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </Button>
  );
  const next = (
    <Button variant="ghost" size="icon" className="text-brand-800" asChild>
      <Link href={calendarHref(view, shiftCalendarDate(view, date, 1))} aria-label={t("nav.next")}>
        <ChevronRight className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </Button>
  );

  if (layout === "desktop") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-1">
          {prev}
          <span className="min-w-36 text-center text-h3 text-brand-800">{label}</span>
          {next}
        </div>
        <Button variant="outline" asChild>
          <Link href={calendarHref(view, today)}>{t("nav.today")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {prev}
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <span className="max-w-full truncate text-base font-medium text-brand-800">{label}</span>
        <Link
          href={calendarHref(view, today)}
          className={cn(
            "rounded-full px-2 text-caption font-medium focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none",
            date !== today ? "text-brand-600 hover:underline" : "text-text-secondary",
          )}
        >
          {t("nav.today")}
        </Link>
      </div>
      {next}
    </div>
  );
}
