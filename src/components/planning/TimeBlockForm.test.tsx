// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTimeBlock: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/core/planning/actions", () => ({
  createTimeBlock: mocks.createTimeBlock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { minutes?: number }) =>
    values ? `${key} ${values.minutes}` : key,
}));

import type { DayTaskItem } from "@/core/domain/dayplan";
import { intervalFromLocalDate } from "@/core/planning/availability";
import type { TaskWithGoal } from "@/core/tasks/schema";

import { TimeBlockForm } from "./TimeBlockForm";

function makeTask(
  key: string,
  title: string,
  date: string,
  options: {
    taskId?: string;
    estimatedMinutes?: number | null;
    recurring?: boolean;
    occurrenceDate?: string;
    occurrenceId?: string | null;
  } = {},
): DayTaskItem<TaskWithGoal> {
  return {
    key,
    task: {
      id: options.taskId ?? key,
      title,
      estimated_minutes: options.estimatedMinutes ?? null,
    } as unknown as TaskWithGoal,
    date: date as DayTaskItem<TaskWithGoal>["date"],
    occurrenceDate: options.occurrenceDate as DayTaskItem<TaskWithGoal>["occurrenceDate"],
    occurrenceId: options.occurrenceId,
    done: false,
    overdue: false,
    recurring: options.recurring ?? false,
  };
}

