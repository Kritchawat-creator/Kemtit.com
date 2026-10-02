import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { addDaysISO, APP_TIME_ZONE, isISODate, type ISODate } from "@/lib/date";

import type { CalendarProviderEvent } from "./provider";

export type CalendarProjectionBounds = {
  startDate: ISODate;
  endDateExclusive: ISODate;
};

export type CalendarEventProjection = {
  event_date: ISODate;
  title: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  blocks_time: boolean;
};

const EXPLICIT_INSTANT = /(?:Z|[+-]\d{2}:\d{2})$/i;

function requireDate(value: string): ISODate {
  if (!isISODate(value)) throw new RangeError("invalid calendar date");
  return value;
}

function requireInstant(value: string): number {
  if (!EXPLICIT_INSTANT.test(value)) throw new RangeError("calendar instant requires an offset");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new RangeError("invalid calendar instant");
  return timestamp;
}

function dayStart(date: ISODate): number {
  return fromZonedTime(`${date}T00:00:00`, APP_TIME_ZONE).getTime();
}

function displayTitle(title: string): string {
  const trimmed = title.trim();
  return Array.from(trimmed || "Calendar event").slice(0, 200).join("");
}

function dateRange(
  start: ISODate,
  endExclusive: ISODate,
  bounds: CalendarProjectionBounds,
): ISODate[] {
  const first = start > bounds.startDate ? start : bounds.startDate;
  const lastExclusive = endExclusive < bounds.endDateExclusive ? endExclusive : bounds.endDateExclusive;
  const dates: ISODate[] = [];
  for (let date = first; date < lastExclusive; date = addDaysISO(date, 1)) dates.push(date);
  return dates;
}

/** Split one canonical provider event into bounded, app-timezone day projections. */
export function projectProviderEvent(
  event: CalendarProviderEvent,
  bounds: CalendarProjectionBounds,
): CalendarEventProjection[] {
  const startBound = requireDate(bounds.startDate);
  const endBound = requireDate(bounds.endDateExclusive);
  if (endBound <= startBound) throw new RangeError("invalid calendar projection bounds");

  const title = displayTitle(event.title);
  if (event.allDay) {
    const start = requireDate(event.start);
    const endExclusive = requireDate(event.end);
    if (endExclusive <= start) throw new RangeError("invalid all-day calendar event");
    return dateRange(start, endExclusive, { startDate: startBound, endDateExclusive: endBound }).map(
      (eventDate) => ({
        event_date: eventDate,
        title,
        all_day: true,
        start_time: null,
        end_time: null,
        blocks_time: event.blocksTime,
      }),
    );
  }

  const start = requireInstant(event.start);
  const end = requireInstant(event.end);
  if (end <= start) throw new RangeError("invalid timed calendar event");

  const firstDate = formatInTimeZone(start, APP_TIME_ZONE, "yyyy-MM-dd");
  const lastDate = formatInTimeZone(end - 1, APP_TIME_ZONE, "yyyy-MM-dd");
  const dates = dateRange(firstDate, addDaysISO(lastDate, 1), {
    startDate: startBound,
    endDateExclusive: endBound,
  });

  return dates.flatMap((eventDate) => {
    const startOfDay = dayStart(eventDate);
    const endOfDay = dayStart(addDaysISO(eventDate, 1));
    const segmentStart = Math.max(start, startOfDay);
    const segmentEnd = Math.min(end, endOfDay);
    if (segmentEnd <= segmentStart) return [];

    return [
      {
        event_date: eventDate,
        title,
        all_day: false,
        start_time:
          segmentStart === startOfDay
            ? "00:00:00"
            : formatInTimeZone(segmentStart, APP_TIME_ZONE, "HH:mm:ss"),
        end_time:
          segmentEnd === endOfDay
            ? "24:00:00"
            : formatInTimeZone(segmentEnd, APP_TIME_ZONE, "HH:mm:ss"),
        blocks_time: event.blocksTime,
      },
    ];
  });
}
