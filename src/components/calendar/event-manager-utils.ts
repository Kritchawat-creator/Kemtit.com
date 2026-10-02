import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

import type { CalendarEventValue } from "@/core/calendar-integrations/provider";
import { APP_TIME_ZONE } from "@/i18n/config";
import { addDaysISO, isISODate } from "@/lib/date";

export type EventDraft = {
  title: string;
  allDay: boolean;
  blocksTime: boolean;
  startDate: string;
  lastDay: string;
  startLocal: string;
  endLocal: string;
};

export type EventDraftField = keyof EventDraft;

export type LocalEventDraft = {
  title: string;
  eventDate: string;
  allDay: boolean;
  blocksTime: boolean;
  startTime: string | null;
  endTime: string | null;
};

const LOCAL_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;

function atLocalTime(date: string, time: string): string {
  return `${date}T${time}`;
}

function instantToLocalInput(value: string): string {
  return formatInTimeZone(new Date(value), APP_TIME_ZONE, "yyyy-MM-dd'T'HH:mm");
}

function localInputToInstant(value: string): string | null {
  if (!LOCAL_DATETIME_PATTERN.test(value) || !isISODate(value.slice(0, 10))) return null;
  const date = fromZonedTime(value, APP_TIME_ZONE);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function emptyEventDraft(date: string): EventDraft {
  return {
    title: "",
    allDay: true,
    blocksTime: true,
    startDate: date,
    lastDay: date,
    startLocal: atLocalTime(date, "09:00"),
    endLocal: atLocalTime(date, "09:30"),
  };
}

export function eventDraftFromProvider(value: CalendarEventValue): EventDraft {
  if (value.allDay) {
    return {
      title: value.title,
      allDay: true,
      blocksTime: value.blocksTime,
      startDate: value.start,
      lastDay: addDaysISO(value.end, -1),
      startLocal: atLocalTime(value.start, "09:00"),
      endLocal: atLocalTime(addDaysISO(value.end, -1), "09:30"),
    };
  }

  const startLocal = instantToLocalInput(value.start);
  const endLocal = instantToLocalInput(value.end);
  return {
    title: value.title,
    allDay: false,
    blocksTime: value.blocksTime,
    startDate: startLocal.slice(0, 10),
    lastDay: endLocal.slice(0, 10),
    startLocal,
    endLocal,
  };
}

export function eventDraftFromLocal(value: LocalEventDraft): EventDraft {
  const startTime = value.startTime?.slice(0, 5) || "09:00";
  const endTime = value.endTime?.slice(0, 5) || "09:30";
  return {
    title: value.title,
    allDay: value.allDay,
    blocksTime: value.blocksTime,
    startDate: value.eventDate,
    lastDay: value.eventDate,
    startLocal: atLocalTime(value.eventDate, startTime),
    endLocal: atLocalTime(value.eventDate, endTime),
  };
}

export function updateDraftScheduleMode(draft: EventDraft, allDay: boolean): EventDraft {
  if (draft.allDay === allDay) return draft;
  if (allDay) {
    return {
      ...draft,
      allDay,
      startDate: draft.startLocal.slice(0, 10),
      lastDay: draft.endLocal.slice(0, 10),
    };
  }
  return {
    ...draft,
    allDay,
    startLocal: atLocalTime(draft.startDate, "09:00"),
    endLocal: atLocalTime(draft.lastDay, "09:30"),
  };
}

export function providerValueFromDraft(draft: EventDraft): CalendarEventValue | null {
  if (draft.allDay) {
    if (!isISODate(draft.startDate) || !isISODate(draft.lastDay) || draft.lastDay < draft.startDate) {
      return null;
    }
    return {
      title: draft.title.trim(),
      start: draft.startDate,
      end: addDaysISO(draft.lastDay, 1),
      allDay: true,
      blocksTime: draft.blocksTime,
    };
  }

  const start = localInputToInstant(draft.startLocal);
  const end = localInputToInstant(draft.endLocal);
  if (!start || !end || new Date(end).getTime() <= new Date(start).getTime()) return null;
  return {
    title: draft.title.trim(),
    start,
    end,
    allDay: false,
    blocksTime: draft.blocksTime,
  };
}

export function localDraftFromEvent(draft: EventDraft): LocalEventDraft | null {
  const eventDate = draft.allDay ? draft.startDate : draft.startLocal.slice(0, 10);
  if (!isISODate(eventDate)) return null;

  if (draft.allDay) {
    if (!isISODate(draft.lastDay) || draft.lastDay !== draft.startDate) return null;
    return {
      title: draft.title.trim(),
      eventDate,
      allDay: true,
      blocksTime: draft.blocksTime,
      startTime: null,
      endTime: null,
    };
  }

  if (
    draft.startLocal.slice(0, 10) !== eventDate ||
    draft.endLocal.slice(0, 10) !== eventDate ||
    !LOCAL_DATETIME_PATTERN.test(draft.startLocal) ||
    !LOCAL_DATETIME_PATTERN.test(draft.endLocal) ||
    draft.endLocal.slice(11) <= draft.startLocal.slice(11)
  ) {
    return null;
  }

  return {
    title: draft.title.trim(),
    eventDate,
    allDay: false,
    blocksTime: draft.blocksTime,
    startTime: draft.startLocal.slice(11),
    endTime: draft.endLocal.slice(11),
  };
}

export function providerPatchFromDraft(
  draft: EventDraft,
  dirtyFields: ReadonlySet<EventDraftField>,
): Partial<CalendarEventValue> {
  const patch: Partial<CalendarEventValue> = {};
  const scheduleModeChanged = dirtyFields.has("allDay");

  if (dirtyFields.has("title")) patch.title = draft.title.trim();
  if (scheduleModeChanged) patch.allDay = draft.allDay;
  if (dirtyFields.has("blocksTime")) patch.blocksTime = draft.blocksTime;

  if (draft.allDay) {
    if (scheduleModeChanged || dirtyFields.has("startDate")) patch.start = draft.startDate;
    if (scheduleModeChanged || dirtyFields.has("lastDay")) {
      patch.end = addDaysISO(draft.lastDay, 1);
    }
  } else {
    if (scheduleModeChanged || dirtyFields.has("startLocal")) {
      const start = localInputToInstant(draft.startLocal);
      if (start) patch.start = start;
    }
    if (scheduleModeChanged || dirtyFields.has("endLocal")) {
      const end = localInputToInstant(draft.endLocal);
      if (end) patch.end = end;
    }
  }

  return patch;
}

export function validateEventDraft(
  draft: EventDraft,
  options: { localDestination: boolean; titleChanged: boolean; scheduleChanged?: boolean },
): string | null {
  if ((options.localDestination || options.titleChanged) && !draft.title.trim()) return "required";
  if (options.titleChanged && draft.title.trim().length > 200) return "tooLong";
  if (options.scheduleChanged === false) return null;

  if (draft.allDay) {
    if (!isISODate(draft.startDate) || !isISODate(draft.lastDay)) return "invalidDate";
    if (draft.lastDay < draft.startDate) return "invalidDate";
    if (options.localDestination && draft.lastDay !== draft.startDate) return "localSingleDay";
    return null;
  }

  if (!LOCAL_DATETIME_PATTERN.test(draft.startLocal) || !LOCAL_DATETIME_PATTERN.test(draft.endLocal)) {
    return "invalidTime";
  }
  if (!isISODate(draft.startLocal.slice(0, 10)) || !isISODate(draft.endLocal.slice(0, 10))) {
    return "invalidDate";
  }
  if (draft.endLocal <= draft.startLocal) return "invalidTimeRange";
  if (options.localDestination && draft.startLocal.slice(0, 10) !== draft.endLocal.slice(0, 10)) {
    return "localSingleDay";
  }
  return null;
}
