// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setTimeBlockStatus: vi.fn(),
  updateTimeBlock: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/planning/actions", () => ({
  setTimeBlockStatus: mocks.setTimeBlockStatus,
  updateTimeBlock: mocks.updateTimeBlock,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) => namespace ? `${namespace}.${key}` : key,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import { TimeBlockActions } from "./TimeBlockActions";

const block = {
  id: "block-1",
  title: "Focus time",
  start_at: "2026-10-10T02:00:00.000Z",
  end_at: "2026-10-10T03:00:00.000Z",
  version: 1,
  status: "active" as const,
  is_locked: false,
};

beforeEach(() => {
  mocks.setTimeBlockStatus.mockReset();
  mocks.updateTimeBlock.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
});

describe("TimeBlockActions", () => {
  it("does not offer editing for a locked block", () => {
    render(<TimeBlockActions {...block} is_locked />);

    expect(screen.queryByRole("button", { name: /planning.editTimeBlock/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /planning.cancelTimeBlock/ })).toBeInTheDocument();
  });

  it("reports a stale edit distinctly and leaves the editor available for refresh or cancel", async () => {
    mocks.updateTimeBlock.mockResolvedValue({ ok: false, error: "timeBlockStale" });
    render(<TimeBlockActions {...block} />);

    fireEvent.click(screen.getByRole("button", { name: /planning.editTimeBlock/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("errors.timeBlockStale"));
    expect(screen.getByRole("button", { name: "common.cancel" })).toBeInTheDocument();
  });

  it("submits the edited Bangkok interval and keeps the editor open when the update is rejected", async () => {
    mocks.updateTimeBlock.mockResolvedValue({ ok: false, error: "timeBlockConflict" });
    render(<TimeBlockActions {...block} />);

    fireEvent.click(screen.getByRole("button", { name: /planning.editTimeBlock/ }));
    fireEvent.change(screen.getByLabelText("planning.starts"), {
      target: { value: "2026-10-10T09:00" },
    });
    fireEvent.change(screen.getByLabelText("planning.ends"), {
      target: { value: "2026-10-10T09:15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mocks.updateTimeBlock).toHaveBeenCalledWith({
      id: "block-1",
      title: "Focus time",
      startAt: "2026-10-10T02:00:00.000Z",
      endAt: "2026-10-10T02:15:00.000Z",
      expectedVersion: 1,
    }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("errors.timeBlockConflict"));
    expect(screen.getByRole("button", { name: "common.save" })).toBeInTheDocument();
  });
});
