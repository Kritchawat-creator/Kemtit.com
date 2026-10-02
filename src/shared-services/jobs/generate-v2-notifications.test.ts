import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getV2DailyBriefInputs: vi.fn(),
  getV2HabitReminderInputs: vi.fn(),
  listV2InvestmentReminderGoals: vi.fn(),
  listV2NotificationCandidates: vi.fn(),
  insertEventAsAdminOnce: vi.fn(),
}));

vi.mock("@/core/notifications/admin", () => ({
  getV2DailyBriefInputs: mocks.getV2DailyBriefInputs,
  getV2HabitReminderInputs: mocks.getV2HabitReminderInputs,
  listV2InvestmentReminderGoals: mocks.listV2InvestmentReminderGoals,
  listV2NotificationCandidates: mocks.listV2NotificationCandidates,
}));

vi.mock("@/core/events/admin", () => ({
  insertEventAsAdminOnce: mocks.insertEventAsAdminOnce,
}));

import { generateV2Notifications } from "./generate-v2-notifications";

describe("generateV2Notifications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a daily brief with the existing date-scoped idempotency key", async () => {
    mocks.listV2NotificationCandidates.mockResolvedValue([
      {
        id: "user-1",
        active_persona: "office",
        work_mode: "professional",
        notify_daily_brief: true,
        notify_weekly_review: false,
        notify_habits: false,
        notify_investment: false,
      },
    ]);
    mocks.getV2DailyBriefInputs.mockResolvedValue({
      plan: { available_minutes: 480, top_priorities: ["task-1", "missing-task"] },
      priorityTasks: [{ id: "task-1", title: "Prepare proposal", estimated_minutes: 45 }],
      workGoal: null,
    });
    mocks.insertEventAsAdminOnce.mockResolvedValue("created");

    const summary = await generateV2Notifications("morning", "2026-09-21", "user-0");

    expect(mocks.listV2NotificationCandidates).toHaveBeenCalledWith("morning", "user-0", 25);
    expect(mocks.getV2DailyBriefInputs).toHaveBeenCalledWith(
      "user-1",
      "2026-09-21",
      "professional",
    );
    expect(mocks.insertEventAsAdminOnce).toHaveBeenCalledWith(
      "user-1",
      "daily.brief",
      {
        date: "2026-09-21",
        workMode: "professional",
        importantTaskTitles: ["Prepare proposal"],
        revenueRemaining: null,
        requiredDailyPace: null,
        plannedWorkloadMinutes: 75,
        remainingCapacityMinutes: 405,
      },
      "daily.brief:user-1:2026-09-21",
    );
    expect(summary).toEqual({
      phase: "morning",
      date: "2026-09-21",
      candidates: 1,
      eventsCreated: 1,
      duplicatesSkipped: 0,
      nextCursor: null,
    });
  });

  it("skips completed or fulfilled habits and counts duplicate source events", async () => {
    mocks.listV2NotificationCandidates.mockResolvedValue([
      {
        id: "user-1",
        active_persona: null,
        work_mode: null,
        notify_daily_brief: false,
        notify_weekly_review: false,
        notify_habits: true,
        notify_investment: false,
      },
    ]);
    mocks.getV2HabitReminderInputs.mockResolvedValue({
      habits: [
        { id: "habit-1", title: "Walk", target_per_week: 3 },
        { id: "habit-2", title: "Read", target_per_week: 4 },
        { id: "habit-3", title: "Stretch", target_per_week: 2 },
      ],
      completions: [
        { habit_id: "habit-1", completed_on: "2026-09-21" },
        { habit_id: "habit-1", completed_on: "2026-09-22" },
        { habit_id: "habit-2", completed_on: "2026-09-23" },
        { habit_id: "habit-3", completed_on: "2026-09-21" },
        { habit_id: "habit-3", completed_on: "2026-09-22" },
      ],
    });
    mocks.insertEventAsAdminOnce.mockResolvedValue("duplicate");

    const summary = await generateV2Notifications("evening", "2026-09-23");

    expect(mocks.getV2HabitReminderInputs).toHaveBeenCalledWith(
      "user-1",
      "2026-09-20",
      "2026-09-23",
    );
    expect(mocks.insertEventAsAdminOnce).toHaveBeenCalledTimes(1);
    expect(mocks.insertEventAsAdminOnce).toHaveBeenCalledWith(
      "user-1",
      "habit.reminder",
      { habitId: "habit-1", title: "Walk", date: "2026-09-23" },
      "habit.reminder:habit-1:2026-09-23",
    );
    expect(summary.eventsCreated).toBe(0);
    expect(summary.duplicatesSkipped).toBe(1);
  });
});
