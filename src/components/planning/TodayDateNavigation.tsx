import { CalendarDays, ChevronLeft, ChevronRight, Download } from "@/components/icons/ui-icons";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { Scope } from "@/core/profile/scope";
import { addDaysISO, eachDayISO, endOfWeekISO, startOfWeekISO, type ISODate } from "@/lib/date";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

type Props = {
  selectedDate: ISODate;
  today: ISODate;
  scope: Scope;
  locale: AppLocale;
};

function dateHref(date: ISODate, scope: Scope) {
  return `/today?date=${date}&scope=${scope}`;
}

function printHref(view: "daily" | "weekly", date: ISODate, scope: Scope) {
  return `/today/print/${view}?date=${date}&scope=${scope}`;
}

export async function TodayDateNavigation({ selectedDate, today, scope, locale }: Props) {
  const t = await getTranslations();
  const daily = await getTranslations("lifePlannerDaily");
  const print = await getTranslations("plannerPrint");
  const weekDates = eachDayISO(startOfWeekISO(selectedDate), endOfWeekISO(selectedDate));
  const weekdayFormatter = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });

  return (
    <section
      className="mb-5 rounded-xl border border-border bg-bg-surface p-3 shadow-xs sm:p-4"
      aria-label={daily("weekNavigation")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={dateHref(addDaysISO(selectedDate, -1), scope)}
            aria-label={daily("previousDay")}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0">
            <p className="text-caption font-medium text-text-secondary">
              {selectedDate === today ? t("today.title") : daily("selectedDay")}
            </p>
            <p className="text-body font-semibold break-words text-text-primary">
              {formatDate(selectedDate, "longWeekday", locale)}
            </p>
          </div>
          <Link
            href={dateHref(addDaysISO(selectedDate, 1), scope)}
            aria-label={daily("nextDay")}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
          {selectedDate !== today ? (
            <Link
              href={dateHref(today, scope)}
              className="ml-1 inline-flex min-h-10 items-center rounded-md px-3 text-small font-semibold text-brand-700 hover:bg-brand-50 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            >
              {t("today.title")}
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action="/today" method="get" className="flex items-center gap-2">
            <input type="hidden" name="scope" value={scope} />
            <label className="sr-only" htmlFor="today-date-picker">
              {daily("chooseDate")}
            </label>
            <input
              id="today-date-picker"
              type="date"
              name="date"
              key={selectedDate}
              defaultValue={selectedDate}
              className="h-10 max-w-[10.5rem] rounded-md border border-border bg-bg-surface px-2 text-small text-text-primary focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-small font-medium text-text-primary transition-colors hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              {daily("goToDate")}
            </button>
          </form>
          <Link
            href={printHref("daily", selectedDate, scope)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-small font-medium text-text-primary transition-colors hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
          >
            <Download className="size-4" aria-hidden="true" />
            {print("dailyTitle")}
          </Link>
          <Link
            href={printHref("weekly", selectedDate, scope)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-small font-medium text-text-primary transition-colors hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
          >
            <Download className="size-4" aria-hidden="true" />
            {print("weeklyTitle")}
          </Link>
        </div>
      </div>

      <nav className="mt-3 grid grid-cols-7 gap-1" aria-label={daily("weekNavigation")}>
        {weekDates.map((date) => {
          const selected = date === selectedDate;
          const isToday = date === today;
          const accessibleDate = `${weekdayFormatter.format(new Date(`${date}T12:00:00Z`))} ${formatDate(date, "long", locale)}${isToday ? ` · ${t("today.title")}` : ""}`;
          return (
            <Link
              key={date}
              href={dateHref(date, scope)}
              aria-label={accessibleDate}
              aria-current={selected ? "date" : undefined}
              className={`flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center rounded-md border px-1 py-1.5 text-center transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none ${
                selected
                  ? "border-brand-700 bg-brand-700 text-white"
                  : isToday
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-transparent text-text-secondary hover:border-border hover:bg-bg-subtle"
              }`}
            >
              <span className="text-[0.65rem] leading-4">
                {weekdayFormatter.format(new Date(`${date}T12:00:00Z`))}
              </span>
              <span className="text-small leading-5 font-semibold">
                {formatDate(date, "day", locale)}
              </span>
              {isToday && !selected ? (
                <span className="text-[0.6rem] leading-3">{t("today.title")}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
