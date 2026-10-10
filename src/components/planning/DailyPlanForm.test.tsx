// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveDailyPlanSettings: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/planning/daily-plan-settings-actions", () => ({
  saveDailyPlanSettings: mocks.saveDailyPlanSettings,
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

describe("DailyPlanForm settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveDailyPlanSettings.mockResolvedValue({ ok: true, data: null });
  });

  it("saves only the time budget and note fields, leaving priority order to its own action", async () => {
    render(
      <DailyPlanForm
        planDate="2026-09-27"
        initial={{ available_minutes: 360, notes: "Keep this note" }}
      />,
    );

    fireEvent.click(screen.getByText("planOptionsLabel"));
    expect(screen.getByLabelText("plannedBudgetField")).toHaveValue(360);
    expect(screen.getByLabelText("notesForDay")).toHaveValue("Keep this note");

    fireEvent.click(screen.getByRole("button", { name: "savePlan" }));

    await waitFor(() =>
      expect(mocks.saveDailyPlanSettings).toHaveBeenCalledWith({
        planDate: "2026-09-27",
        availableMinutes: 360,
        notes: "Keep this note",
      }),
    );
    expect(mocks.saveDailyPlanSettings.mock.calls[0][0]).not.toHaveProperty("topPriorities");
  });

  it("refreshes an untouched suggested budget but preserves manual edits", () => {
    const commonProps = { planDate: "2026-09-27" as const };
    const { rerender } = render(<DailyPlanForm {...commonProps} defaultAvailableMinutes={480} />);
    fireEvent.click(screen.getByText("planOptionsLabel"));
    const budgetInput = screen.getByLabelText("plannedBudgetField");
    expect(budgetInput).toHaveValue(480);
    expect(budgetInput).toHaveAttribute("step", "1");

    rerender(<DailyPlanForm {...commonProps} defaultAvailableMinutes={475} />);
    expect(budgetInput).toHaveValue(475);

    fireEvent.change(budgetInput, { target: { value: "600" } });
    rerender(<DailyPlanForm {...commonProps} defaultAvailableMinutes={450} />);
    expect(budgetInput).toHaveValue(600);
  });
});
