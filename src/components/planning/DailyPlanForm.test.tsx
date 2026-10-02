// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveDailyPlan: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/planning/actions", () => ({
  saveDailyPlan: mocks.saveDailyPlan,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key} ${Object.values(values).join("/")}` : key,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import { DailyPlanForm } from "./DailyPlanForm";

const eligibleTopPriorityTaskIds = ["life-task", "work-a", "work-b", "work-c"];

describe("DailyPlanForm task eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveDailyPlan.mockResolvedValue({ ok: true, data: null });
  });

  it("drops tasks removed from Today, preserves eligible other-scope picks, and enforces the limit", async () => {
    const { rerender } = render(
      <DailyPlanForm
        planDate="2026-09-27"
        tasks={[
          { id: "moved-task", title: "Moved task" },
          { id: "work-a", title: "Work task A" },
          { id: "work-b", title: "Work task B" },
          { id: "work-c", title: "Work task C" },
        ]}
        eligibleTopPriorityTaskIds={[
          "moved-task",
          ...eligibleTopPriorityTaskIds,
        ]}
        initial={{
          available_minutes: 360,
          notes: "Keep this note",
          top_priorities: ["moved-task", "life-task"],
        }}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Moved task" })).toBeChecked();
    expect(screen.getByText("planning.topPrioritiesHint 2/3")).toBeInTheDocument();

    rerender(
      <DailyPlanForm
        planDate="2026-09-27"
        tasks={[
          { id: "work-a", title: "Work task A" },
          { id: "work-b", title: "Work task B" },
          { id: "work-c", title: "Work task C" },
        ]}
        eligibleTopPriorityTaskIds={eligibleTopPriorityTaskIds}
        initial={{
          available_minutes: 360,
          notes: "Keep this note",
          top_priorities: ["moved-task", "life-task"],
        }}
      />,
    );

    expect(screen.queryByRole("checkbox", { name: "Moved task" })).not.toBeInTheDocument();
    expect(screen.getByText("planning.topPrioritiesHint 1/3")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Work task A" })).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Work task A" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Work task B" }));

    expect(screen.getByText("planning.topPrioritiesHint 3/3")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Work task C" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "planning.savePlan" }));

    await waitFor(() =>
      expect(mocks.saveDailyPlan).toHaveBeenCalledWith({
        planDate: "2026-09-27",
        availableMinutes: 360,
        topPriorities: ["life-task", "work-a", "work-b"],
        notes: "Keep this note",
      }),
    );
  });

  it("previews urgent distinct priorities and saves only after the user confirms", async () => {
    render(
      <DailyPlanForm
        planDate="2026-09-27"
        defaultAvailableMinutes={475}
        eligibleTopPriorityTaskIds={[
          "later",
          "deadline-today",
          "deadline-overdue",
          "overdue-high",
        ]}
        tasks={[
          { id: "later", title: "Later task", priority: "high", deadline: "2026-10-01" },
          { id: "deadline-today", title: "Deadline today", deadline: "2026-09-27", priority: "low" },
          { id: "deadline-overdue", title: "Overdue deadline", deadline: "2026-09-26", priority: "low" },
          { id: "overdue-high", title: "Overdue high priority", overdue: true, priority: "high" },
        ]}
      />,
    );

    expect(screen.getByText("planning.suggestedPrioritiesHint")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Overdue deadline" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Deadline today" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Overdue high priority" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Later task" })).not.toBeChecked();
    expect(mocks.saveDailyPlan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "planning.savePlan" }));
    await waitFor(() =>
      expect(mocks.saveDailyPlan).toHaveBeenCalledWith({
        planDate: "2026-09-27",
        availableMinutes: 475,
        topPriorities: ["deadline-overdue", "deadline-today", "overdue-high"],
        notes: null,
      }),
    );
  });

  it("keeps a saved empty priority list and note instead of replacing them with suggestions", () => {
    render(
      <DailyPlanForm
        planDate="2026-09-27"
        eligibleTopPriorityTaskIds={["work-a"]}
        tasks={[{ id: "work-a", title: "Work task A" }]}
        initial={{ available_minutes: 0, notes: "Keep this note", top_priorities: [] }}
      />,
    );

    expect(screen.queryByText("planning.suggestedPrioritiesHint")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Work task A" })).not.toBeChecked();
    expect(screen.getByText("planning.planOptionsSummary 0/Keep this note")).toBeVisible();
  });

  it("refreshes an untouched budget from calendar availability but preserves manual edits", () => {
    const commonProps = {
      planDate: "2026-09-27" as const,
      eligibleTopPriorityTaskIds: [] as string[],
      tasks: [],
    };
    const { rerender } = render(
      <DailyPlanForm {...commonProps} defaultAvailableMinutes={480} />,
    );

    fireEvent.click(screen.getByText("planning.planOptionsLabel"));
    const budgetInput = screen.getByLabelText("planning.availableMinutes");
    expect(budgetInput).toHaveValue(480);
    expect(budgetInput).toHaveAttribute("step", "1");

    rerender(<DailyPlanForm {...commonProps} defaultAvailableMinutes={475} />);
    expect(budgetInput).toHaveValue(475);

    fireEvent.change(budgetInput, { target: { value: "600" } });
    rerender(<DailyPlanForm {...commonProps} defaultAvailableMinutes={450} />);
    expect(budgetInput).toHaveValue(600);
  });

  it("refreshes preview suggestions after capture only while priorities are untouched", () => {
    const initialProps = {
      planDate: "2026-09-27" as const,
      eligibleTopPriorityTaskIds: [] as string[],
      tasks: [] as { id: string; title: string }[],
    };
    const { rerender } = render(<DailyPlanForm {...initialProps} />);

    rerender(
      <DailyPlanForm
        {...initialProps}
        eligibleTopPriorityTaskIds={["captured"]}
        tasks={[{ id: "captured", title: "Captured task" }]}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Captured task" })).toBeChecked();
    expect(mocks.saveDailyPlan).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Captured task" }));
    rerender(
      <DailyPlanForm
        {...initialProps}
        eligibleTopPriorityTaskIds={["captured", "another"]}
        tasks={[
          { id: "captured", title: "Captured task" },
          { id: "another", title: "Another task" },
        ]}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Captured task" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Another task" })).not.toBeChecked();
  });
});
