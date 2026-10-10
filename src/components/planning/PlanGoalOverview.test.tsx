// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async () => (key: string, values?: { count?: number; date?: string }) => {
    if (key === "planner.domainGoalCount") {
      const count = values?.count ?? 0;
      return `${count} ${count === 1 ? "goal" : "goals"} in this life area`;
    }
    const messages: Record<string, string> = {
      "planner.overviewTitle": "Goals in this period",
      "planner.addGoal": "Add goal",
      "planner.nextAction": "Next action",
      "planner.noNextAction": "No open task yet",
      "planner.nextActionPlanned": "Planned for {date}",
      "planner.nextActionDue": "Due {date}",
      "goalKinds.execution": "Complete",
      "periods.month": "Month",
      "domains.work": "Work",
      "domains.health": "Health",
    };
    return (messages[key] ?? key).replace(/\{(count|date)\}/g, (_, name: "count" | "date") =>
      String(values?.[name] ?? ""),
    );
  },
}));

import enMessages from "@/messages/en.json";
import type { GoalNextAction } from "@/core/goals/next-actions";
import type { GoalWithProgress } from "@/core/goals/queries";
import { PlanGoalOverview } from "./PlanGoalOverview";

describe("PlanGoalOverview", () => {
  function goal(periodType: "month" | "year", periodStart: string): GoalWithProgress {
    const end = periodType === "month" ? "2026-10-31" : "2026-12-31";
    return {
      id: "goal-1",
      domain: "work",
      title: "Finish the project plan",
      period_type: periodType,
      period_start: periodStart,
      status: "active",
      progress: { kind: "execution", percent: 0, childCount: 0, tasksDone: 0, tasksTotal: 0 },
      period: { type: periodType, start: periodStart, end },
      pace: "notStarted",
    } as GoalWithProgress;
  }

  async function renderOverview({
    goals,
    view,
    date,
    selectedDate,
    nextActions = new Map(),
  }: {
    goals: GoalWithProgress[];
    view: "month" | "year";
    date: string;
    selectedDate: string;
    nextActions?: Map<string, GoalNextAction>;
  }) {
    const overview = await PlanGoalOverview({
      goals,
      nextActions,
      domains: ["work", "health"],
      view,
      date,
      selectedDate,
      scope: "all",
    });

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {overview}
      </NextIntlClientProvider>,
    );
  }

  it("keeps unselected domains as compact add links without zero-goal cards", async () => {
    await renderOverview({
      goals: [goal("month", "2026-10-01")],
      view: "month",
      date: "2026-10-01",
      selectedDate: "2026-10-09",
    });

    expect(screen.getByRole("heading", { name: "Goals in this period" })).toBeInTheDocument();
    expect(screen.getByText("1 goal in this life area")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add goal · Health" })).toHaveAttribute(
      "href",
      "/plan?view=month&date=2026-10-01&new=goal&periodType=month&periodStart=2026-10-01&scope=all&domain=health",
    );
    expect(screen.queryByText("0 goals")).not.toBeInTheDocument();
    expect(screen.queryByText(/No goals in this life area/)).not.toBeInTheDocument();
  });

  it.each([
    { view: "month" as const, date: "2026-10-01", selectedDate: "2026-10-09" },
    { view: "year" as const, date: "2026-01-01", selectedDate: "2026-10-09" },
  ])(
    "preserves the selected date in a $view goal return link",
    async ({ view, date, selectedDate }) => {
      await renderOverview({
        goals: [goal(view, date)],
        view,
        date,
        selectedDate,
      });

      expect(screen.getByRole("link", { name: /Finish the project plan/ })).toHaveAttribute(
        "href",
        `/goals/goal-1?returnTo=%2Fplan%3Fview%3D${view}%26date%3D${selectedDate}%26scope%3Dall`,
      );
    },
  );

  it("labels the legacy due-date fallback as a planned date", async () => {
    await renderOverview({
      goals: [goal("month", "2026-10-01")],
      view: "month",
      date: "2026-10-01",
      selectedDate: "2026-10-09",
      nextActions: new Map([
        [
          "goal-1",
          {
            id: "task-1",
            goal_id: "goal-1",
            title: "Draft the outline",
            planned_date: null,
            due_date: "2026-10-16",
          },
        ],
      ]),
    });

    expect(screen.getByText("Planned for 16 Oct")).toBeInTheDocument();
    expect(screen.queryByText("Due 16 Oct")).not.toBeInTheDocument();
  });
});
