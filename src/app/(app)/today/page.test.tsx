// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  getDayPlan: vi.fn(),
  getDailyPlan: vi.fn(),
  getDailyPriorityOrder: vi.fn(),
  getPlanningPreferences: vi.fn(),
  getTimeBlocksForDate: vi.fn(),
  getActiveHabits: vi.fn(),
  listCalendarEvents: vi.fn(),
  listFinanceBills: vi.fn(),
  listNotes: vi.fn(),
  listParentCandidates: vi.fn(),
  listGoalsWithProgress: vi.fn(),
  dailyPriorityListProps: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getTranslations: async (namespace?: string) => {
    const prefix = namespace ? `${namespace}.` : "";
    return (key: string, values?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "today.noEligibleTasks": "No active or completed tasks for this date.",
        "lifePlannerDaily.taskProgress": "{done} of {total} tasks completed",
        "plannerPrint.completed": "Completed",
        "plannerPrint.skipped": "Skipped",
      };
      return (translations[`${prefix}${key}`] ?? `${prefix}${key}`).replace(
        /\{(\w+)\}/g,
        (_, name: string) => String(values?.[name] ?? `{${name}}`),
      );
    };
  },
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/core/calendar-events/queries", () => ({ listCalendarEvents: mocks.listCalendarEvents }));
vi.mock("@/core/finance/queries", () => ({ listFinanceBills: mocks.listFinanceBills }));
vi.mock("@/core/notes/queries", () => ({ listNotes: mocks.listNotes }));
vi.mock("@/core/planning/availability", () => ({
  calculateDayAvailability: () => ({
    availableMinutes: 0,
    busyMinutes: 0,
    plannedBlockMinutes: 0,
    freeIntervals: [],
  }),
}));
vi.mock("@/core/planning/queries", () => ({
  getDailyPlan: mocks.getDailyPlan,
  getDailyPriorityOrder: mocks.getDailyPriorityOrder,
  getPlanningPreferences: mocks.getPlanningPreferences,
  getTimeBlocksForDate: mocks.getTimeBlocksForDate,
}));
vi.mock("@/core/profile/queries", () => ({ getMe: mocks.getMe }));
vi.mock("@/core/tasks/queries", () => ({ getDayPlan: mocks.getDayPlan }));
vi.mock("@/core/goals/queries", () => ({
  listGoalsWithProgress: mocks.listGoalsWithProgress,
  listParentCandidates: mocks.listParentCandidates,
}));
vi.mock("@/core/habits/queries", () => ({ getActiveHabits: mocks.getActiveHabits }));

vi.mock("@/components/domain/QuickTaskInput", () => ({ QuickTaskInput: () => null }));
vi.mock("@/components/inbox/NotesList", () => ({ NotesList: () => null }));
vi.mock("@/components/layout/PageHeader", () => ({ PageHeader: () => null }));
vi.mock("@/components/domain/TaskList", () => ({
  TaskList: ({ items }: { items: { key: string; task: { title: string }; done: boolean }[] }) => (
    <ul>
      {items.map((item) => (
        <li key={item.key}>
          {item.task.title} · {item.done ? "done" : "not done"}
        </li>
      ))}
    </ul>
  ),
}));
vi.mock("@/components/planning/DailyPlanForm", () => ({ DailyPlanForm: () => null }));
vi.mock("@/components/planning/DailyPriorityList", () => ({
  DailyPriorityList: (props: {
    items: { task: { title: string } }[];
    emptyState: React.ReactNode;
  }) => {
    mocks.dailyPriorityListProps(props);
    return (
      <div data-testid="daily-priority-list">
        {props.items.length > 0
          ? props.items.map((item) => item.task.title).join(", ")
          : props.emptyState}
      </div>
    );
  },
}));
vi.mock("@/components/planning/TimeBlockForm", () => ({ TimeBlockForm: () => null }));
vi.mock("@/components/planning/WorkflowGuide", () => ({ WorkflowGuide: () => null }));
vi.mock("@/components/planning/TodayDateNavigation", () => ({ TodayDateNavigation: () => null }));
vi.mock("@/components/widgets/GoalProgressPanel", () => ({ GoalProgressPanel: () => null }));

