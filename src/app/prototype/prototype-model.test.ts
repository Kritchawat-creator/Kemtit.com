import { describe, expect, it } from "vitest";

import {
  INITIAL_PROTOTYPE_GOALS,
  INITIAL_PROTOTYPE_LEDGER,
  INITIAL_PROTOTYPE_RECORDS,
  INITIAL_PROTOTYPE_TIME_BLOCKS,
  findPrototypeTimeSlot,
  getPrototypeCapacity,
  getPrototypeMonthCells,
  getPrototypeMetrics,
  getPrototypeUpcomingRecords,
  getRecordsInScope,
  parsePrototypeDate,
  shiftPrototypeDays,
  shiftPrototypeMonths,
} from "./prototype-model";

describe("prototype date helpers", () => {
  it("accepts complete valid dates and rejects impossible calendar dates", () => {
    expect(parsePrototypeDate("2028-02-29")?.getDate()).toBe(29);
    expect(parsePrototypeDate("2026-02-29")).toBeNull();
    expect(parsePrototypeDate("2026-13-01")).toBeNull();
    expect(parsePrototypeDate("2026-9-24")).toBeNull();
    expect(parsePrototypeDate("0099-01-01")).toBeNull();
  });

  it("moves across year boundaries and clamps month changes to the last valid day", () => {
    expect(shiftPrototypeDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftPrototypeMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftPrototypeMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(shiftPrototypeMonths("2026-12-31", 1)).toBe("2027-01-31");
  });

  it("builds a leap-year month grid with a consistent Monday start", () => {
    const cells = getPrototypeMonthCells("2028-02-29");

    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe("2028-02-01");
    expect(cells.filter(Boolean)).toHaveLength(29);
    expect([...cells].reverse().find(Boolean)).toBe("2028-02-29");
    expect(cells.length % 7).toBe(0);
  });
});

describe("prototype fixture projections", () => {
  it("uses one scope selector for items, goals, and ledger values", () => {
    const records = [
      { id: "work-item", scope: "work" as const },
      { id: "life-item", scope: "life" as const },
      { id: "unassigned-item", scope: "unassigned" as const },
    ];

    expect(getRecordsInScope(records, "work").map((record) => record.id)).toEqual(["work-item"]);
    expect(getRecordsInScope(records, "all")).toHaveLength(3);
  });

  it("tracks completion by stable record ID when titles are identical", () => {
    const duplicateTitleTasks = [
      {
        id: "task-first",
        type: "task" as const,
        title: "Review the plan",
        date: "2026-09-24" as const,
        scope: "work" as const,
        tone: "work" as const,
        durationMinutes: 30,
      },
      {
        id: "task-second",
        type: "task" as const,
        title: "Review the plan",
        date: "2026-09-24" as const,
        scope: "work" as const,
        tone: "work" as const,
        durationMinutes: 45,
      },
    ];
    const metrics = getPrototypeMetrics(
      duplicateTitleTasks,
      [],
      [],
      "2026-09-24",
      "all",
      new Set(["task-second"]),
    );

    expect(metrics.taskCount).toBe(2);
    expect(metrics.completedCount).toBe(1);
    expect(metrics.focusMinutes).toBe(75);
  });

  it("derives day metrics and upcoming items from the selected date and shared scope", () => {
    const workMetrics = getPrototypeMetrics(
      INITIAL_PROTOTYPE_RECORDS,
      INITIAL_PROTOTYPE_GOALS,
      INITIAL_PROTOTYPE_LEDGER,
      "2026-09-24",
      "work",
      new Set(),
    );
    const lifeMetrics = getPrototypeMetrics(
      INITIAL_PROTOTYPE_RECORDS,
      INITIAL_PROTOTYPE_GOALS,
      INITIAL_PROTOTYPE_LEDGER,
      "2026-09-24",
      "life",
      new Set(),
    );
    const workUpcoming = getPrototypeUpcomingRecords(
      INITIAL_PROTOTYPE_RECORDS,
      "2026-09-24",
      "work",
    );
    const nextDayMetrics = getPrototypeMetrics(
      INITIAL_PROTOTYPE_RECORDS,
      INITIAL_PROTOTYPE_GOALS,
      INITIAL_PROTOTYPE_LEDGER,
      "2026-09-25",
      "work",
      new Set(),
    );

    expect(workMetrics.taskCount).toBe(1);
    expect(workMetrics.monthlyBalance).toBeNull();
    expect(lifeMetrics.taskCount).toBe(0);
    expect(lifeMetrics.monthlyBalance).toBe(12450);
    expect(workUpcoming.map((record) => record.id)).toEqual(["task-kemtit-redesign", "task-roadmap"]);
    expect(nextDayMetrics.taskCount).toBe(1);
  });

  it("keeps metrics unavailable when a scope has no source data", () => {
    const metrics = getPrototypeMetrics([], [], [], "2026-09-24", "life", new Set());

    expect(metrics.taskCount).toBe(0);
    expect(metrics.goalProgress).toBeNull();
    expect(metrics.monthlyBalance).toBeNull();
  });

  it("keeps Inbox items out of the active day projection", () => {
    const metrics = getPrototypeMetrics(
      INITIAL_PROTOTYPE_RECORDS,
      INITIAL_PROTOTYPE_GOALS,
      INITIAL_PROTOTYPE_LEDGER,
      "2026-09-24",
      "work",
      new Set(),
    );

    expect(INITIAL_PROTOTYPE_RECORDS.some((record) => record.status === "inbox")).toBe(true);
    expect(metrics.taskCount).toBe(1);
  });

  it("calculates capacity from fixed events and task time blocks without double-counting overlap", () => {
    const capacity = getPrototypeCapacity(
      INITIAL_PROTOTYPE_RECORDS,
      INITIAL_PROTOTYPE_TIME_BLOCKS,
      "2026-09-24",
    );

    expect(capacity.totalMinutes).toBe(540);
    expect(capacity.bookedMinutes).toBeGreaterThan(0);
    expect(capacity.freeMinutes).toBeLessThan(capacity.totalMinutes);
    expect(findPrototypeTimeSlot(
      INITIAL_PROTOTYPE_RECORDS,
      INITIAL_PROTOTYPE_TIME_BLOCKS,
      "2026-09-24",
      45,
    )).toBe("09:30");
  });
});
