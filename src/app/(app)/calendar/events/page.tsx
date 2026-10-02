import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { calendarRange } from "@/core/domain/calendar";
import { listCalendarEvents } from "@/core/calendar-events/queries";
import {
  listExternalCalendarEventDetails,
  listExternalCalendarOperations,
  listExternalCalendarConnections,
} from "@/core/calendar-integrations/queries";
import type { AppLocale } from "@/i18n/config";
import { addDaysISO, isISODate, todayBkk } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { EventManager } from "@/components/calendar/EventManager";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendarEvents");
  return { title: t("title") };
}

export default async function CalendarEventsPage({
  searchParams,
}: PageProps<"/calendar/events">) {
  const params = await searchParams;
  const today = todayBkk();
  const date = typeof params.date === "string" && isISODate(params.date) ? params.date : today;
  const range = calendarRange("month", date);
  const locale = (await getLocale()) as AppLocale;
  const [t, calendarT, events, connections, operations] = await Promise.all([
    getTranslations("calendarEvents"),
    getTranslations("calendar"),
    listCalendarEvents(range.from, range.to),
    listExternalCalendarConnections(),
    listExternalCalendarOperations(20),
  ]);
  const sourceIds = [...new Set(events.flatMap((event) => event.external_source_id ?? []))];
  const externalDetails = sourceIds.length ? await listExternalCalendarEventDetails(sourceIds) : [];
  const previousDate = addDaysISO(range.from, -1);
  const nextDate = addDaysISO(range.to, 1);
  const monthLabel = formatDate(date, "monthYear", locale);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        toolbarStart={
          <nav aria-label={t("dateLabel")} className="flex min-w-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/calendar/events?date=${previousDate}`} aria-label={formatDate(previousDate, "monthYear", locale)}>
                ‹ {formatDate(previousDate, "monthYear", locale)}
              </Link>
            </Button>
            <span className="min-w-0 flex-1 text-center text-small font-medium text-text-primary">
              {monthLabel}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/calendar/events?date=${nextDate}`} aria-label={formatDate(nextDate, "monthYear", locale)}>
                {formatDate(nextDate, "monthYear", locale)} ›
              </Link>
            </Button>
          </nav>
        }
        toolbarEnd={
          <Button variant="outline" asChild>
            <Link href={`/calendar?view=month&date=${date}`}>{calendarT("title")}</Link>
          </Button>
        }
      />
      <EventManager
        date={date}
        events={events}
        connections={connections}
        externalDetails={externalDetails}
        operations={operations}
      />
    </>
  );
}
