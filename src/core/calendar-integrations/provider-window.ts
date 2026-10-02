import type { CalendarEventValue, CalendarEventWindow } from "./provider";

/** Build a provider query window from the canonical value used by reconciliation. */
export function providerReadbackWindow(value: CalendarEventValue): CalendarEventWindow {
  if (value.allDay) {
    return {
      start: new Date(`${value.start}T00:00:00.000Z`).toISOString(),
      end: new Date(`${value.end}T00:00:00.000Z`).toISOString(),
    };
  }

  return {
    start: new Date(value.start).toISOString(),
    end: new Date(value.end).toISOString(),
  };
}
