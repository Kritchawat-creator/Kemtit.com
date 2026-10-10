// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/planning/actions", () => ({
  confirmRescue: vi.fn(),
  getLatestUndoableRescueOperation: vi.fn(),
  undoRescue: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "th",
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { RescueReview } from "./RescueReview";
import type { RescueProposal } from "@/core/planning/rescue";
import {
  confirmRescue,
  getLatestUndoableRescueOperation,
  undoRescue,
} from "@/core/planning/actions";

function proposal(reason: string): RescueProposal {
  return {
    targetDate: "2026-09-27",
    proposalVersion: "rescue-test",
    overCapacityMinutes: 30,
    items: [
      {
        taskId: "task-recurring",
        title: "QA26 Recurring",
        action: "unplaced",
        reason,
        targetDate: "2026-09-27",
        startAt: null,
        endAt: null,
        blockId: null,
        expectedBlockVersion: null,
        expectedTaskUpdatedAt: "2026-09-26T00:00:00.000Z",
      },
    ],
  };
}

beforeEach(() => {
  let nextId = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `rescue-test-operation-${++nextId}` });
  vi.mocked(confirmRescue).mockImplementation(async (input) => ({
    ok: true,
    data: { id: (input as { operationId: string }).operationId },
  }));
  vi.mocked(getLatestUndoableRescueOperation).mockResolvedValue({
    ok: true,
    data: null,
  });
  vi.mocked(undoRescue).mockResolvedValue({ ok: true, data: { id: "rescue-test-operation" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RescueReview placement reasons", () => {
  it("explains when a recurring occurrence requires an occurrence-specific block", () => {
    render(<RescueReview proposal={proposal("recurringOccurrenceRequired")} />);

    expect(screen.getByText("rescue.recurringOccurrenceRequired")).toBeInTheDocument();
    expect(screen.queryByText("rescue.noPlacement")).not.toBeInTheDocument();
  });

  it("keeps the continuous-window message for actual capacity limits", () => {
    render(<RescueReview proposal={proposal("noContiguousWindow")} />);

    expect(screen.getByText("rescue.noPlacement")).toBeInTheDocument();
    expect(screen.queryByText("rescue.recurringOccurrenceRequired")).not.toBeInTheDocument();
  });

  it("reads an eligible Undo operation for the proposal date after reload", async () => {
    vi.mocked(getLatestUndoableRescueOperation).mockResolvedValue({
      ok: true,
      data: { operationId: "saved-rescue-operation" },
    });
    render(<RescueReview proposal={proposal("noContiguousWindow")} />);

    const undoButton = await screen.findByRole("button", { name: /rescue.undo/ });
    expect(getLatestUndoableRescueOperation).toHaveBeenCalledWith({ targetDate: "2026-09-27" });
    expect(screen.queryByRole("button", { name: /rescue.confirm/ })).not.toBeInTheDocument();

    undoButton.click();
    await waitFor(() => {
      expect(undoRescue).toHaveBeenCalledWith({ operationId: "saved-rescue-operation" });
    });
  });

  it("uses a fresh idempotency key after Undo before applying again", async () => {
    const base = proposal("movedToFreeWindow");
    const movableProposal: RescueProposal = {
      ...base,
      items: [{
        ...base.items[0]!,
        action: "move",
        reason: "movedToFreeWindow",
        startAt: "2026-09-27T02:00:00.000Z",
        endAt: "2026-09-27T02:30:00.000Z",
        blockId: "block-1",
        expectedBlockVersion: 1,
      }],
    };
    vi.mocked(getLatestUndoableRescueOperation).mockResolvedValue({ ok: true, data: null });
    render(<RescueReview proposal={movableProposal} />);

    fireEvent.click(await screen.findByRole("button", { name: /rescue.confirm/ }));
    await screen.findByRole("button", { name: /rescue.undo/ });
    const firstOperationId = (vi.mocked(confirmRescue).mock.calls[0]![0] as { operationId: string }).operationId;

    fireEvent.click(screen.getByRole("button", { name: /rescue.undo/ }));
    await screen.findByRole("button", { name: /rescue.confirm/ });
    fireEvent.click(screen.getByRole("button", { name: /rescue.confirm/ }));
    await waitFor(() => expect(confirmRescue).toHaveBeenCalledTimes(2));

    const secondOperationId = (vi.mocked(confirmRescue).mock.calls[1]![0] as { operationId: string }).operationId;
    expect(secondOperationId).not.toBe(firstOperationId);
  });

  it("keeps apply unavailable after a failed Undo readback until retry succeeds", async () => {
    vi.mocked(getLatestUndoableRescueOperation)
      .mockRejectedValueOnce(new Error("temporary readback failure"))
      .mockResolvedValueOnce({ ok: true, data: null });
    render(<RescueReview proposal={proposal("noContiguousWindow")} />);

    expect(await screen.findByText("rescue.undoReadbackFailed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rescue.confirm/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /rescue.retryUndoReadback/ }));

    expect(await screen.findByRole("button", { name: /rescue.noChanges/ })).toBeDisabled();
  });
});
