import { describe, expect, it } from "vitest";

import { buildRescueProposal } from "./rescue";

const task = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "งานหนึ่ง",
  estimatedMinutes: 60,
  priority: "normal" as const,
  deadline: null,
  plannedDate: "2026-09-22",
  updatedAt: "2026-09-22T00:00:00.000Z",
  recurring: false,
  ...overrides,
});

describe("buildRescueProposal", () => {
  it("ranks high priority before normal priority deterministically", () => {
    const proposal = buildRescueProposal({
      targetDate: "2026-09-22",
      freeIntervals: [{ start: 0, end: 60 * 60_000 }],
      tasks: [task({ id: "normal", title: "ปกติ" }), task({ id: "high", title: "ด่วน", priority: "high" })],
    });

    expect(proposal.items.map((item) => item.taskId)).toEqual(["high", "normal"]);
    expect(proposal.items[0]?.action).toBe("move");
    expect(proposal.items[1]?.action).toBe("unplaced");
  });

  it("keeps deadline data and marks a late target at risk", () => {
    const proposal = buildRescueProposal({
      targetDate: "2026-09-26",
      freeIntervals: [{ start: 0, end: 60 * 60_000 }],
      tasks: [task({ deadline: "2026-09-25" })],
    });

    expect(proposal.items[0]).toMatchObject({ action: "at_risk", reason: "targetAfterDeadline" });
  });

  it("does not move a locked block", () => {
    const proposal = buildRescueProposal({
      targetDate: "2026-09-22",
      freeIntervals: [],
      tasks: [
        task({
          currentBlock: {
            id: "block-1",
            start: 0,
            end: 60 * 60_000,
            version: 3,
            isLocked: true,
          },
        }),
      ],
    });

    expect(proposal.items[0]).toMatchObject({
      action: "keep",
      reason: "locked",
      blockId: "block-1",
      expectedBlockVersion: 3,
    });
  });

  it("never splits a task across two windows", () => {
    const proposal = buildRescueProposal({
      targetDate: "2026-09-22",
      freeIntervals: [
        { start: 0, end: 30 * 60_000 },
        { start: 45 * 60_000, end: 75 * 60_000 },
      ],
      tasks: [task({ estimatedMinutes: 45 })],
    });

    expect(proposal.items[0]?.action).toBe("unplaced");
  });
});
