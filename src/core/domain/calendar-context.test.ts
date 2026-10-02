import { describe, expect, it } from "vitest";

import { calendarContextByDay } from "./calendar-context";

describe("calendarContextByDay", () => {
  it("groups canonical events, bills, and time blocks by their local calendar date", () => {
    const event = {
      id: "event-26",
      title: "QA26 Calendar event",
      event_date: "2026-09-26",
      all_day: true,
      start_time: null,
      end_time: null,
    };
    const bill = {
      id: "bill-26",
      title: "QA26 bill",
      due_date: "2026-09-26",
      status: "due",
      amount: 500,
    };
    const block = {
      id: "block-26",
      title: "QA26 time block",
      start_at: "2026-09-25T18:00:00.000Z",
      end_at: "2026-09-25T18:30:00.000Z",
    };

    const byDay = calendarContextByDay([event], [bill], [block]);

    expect(byDay["2026-09-26"]).toEqual({
      events: [event],
      bills: [bill],
      timeBlocks: [block],
    });
    expect(byDay["2026-09-25"]).toBeUndefined();
    expect(byDay["2026-09-26"]?.events[0]).toBe(event);
    expect(byDay["2026-09-26"]?.bills[0]).toBe(bill);
    expect(byDay["2026-09-26"]?.timeBlocks[0]).toBe(block);
  });
});