import TodayPage from "./page";

const date = "2026-10-10";
const skippedItem = {
  key: "habit-1:2026-10-10",
  date,
  occurrenceDate: date,
  task: {
    id: "habit-1",
    title: "Drink water",
    domain: "health",
    due_date: date,
    recurrence_rule: "FREQ=DAILY",
    completed_at: null,
    goal_id: null,
    deadline: null,
    priority: "normal",
    project_id: null,
    estimated_minutes: null,
  },
  done: false,
  overdue: false,
  recurring: true,
  skipped: true,
};

function taskItem(id: string, title: string, done = false) {
  return {
    ...skippedItem,
    key: id,
    task: { ...skippedItem.task, id, title, recurrence_rule: null },
    done,
    recurring: false,
    skipped: false,
  };
}

function renderToday(
  skipped: (typeof skippedItem)[],
  done: ReturnType<typeof taskItem>[] = [],
  due: ReturnType<typeof taskItem>[] = [],
) {
  mocks.getDayPlan.mockResolvedValue({ date, overdue: [], due, done, skipped });
  return TodayPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve({ date }),
  }).then((element) => render(element));
}

beforeEach(() => {
  mocks.getMe.mockResolvedValue({
    userId: "user-1",
    profile: { default_scope: "all", display_name: null, role_code: "general" },
  });
  mocks.getDailyPlan.mockResolvedValue(null);
  mocks.getDailyPriorityOrder.mockResolvedValue(null);
  mocks.getPlanningPreferences.mockResolvedValue({
    timezone: "Asia/Bangkok",
    workingWindows: [],
    breakWindows: [],
  });
  mocks.getTimeBlocksForDate.mockResolvedValue([]);
  mocks.getActiveHabits.mockResolvedValue([]);
  mocks.listCalendarEvents.mockResolvedValue([]);
  mocks.listFinanceBills.mockResolvedValue([]);
  mocks.listNotes.mockResolvedValue([]);
  mocks.listParentCandidates.mockResolvedValue([]);
  mocks.listGoalsWithProgress.mockResolvedValue([]);
  mocks.dailyPriorityListProps.mockReset();
});

describe("Today skipped tasks", () => {
  it("shows skipped occurrences separately and names an all-skipped date as having no eligible tasks", async () => {
    await renderToday([skippedItem]);

    expect(screen.getByText("No active or completed tasks for this date.")).toBeInTheDocument();
    expect(screen.getByText("0 of 0 tasks completed")).toBeInTheDocument();
    const skippedSection = screen.getByRole("region", { name: "Skipped" });
    expect(within(skippedSection).getByText("Drink water · not done")).toBeInTheDocument();
    expect(screen.getByTestId("daily-priority-list")).toContainElement(
      screen.getByText("No active or completed tasks for this date."),
    );
  });

  it("excludes skipped occurrences from the completion denominator", async () => {
    await renderToday(
      [skippedItem],
      [taskItem("done-1", "Completed item", true)],
      [taskItem("due-1", "Open item")],
    );

    expect(screen.getByText("1 of 2 tasks completed")).toBeInTheDocument();
  });

  it.each([
    { dailyPlan: null, metricCount: 2 },
    { dailyPlan: { available_minutes: 90, top_priorities: [] }, metricCount: 3 },
  ])(
    "renders $metricCount Today metrics and planned budget only when available",
    async ({ dailyPlan, metricCount }) => {
      mocks.getDailyPlan.mockResolvedValue(dailyPlan);
      await renderToday([]);

      const metricGrid = screen.getByText("0/0").closest("section")?.parentElement;
      expect(metricGrid).not.toBeNull();
      expect(metricGrid?.children).toHaveLength(metricCount);
      if (dailyPlan) {
        expect(screen.getByText("90 today.minutes")).toBeInTheDocument();
        expect(screen.getByText("lifePlannerDaily.plannedBudget")).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/today.minutes/)).not.toBeInTheDocument();
        expect(screen.queryByText("lifePlannerDaily.plannedBudget")).not.toBeInTheDocument();
      }
    },
  );
});
