import { describe, expect, it } from "vitest";

import { getTaskDateDisplay, type TaskDateDisplayItem } from "./task-date-display";

const today = "2026-09-27";

function item(overrides: Partial<TaskDateDisplayItem> = {}): TaskDateDisplayItem {
  return {
    date: today,
    done: false,
    recurring: false,
    task: { due_date: today, planned_date: today, deadline: null },
    ...overrides,
  };
}

describe("getTaskDateDisplay", () => {
  it("keeps an overdue planned date from being presented as a missed deadline", () => {
    const result = getTaskDateDisplay(
      item({
        date: "2026-09-26",
        task: { due_date: "2026-09-26", planned_date: "2026-09-26", deadline: null },
      }),
      today,
    );

    expect(result).toEqual({
      plannedDate: "2026-09-26",
      deadline: null,
      overdueSince: null,
    });
  });

  it("shows a real deadline separately from the planned date", () => {
    const result = getTaskDateDisplay(
      item({
        task: { due_date: "2026-09-27", planned_date: "2026-09-27", deadline: "2026-09-30" },
      }),
      today,
    );

    expect(result).toEqual({
      plannedDate: "2026-09-27",
      deadline: "2026-09-30",
      overdueSince: null,
    });
  });

  it("uses the scheduled occurrence date instead of the recurring series anchor", () => {
    const result = getTaskDateDisplay(
      item({
        date: "2026-09-28",
        recurring: true,
        task: { due_date: "2026-09-01", planned_date: "2026-09-01", deadline: "2026-09-30" },
      }),
      today,
    );

    expect(result).toEqual({
      plannedDate: "2026-09-28",
      deadline: "2026-09-30",
      overdueSince: null,
    });
  });

  it("marks only an open actionable task with a past deadline as overdue", () => {
    const overdueItem = item({
      task: { due_date: today, planned_date: today, deadline: "2026-09-26" },
    });

    expect(getTaskDateDisplay(overdueItem, today).overdueSince).toBe("2026-09-26");
    expect(getTaskDateDisplay({ ...overdueItem, done: true }, today).overdueSince).toBeNull();
    expect(getTaskDateDisplay({ ...overdueItem, skipped: true }, today).overdueSince).toBeNull();
    expect(
      getTaskDateDisplay({ ...overdueItem, actionable: false }, today).overdueSince,
    ).toBeNull();
  });
});
