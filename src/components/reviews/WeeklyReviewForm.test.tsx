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

function reviewElement(
  weekStart: string,
  initial: {
    wins: string | null;
    blockers: string | null;
    next_focus: string | null;
  } | null = null,
  carryoverTasks: {
    id: string;
    title: string;
    planned_date: string | null;
    deadline: string | null;
  }[] = [
    {
      id: "task-1",
      title: "Prepare the weekly report",
      planned_date: "2026-10-08",
      deadline: "2026-10-14",
    },
  ],
  nextWeekStart = "2026-10-11",
) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WeeklyReviewForm
        weekStart={weekStart}
        initial={initial}
        nextWeekStart={nextWeekStart}
        carryoverTasks={carryoverTasks}
      />
    </NextIntlClientProvider>
  );
}

function renderReview() {
  return render(reviewElement("2026-10-04"));
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

  it("binds review text and carry-over selection to the displayed week", async () => {
    mocks.saveWeeklyReview.mockResolvedValue({ ok: true, data: null });
    const septemberReview = {
      wins: "September wins",
      blockers: "September blockers",
      next_focus: "September focus",
    };
    const octoberReview = {
      wins: "October wins",
      blockers: "October blockers",
      next_focus: "October focus",
    };
    const carryoverTasks = [
      {
        id: "task-1",
        title: "Prepare the weekly report",
        planned_date: "2026-10-08",
        deadline: null,
      },
    ];
    const { rerender } = render(
      reviewElement("2026-09-27", septemberReview, carryoverTasks, "2026-10-04"),
    );

    const wins = screen.getByLabelText(enMessages.reviews.form.wins);
    fireEvent.change(wins, { target: { value: "Unsaved September edit" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Prepare the weekly report/ }));

    rerender(reviewElement("2026-09-27", septemberReview, carryoverTasks, "2026-10-04"));
    expect(screen.getByLabelText(enMessages.reviews.form.wins)).toHaveValue(
      "Unsaved September edit",
    );
    expect(screen.getByRole("checkbox", { name: /Prepare the weekly report/ })).toBeChecked();

    rerender(reviewElement("2026-10-04", octoberReview, carryoverTasks, "2026-10-11"));
    expect(screen.getByLabelText(enMessages.reviews.form.wins)).toHaveValue("October wins");
    expect(screen.getByLabelText(enMessages.reviews.form.blockers)).toHaveValue("October blockers");
    expect(screen.getByLabelText(enMessages.reviews.form.nextFocus)).toHaveValue("October focus");
    expect(screen.getByRole("checkbox", { name: /Prepare the weekly report/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: enMessages.reviews.form.submit }));
    await waitFor(() =>
      expect(mocks.saveWeeklyReview).toHaveBeenCalledWith({
        weekStart: "2026-10-04",
        wins: "October wins",
        blockers: "October blockers",
        nextFocus: "October focus",
      }),
    );

    rerender(reviewElement("2026-09-27", septemberReview, carryoverTasks, "2026-10-04"));
    expect(screen.getByLabelText(enMessages.reviews.form.wins)).toHaveValue("September wins");
  });
});
