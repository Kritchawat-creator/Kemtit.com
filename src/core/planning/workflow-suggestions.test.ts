import { describe, expect, it } from "vitest";

import { intervalFromLocalDate } from "./availability";
import { calculateEffectiveAvailableMinutes } from "./capacity";
import {
  defaultDailyPlanBudget,
  orderTasksByPriority,
  suggestTimeBlockSlot,
  suggestTopPriorityTaskIds,
} from "./workflow-suggestions";

describe("daily workflow suggestions", () => {
  it("orders deadlines before plan status and priority, then keeps linked ties stable", () => {
    const date = "2026-10-02";

    expect(
      suggestTopPriorityTaskIds(
        [
          { id: "low", priority: "low" },
          { id: "overdue-no-deadline", overdue: true, priority: "high" },
          { id: "deadline-today", deadline: date, priority: "low" },
          { id: "high", priority: "high" },
          { id: "goal-b", goalId: "goal-b", priority: "normal" },
          { id: "goal-a", goalId: "goal-a", priority: "normal" },
          { id: "deadline-overdue", deadline: "2026-10-01", priority: "low" },
          { id: "deadline-future", deadline: "2026-10-03", priority: "high" },
        ],
        date,
      ),
    ).toEqual(["deadline-overdue", "deadline-today", "overdue-no-deadline"]);

    expect(
      suggestTopPriorityTaskIds(
        [
          { id: "normal-unlinked", priority: "normal" },
          { id: "low-linked", priority: "low", projectId: "project-a" },
          { id: "normal-goal-b", priority: "normal", goalId: "goal-b" },
          { id: "normal-goal-a", priority: "normal", goalId: "goal-a" },
          { id: "high", priority: "high" },
        ],
        date,
      ),
    ).toEqual(["high", "normal-goal-b", "normal-goal-a"]);
  });

  it("deduplicates suggestions using the most urgent occurrence metadata", () => {
    expect(
      suggestTopPriorityTaskIds(
        [
          { id: "repeat", priority: "normal" },
          { id: "other", priority: "high" },
          { id: "repeat", overdue: true, priority: "normal" },
        ],
        "2026-10-02",
      ),
    ).toEqual(["repeat", "other"]);
  });

  it("puts saved choices first and preserves duplicate occurrence rows", () => {
    const firstOccurrence = { id: "recurring", overdue: false, key: "task:2026-10-01" };
    const secondOccurrence = { id: "recurring", overdue: false, key: "task:2026-10-02" };
    const urgentTask = { id: "urgent", deadline: "2026-10-01" };
    const ordered = orderTasksByPriority(
      [urgentTask, firstOccurrence, secondOccurrence],
      "2026-10-02",
      ["recurring"],
    );

    expect(ordered).toEqual([firstOccurrence, secondOccurrence, urgentTask]);
    expect(ordered[0]).toBe(firstOccurrence);
    expect(ordered[1]).toBe(secondOccurrence);
  });

  it("adds planned blocks to the initial budget so they are not subtracted twice", () => {
    const defaultBudget = defaultDailyPlanBudget(420, 60);

    expect(defaultBudget).toBe(480);
    expect(calculateEffectiveAvailableMinutes(defaultBudget, 420, 60)).toBe(420);
    expect(defaultDailyPlanBudget(1400, 100)).toBe(1440);
  });

  it("suggests the earliest future slot that fits the estimate to minute precision", () => {
    const date = "2026-10-02";
    const firstInterval = intervalFromLocalDate(date, "09:00", "09:30");
    const secondInterval = intervalFromLocalDate(date, "10:00", "11:00");

    expect(
      suggestTimeBlockSlot({
        date,
        freeIntervals: [firstInterval, secondInterval],
        durationMinutes: 45,
        now: intervalFromLocalDate(date, "09:15", "09:16").start + 30_000,
      }),
    ).toEqual({
      startAtLocal: `${date}T10:00`,
      endAtLocal: `${date}T10:45`,
      durationMinutes: 45,
    });

    expect(
      suggestTimeBlockSlot({
        date,
        freeIntervals: [intervalFromLocalDate(date, "09:00", "10:00")],
        durationMinutes: 30,
        now: intervalFromLocalDate(date, "09:15", "09:16").start + 30_000,
      }),
    ).toEqual({
      startAtLocal: `${date}T09:16`,
      endAtLocal: `${date}T09:46`,
      durationMinutes: 30,
    });
  });

  it("clips availability to the selected date and reports no slot when nothing fits", () => {
    const date = "2026-10-02";
    const beforeDate = intervalFromLocalDate("2026-10-01", "23:30", "00:30");
    const afterDate = intervalFromLocalDate(date, "23:30", "00:30");

    expect(
      suggestTimeBlockSlot({
        date,
        freeIntervals: [beforeDate, afterDate],
        durationMinutes: 30,
        now: intervalFromLocalDate(date, "00:00", "00:01").start,
      }),
    ).toEqual({
      startAtLocal: `${date}T00:00`,
      endAtLocal: `${date}T00:30`,
      durationMinutes: 30,
    });

    expect(
      suggestTimeBlockSlot({
        date,
        freeIntervals: [afterDate],
        durationMinutes: 60,
        now: intervalFromLocalDate(date, "23:00", "23:01").start,
      }),
    ).toBeNull();
    expect(
      suggestTimeBlockSlot({ date, freeIntervals: [], durationMinutes: 30, now: 0 }),
    ).toBeNull();
  });
});
