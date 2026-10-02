import { describe, expect, it } from "vitest";

import {
  calculateAvailability,
  calculateDayAvailability,
  intervalFromISO,
  intervalFromLocalDate,
  intervalForCalendarEvent,
  intervalMinutes,
  mergeIntervals,
} from "./availability";

describe("availability", () => {
  it("unions overlapping busy intervals before subtracting them", () => {
    const result = calculateAvailability({
      workingWindows: [{ start: 0, end: 8 * 60 * 60_000 }],
      busyIntervals: [
        { start: 60 * 60_000, end: 3 * 60 * 60_000 },
        { start: 2 * 60 * 60_000, end: 4 * 60 * 60_000 },
      ],
      tasks: [{ id: "task-1", estimatedMinutes: 360 }],
    });

    expect(result.busyMinutes).toBe(180);
    expect(result.availableMinutes).toBe(300);
    expect(result.overCapacityMinutes).toBe(60);
  });

  it("does not double-count a task estimate that already has a block", () => {
    const result = calculateAvailability({
      workingWindows: [{ start: 0, end: 180 * 60_000 }],
      taskBlocks: [{ id: "block-1", taskId: "task-1", start: 0, end: 60 * 60_000 }],
      tasks: [{ id: "task-1", estimatedMinutes: 60 }],
    });

    expect(result.plannedBlockMinutes).toBe(60);
    expect(result.linkedTaskMinutes).toBe(60);
    expect(result.unscheduledTaskMinutes).toBe(0);
    expect(result.availableMinutes).toBe(120);
    expect(result.overCapacityMinutes).toBe(0);
  });

  it("handles explicit timezone offsets and an interval crossing midnight", () => {
    const interval = intervalFromISO(
      "2026-09-22T23:00:00+07:00",
      "2026-09-23T01:00:00+07:00",
    );
    expect(Math.round((interval.end - interval.start) / 60_000)).toBe(120);
  });

  it("keeps overlapping working windows from creating capacity twice", () => {
    expect(
      mergeIntervals([
        { start: 0, end: 60 },
        { start: 30, end: 120 },
      ]),
    ).toEqual([{ start: 0, end: 120 }]);
  });

  it("reports blocks that conflict with busy commitments", () => {
    const result = calculateAvailability({
      workingWindows: [{ start: 0, end: 120 * 60_000 }],
      busyIntervals: [{ start: 30 * 60_000, end: 60 * 60_000 }],
      taskBlocks: [{ id: "block-1", taskId: "task-1", start: 45 * 60_000, end: 75 * 60_000 }],
    });

    expect(result.conflictingBlockIds).toEqual(["block-1"]);
  });

  it("converts local working hours using the configured timezone", () => {
    const interval = intervalFromLocalDate("2026-09-22", "09:00", "17:00");
    expect(new Date(interval.start).toISOString()).toBe("2026-09-22T02:00:00.000Z");
    expect(new Date(interval.end).toISOString()).toBe("2026-09-22T10:00:00.000Z");
  });

  it("supports midnight-crossing local windows and all-day events", () => {
    const overnight = intervalFromLocalDate("2026-09-22", "22:00", "02:00");
    expect(intervalMinutes(overnight)).toBe(240);
    const allDay = intervalForCalendarEvent({
      eventDate: "2026-09-22",
      allDay: true,
      startTime: null,
      endTime: null,
    });
    expect(intervalMinutes(allDay!)).toBe(1440);
  });

  it("keeps visible free calendar events out of availability calculations", () => {
    const event = {
      eventDate: "2026-09-22" as const,
      allDay: false,
      startTime: "10:00",
      endTime: "11:00",
      blocksTime: false,
    };

    expect(intervalForCalendarEvent(event)).toBeNull();

    const result = calculateDayAvailability({
      date: event.eventDate,
      timezone: "Asia/Bangkok",
      workingWindows: [{ start: "09:00", end: "17:00" }],
      breakWindows: [],
      events: [event],
      timeBlocks: [],
      tasks: [],
    });
    expect(result.busyMinutes).toBe(0);
    expect(result.availableMinutes).toBe(480);
  });
});
