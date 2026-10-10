// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/projects/actions", () => ({ listProjectOptions: vi.fn() }));
vi.mock("@/core/tasks/actions", () => ({
  archiveTask: vi.fn(),
  rescheduleTask: vi.fn(),
  rescheduleTaskOccurrence: vi.fn(),
  restoreTask: vi.fn(),
  skipTaskOccurrence: vi.fn(),
  toggleTask: vi.fn(),
  toggleTaskOccurrence: vi.fn(async () => ({ ok: true, data: { completedGoals: [] } })),
}));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import messages from "@/messages/en.json";
import { toggleTaskOccurrence } from "@/core/tasks/actions";
import type { DayTaskItem } from "@/core/domain/dayplan";
import type { TaskWithGoal } from "@/core/tasks/schema";
import { TaskList } from "./TaskList";

const task: TaskWithGoal = {
  id: "task-1",
  user_id: "user-1",
  data_origin: "USER",
  goal_id: null,
  domain: "health",
  title: "Daily stretch",
  due_date: "2026-10-10",
  recurrence_rule: "FREQ=DAILY",
  completed_at: null,
  persona_data: {},
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  task_group_id: null,
  task_group_position: 0,
  goal: null,
};

const skippedItem: DayTaskItem<TaskWithGoal> = {
  key: "task-1:2026-10-10",
  task,
  date: "2026-10-10",
  occurrenceDate: "2026-10-10",
  done: false,
  overdue: false,
  recurring: true,
  skipped: true,
};

const completedItem: DayTaskItem<TaskWithGoal> = {
  ...skippedItem,
  key: "task-1:2026-10-09",
  task: { ...task, id: "task-2", title: "Read a chapter", recurrence_rule: null },
  done: true,
  recurring: false,
  skipped: false,
};

describe("TaskList skipped occurrences", () => {
  beforeEach(() => {
    vi.mocked(toggleTaskOccurrence).mockClear();
    vi.mocked(toggleTaskOccurrence).mockResolvedValue({
      ok: true,
      data: { done: false, completedGoals: [] },
    });
  });

  it("separates skipped rows from completed tasks while keeping their completion action available", async () => {
    render(
      <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={messages}>
        <TaskList
          items={[completedItem, skippedItem]}
          today="2026-10-10"
          goalOptions={[]}
          variant="plain"
        />
      </NextIntlClientProvider>,
    );

    const completedSection = screen.getByRole("region", { name: messages.tasks.sections.done });
    const skippedSection = screen.getByRole("region", {
      name: messages.tasks.sections.skipped,
    });
    expect(within(completedSection).getByText("Read a chapter")).toBeInTheDocument();
    expect(within(completedSection).queryByText("Daily stretch")).not.toBeInTheDocument();
    expect(within(skippedSection).getByText("Daily stretch")).toBeInTheDocument();
    expect(within(skippedSection).getByText(messages.tasks.meta.skipped)).toBeInTheDocument();

    const skippedCheckbox = within(skippedSection).getByRole("checkbox", {
      name: messages.a11y.toggleTask.replace("{title}", task.title),
    });
    expect(skippedCheckbox).not.toBeChecked();
    expect(skippedCheckbox).toBeEnabled();
    fireEvent.click(skippedCheckbox);
    await waitFor(() =>
      expect(toggleTaskOccurrence).toHaveBeenCalledWith({
        id: task.id,
        occurrenceDate: "2026-10-10",
        date: "2026-10-10",
        done: true,
      }),
    );
  });
});
