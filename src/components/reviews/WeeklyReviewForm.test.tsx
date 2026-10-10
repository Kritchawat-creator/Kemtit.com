// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveWeeklyReview: vi.fn(),
  carryOverReviewTasks: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/reviews/actions", () => ({
  saveWeeklyReview: mocks.saveWeeklyReview,
  carryOverReviewTasks: mocks.carryOverReviewTasks,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import enMessages from "@/messages/en.json";
import { WeeklyReviewForm } from "./WeeklyReviewForm";

function renderReview() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WeeklyReviewForm
        weekStart="2026-10-04"
        nextWeekStart="2026-10-11"
        carryoverTasks={[
          {
            id: "task-1",
            title: "Prepare the weekly report",
            planned_date: "2026-10-08",
            deadline: "2026-10-14",
          },
        ]}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mocks.saveWeeklyReview.mockReset();
  mocks.carryOverReviewTasks.mockReset();
  mocks.refresh.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("WeeklyReviewForm carry-over preview", () => {
  it("previews the selected move and keeps it selected when the server rejects a conflict", async () => {
    mocks.carryOverReviewTasks.mockResolvedValue({ ok: false, error: "deadlineConflict" });
    renderReview();

    const checkbox = screen.getByRole("checkbox", { name: /Prepare the weekly report/ });
    expect(screen.queryByRole("region", { name: "Review the move" })).not.toBeInTheDocument();
    fireEvent.click(checkbox);

    expect(screen.getByRole("region", { name: "Review the move" })).toHaveTextContent(
      "1 selected task(s) will be planned for 2026-10-11.",
    );
    expect(screen.getByRole("region", { name: "Review the move" })).toHaveTextContent(
      "deadline stays 2026-10-14",
    );

    fireEvent.click(screen.getByRole("button", { name: "Carry selected tasks forward" }));
    await waitFor(() =>
      expect(mocks.carryOverReviewTasks).toHaveBeenCalledWith({
        taskIds: ["task-1"],
        plannedDate: "2026-10-11",
      }),
    );

    expect(checkbox).toBeChecked();
    expect(screen.getByRole("region", { name: "Review the move" })).toBeInTheDocument();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Some tasks have a deadline before the selected date and were not moved",
    );
  });
});
