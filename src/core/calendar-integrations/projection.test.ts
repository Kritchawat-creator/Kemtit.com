import { describe, expect, it } from "vitest";

import type { CalendarProviderEvent } from "./provider";
import { projectProviderEvent } from "./projection";

function providerEvent(
  overrides: Partial<CalendarProviderEvent> = {},
): CalendarProviderEvent {
  return {
    externalId: "provider-event-1",
    title: "Planning",
    start: "2026-09-27T09:00:00+07:00",
    end: "2026-09-27T10:00:00+07:00",
    allDay: false,
    blocksTime: true,
    etag: "etag-1",
    operationId: null,
    kind: "single",
    ...overrides,
  };
}

describe("projectProviderEvent", () => {
  const bounds = { startDate: "2026-09-26", endDateExclusive: "2026-09-29" } as const;

  it("creates one row per all-day date and treats the provider end as exclusive", () => {
    const projections = projectProviderEvent(
      providerEvent({ start: "2026-09-27", end: "2026-09-29", allDay: true }),
      bounds,
    );

    expect(projections.map((row) => row.event_date)).toEqual(["2026-09-27", "2026-09-28"]);
    expect(projections.every((row) => row.all_day && row.start_time === null)).toBe(true);
  });

  it("splits a timed event across app-local midnight without changing its busy state", () => {
    const projections = projectProviderEvent(
      providerEvent({
        start: "2026-09-27T16:30:00Z",
        end: "2026-09-27T18:30:00Z",
        blocksTime: false,
      }),
      bounds,
    );

    expect(projections).toEqual([
      {
        event_date: "2026-09-27",
        title: "Planning",
        all_day: false,
        start_time: "23:30:00",
        end_time: "24:00:00",
        blocks_time: false,
      },
      {
        event_date: "2026-09-28",
        title: "Planning",
        all_day: false,
        start_time: "00:00:00",
        end_time: "01:30:00",
        blocks_time: false,
      },
    ]);
  });

  it("bounds projections while retaining the full source title outside the projection", () => {
    const title = "A".repeat(240);
    const projections = projectProviderEvent(
      providerEvent({
        title,
        start: "2026-09-25T16:30:00Z",
        end: "2026-09-28T18:30:00Z",
      }),
      bounds,
    );

    expect(projections.map((row) => row.event_date)).toEqual(["2026-09-26", "2026-09-27", "2026-09-28"]);
    expect(projections[0].title).toHaveLength(200);
    expect(title).toHaveLength(240);
  });
});