describe("TimeBlockForm date changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTimeBlock.mockResolvedValue({ ok: true, data: { id: "block-1" } });
  });

  it("resets defaults on a new day, keeps same-day edits, and submits the new date", async () => {
    const { rerender } = render(
      <TimeBlockForm
        date="2026-09-26"
        tasks={[makeTask("today-task", "Today task", "2026-09-26")]}
      />,
    );

    fireEvent.change(screen.getByLabelText("planning.timeBlockTitle"), {
      target: { value: "Edited title" },
    });
    fireEvent.change(screen.getByLabelText("planning.starts"), {
      target: { value: "2026-09-26T11:00" },
    });

    rerender(
      <TimeBlockForm
        date="2026-09-26"
        tasks={[makeTask("today-task", "Today task", "2026-09-26")]}
      />,
    );

    expect(screen.getByLabelText("planning.timeBlockTitle")).toHaveValue("Edited title");
    expect(screen.getByLabelText("planning.starts")).toHaveValue("2026-09-26T11:00");

    rerender(
      <TimeBlockForm
        date="2026-09-27"
        tasks={[makeTask("tomorrow-task", "Tomorrow task", "2026-09-27")]}
      />,
    );

    expect(screen.getByLabelText("planning.linkTask")).toHaveValue("tomorrow-task");
    expect(screen.getByLabelText("planning.timeBlockTitle")).toHaveValue("Tomorrow task");
    expect(screen.getByLabelText("planning.starts")).toHaveValue("2026-09-27T09:00");
    expect(screen.getByLabelText("planning.ends")).toHaveValue("2026-09-27T09:30");

    fireEvent.click(screen.getByRole("button", { name: "planning.schedule" }));

    await waitFor(() =>
      expect(mocks.createTimeBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "tomorrow-task",
          title: "Tomorrow task",
          startAt: "2026-09-27T02:00:00.000Z",
          endAt: "2026-09-27T02:30:00.000Z",
        }),
      ),
    );
  });

  it("previews and recomputes task-fit slots without writing until Schedule", () => {
    const date = "2099-10-02";
    const tasks = [
      makeTask("short-task", "Short task", date, { estimatedMinutes: 30 }),
      makeTask("long-task", "Long task", date, { estimatedMinutes: 75 }),
    ];
    const freeIntervals = [intervalFromLocalDate(date, "09:00", "12:00")];
    const { getByLabelText, getByText } = render(
      <TimeBlockForm
        date={date}
        tasks={tasks}
        freeIntervals={freeIntervals}
        suggestionNow={intervalFromLocalDate(date, "08:00", "08:01").start}
      />,
    );

    expect(getByLabelText("planning.starts")).toHaveValue(`${date}T09:00`);
    expect(getByLabelText("planning.ends")).toHaveValue(`${date}T09:30`);
    expect(getByText("planning.timeBlockSuggestedSlot 30")).toBeVisible();
    expect(mocks.createTimeBlock).not.toHaveBeenCalled();

    fireEvent.change(getByLabelText("planning.linkTask"), { target: { value: "long-task" } });
    expect(getByLabelText("planning.timeBlockTitle")).toHaveValue("Long task");
    expect(getByLabelText("planning.starts")).toHaveValue(`${date}T09:00`);
    expect(getByLabelText("planning.ends")).toHaveValue(`${date}T10:15`);
    expect(getByText("planning.timeBlockSuggestedSlot 75")).toBeVisible();
    expect(mocks.createTimeBlock).not.toHaveBeenCalled();
  });

  it("refreshes untouched availability suggestions and preserves manually edited times", () => {
    const date = "2099-10-02";
    const task = makeTask("task-a", "Task A", date, { estimatedMinutes: 30 });
    const { rerender } = render(
      <TimeBlockForm
        date={date}
        tasks={[task]}
        freeIntervals={[intervalFromLocalDate(date, "09:00", "10:00")]}
        suggestionNow={intervalFromLocalDate(date, "08:00", "08:01").start}
      />,
    );

    expect(screen.getByLabelText("planning.starts")).toHaveValue(`${date}T09:00`);
    expect(screen.getByLabelText("planning.ends")).toHaveValue(`${date}T09:30`);

    rerender(
      <TimeBlockForm
        date={date}
        tasks={[task]}
        freeIntervals={[intervalFromLocalDate(date, "10:00", "11:00")]}
        suggestionNow={intervalFromLocalDate(date, "09:30", "09:31").start}
      />,
    );

    expect(screen.getByLabelText("planning.starts")).toHaveValue(`${date}T10:00`);
    expect(screen.getByLabelText("planning.ends")).toHaveValue(`${date}T10:30`);

    fireEvent.change(screen.getByLabelText("planning.starts"), {
      target: { value: `${date}T11:00` },
    });
    fireEvent.change(screen.getByLabelText("planning.ends"), {
      target: { value: `${date}T11:30` },
    });
    rerender(
      <TimeBlockForm
        date={date}
        tasks={[task]}
        freeIntervals={[intervalFromLocalDate(date, "12:00", "13:00")]}
        suggestionNow={intervalFromLocalDate(date, "11:30", "11:31").start}
      />,
    );

    expect(screen.getByLabelText("planning.starts")).toHaveValue(`${date}T11:00`);
    expect(screen.getByLabelText("planning.ends")).toHaveValue(`${date}T11:30`);
    expect(mocks.createTimeBlock).not.toHaveBeenCalled();
  });

  it("requires a manual time when no free interval fits, then allows the existing save path", async () => {
    const date = "2099-10-02";
    const task = makeTask("task-a", "Task A", date);
    render(
      <TimeBlockForm
        date={date}
        tasks={[task]}
        freeIntervals={[intervalFromLocalDate(date, "09:00", "09:20")]}
        suggestionNow={intervalFromLocalDate(date, "09:00", "09:01").start}
      />,
    );

    expect(screen.getByText("planning.timeBlockNoSuggestedSlot")).toBeVisible();
    expect(screen.getByText("planning.timeBlockDefaultEstimate 30")).toBeVisible();
    expect(screen.getByLabelText("planning.starts")).toHaveValue("");
    expect(screen.getByLabelText("planning.ends")).toHaveValue("");
    const scheduleButton = screen.getByRole("button", { name: "planning.schedule" });
    expect(scheduleButton).toBeDisabled();
    fireEvent.click(scheduleButton);
    expect(mocks.createTimeBlock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("planning.starts"), {
      target: { value: `${date}T10:00` },
    });
    fireEvent.change(screen.getByLabelText("planning.ends"), {
      target: { value: `${date}T10:30` },
    });
    expect(scheduleButton).toBeEnabled();
    fireEvent.click(scheduleButton);

    await waitFor(() =>
      expect(mocks.createTimeBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "task-a",
          startAt: "2099-10-02T03:00:00.000Z",
          endAt: "2099-10-02T03:30:00.000Z",
        }),
      ),
    );
  });

  it("selects a task added after capture and retains recurrence source identity", async () => {
    const date = "2099-10-02";
    const task = makeTask("recurring:2099-10-01", "Recurring task", date, {
      taskId: "recurring-task",
      estimatedMinutes: 45,
      recurring: true,
      occurrenceDate: "2099-10-01",
      occurrenceId: "occurrence-1",
    });
    const freeIntervals = [intervalFromLocalDate(date, "09:00", "12:00")];
    const { rerender } = render(
      <TimeBlockForm
        date={date}
        tasks={[]}
        freeIntervals={freeIntervals}
        suggestionNow={intervalFromLocalDate(date, "08:00", "08:01").start}
      />,
    );

    expect(screen.getByLabelText("planning.timeBlockTitle")).toHaveValue("");
    expect(screen.getByRole("button", { name: "planning.schedule" })).toBeDisabled();
    expect(mocks.createTimeBlock).not.toHaveBeenCalled();

    rerender(
      <TimeBlockForm
        date={date}
        tasks={[task]}
        freeIntervals={freeIntervals}
        suggestionNow={intervalFromLocalDate(date, "08:00", "08:01").start}
      />,
    );

    expect(screen.getByLabelText("planning.linkTask")).toHaveValue(task.key);
    expect(screen.getByLabelText("planning.timeBlockTitle")).toHaveValue("Recurring task");
    expect(screen.getByLabelText("planning.ends")).toHaveValue(`${date}T09:45`);
    expect(mocks.createTimeBlock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "planning.schedule" }));
    await waitFor(() =>
      expect(mocks.createTimeBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: "recurring-task",
          taskOccurrenceDate: "2099-10-01",
          taskScheduledDate: date,
          startAt: "2099-10-02T02:00:00.000Z",
          endAt: "2099-10-02T02:45:00.000Z",
        }),
      ),
    );
  });

  it("preserves a manual title and time when a captured task arrives", () => {
    const date = "2099-10-02";
    const freeIntervals = [intervalFromLocalDate(date, "09:00", "12:00")];
    const { rerender } = render(
      <TimeBlockForm
        date={date}
        tasks={[]}
        freeIntervals={freeIntervals}
        suggestionNow={intervalFromLocalDate(date, "08:00", "08:01").start}
      />,
    );

    fireEvent.change(screen.getByLabelText("planning.timeBlockTitle"), {
      target: { value: "Personal focus" },
    });
    fireEvent.change(screen.getByLabelText("planning.starts"), {
      target: { value: `${date}T10:00` },
    });
    fireEvent.change(screen.getByLabelText("planning.ends"), {
      target: { value: `${date}T11:00` },
    });

    rerender(
      <TimeBlockForm
        date={date}
        tasks={[makeTask("captured", "Captured task", date, { estimatedMinutes: 60 })]}
        freeIntervals={freeIntervals}
        suggestionNow={intervalFromLocalDate(date, "08:00", "08:01").start}
      />,
    );

    expect(screen.getByLabelText("planning.linkTask")).toHaveValue("captured");
    expect(screen.getByLabelText("planning.timeBlockTitle")).toHaveValue("Personal focus");
    expect(screen.getByLabelText("planning.starts")).toHaveValue(`${date}T10:00`);
    expect(screen.getByLabelText("planning.ends")).toHaveValue(`${date}T11:00`);
  });

  it("keeps an explicit unlink when task options refresh", () => {
    const date = "2026-09-27";
    const firstTask = makeTask("first-task", "First task", date);
    const { rerender } = render(<TimeBlockForm date={date} tasks={[firstTask]} />);

    fireEvent.change(screen.getByLabelText("planning.linkTask"), { target: { value: "" } });
    rerender(
      <TimeBlockForm
        date={date}
        tasks={[firstTask, makeTask("new-task", "New task", date)]}
      />,
    );

    expect(screen.getByLabelText("planning.linkTask")).toHaveValue("");
    expect(screen.getByLabelText("planning.timeBlockTitle")).toHaveValue("");
  });
});
