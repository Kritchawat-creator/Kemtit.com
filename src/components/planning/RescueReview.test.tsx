// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/planning/actions", () => ({
  confirmRescue: vi.fn(),
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
  vi.stubGlobal("crypto", { randomUUID: () => "rescue-test-operation" });
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
});
