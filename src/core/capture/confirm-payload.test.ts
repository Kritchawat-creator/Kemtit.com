import { describe, expect, it } from "vitest";

import type { CaptureProposal } from "./parse";
import { buildConfirmCapturePayload } from "./confirm-payload";

const today = "2026-09-26";

function proposal(overrides: Partial<CaptureProposal> = {}): CaptureProposal {
  return {
    kind: "task",
    supported: true,
    title: "Send the report",
    domain: "work",
    dueDate: null,
    periodStart: null,
    cadence: null,
    recurrence: null,
    targetPerWeek: null,
    estimatedMinutes: null,
    amount: null,
    currency: null,
    ...overrides,
  };
}

describe("buildConfirmCapturePayload", () => {
  it("maps each supported capture kind to its canonical action payload", () => {
    expect(buildConfirmCapturePayload(proposal(), "request-1", today)).toEqual({
      requestId: "request-1",
      kind: "task",
      title: "Send the report",
      domain: "work",
      dueDate: today,
      estimatedMinutes: null,
    });
    expect(
      buildConfirmCapturePayload(
        proposal({ kind: "habit", cadence: "weekly", targetPerWeek: 4 }),
        "request-1",
        today,
      ),
    ).toEqual({
      requestId: "request-1",
      kind: "habit",
      title: "Send the report",
      domain: "work",
      cadence: "weekly",
      targetPerWeek: 4,
    });
    expect(
      buildConfirmCapturePayload(
        proposal({ kind: "goal", periodStart: "2026-10-01" }),
        "request-1",
        today,
      ),
    ).toEqual({
      requestId: "request-1",
      kind: "goal",
      title: "Send the report",
      domain: "work",
      periodStart: "2026-10-01",
    });
    expect(
      buildConfirmCapturePayload(
        proposal({ kind: "event", dueDate: "2026-09-27" }),
        "request-1",
        today,
      ),
    ).toEqual({
      requestId: "request-1",
      kind: "event",
      title: "Send the report",
      eventDate: "2026-09-27",
    });
    expect(
      buildConfirmCapturePayload(
        proposal({ kind: "bill", amount: 1200, dueDate: "2026-10-01", recurrence: "monthly" }),
        "request-1",
        today,
      ),
    ).toEqual({
      requestId: "request-1",
      kind: "bill",
      title: "Send the report",
      amount: 1200,
      dueDate: "2026-10-01",
      recurrence: "monthly",
    });
    expect(
      buildConfirmCapturePayload(
        proposal({ kind: "expense", amount: 250, dueDate: "2026-09-25" }),
        "request-1",
        today,
      ),
    ).toEqual({
      requestId: "request-1",
      kind: "expense",
      title: "Send the report",
      amount: 250,
      occurredOn: "2026-09-25",
    });
    expect(buildConfirmCapturePayload(proposal({ kind: "note" }), "request-1", today)).toEqual({
      requestId: "request-1",
      kind: "note",
      title: "Send the report",
    });
  });

  it("uses safe defaults and rejects an expense without a positive amount", () => {
    expect(
      buildConfirmCapturePayload(
        proposal({ kind: "habit", cadence: null, targetPerWeek: null }),
        "request-1",
        today,
      ),
    ).toMatchObject({ cadence: "daily", targetPerWeek: 7 });
    expect(
      buildConfirmCapturePayload(proposal({ kind: "bill", amount: null }), "request-1", today),
    ).toMatchObject({ kind: "bill", amount: null, dueDate: today, recurrence: "none" });
    expect(
      buildConfirmCapturePayload(proposal({ kind: "expense", amount: null }), "request-1", today),
    ).toBeNull();
    expect(
      buildConfirmCapturePayload(proposal({ kind: "expense", amount: 0 }), "request-1", today),
    ).toBeNull();
  });
});
