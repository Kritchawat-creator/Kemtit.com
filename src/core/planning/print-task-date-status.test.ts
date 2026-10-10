import { describe, expect, it } from "vitest";

import { getPrintTaskDateStatus } from "./print-task-date-status";

describe("getPrintTaskDateStatus", () => {
  it("shows a past planned date instead of calling it overdue when there is no deadline", () => {
    expect(
      getPrintTaskDateStatus(
        { deadline: null, planned_date: "2026-10-09", due_date: "2026-10-09" },
        "2026-10-10",
      ),
    ).toEqual({ kind: "planned", date: "2026-10-09" });
  });

  it("keeps overdue status for an elapsed explicit deadline", () => {
    expect(
      getPrintTaskDateStatus(
        { deadline: "2026-10-09", planned_date: "2026-10-08", due_date: "2026-10-08" },
        "2026-10-10",
      ),
    ).toEqual({ kind: "overdue" });
  });

  it("shows a past plan date while a later actual deadline is still open", () => {
    expect(
      getPrintTaskDateStatus(
        { deadline: "2026-10-12", planned_date: "2026-10-09", due_date: "2026-10-09" },
        "2026-10-10",
      ),
    ).toEqual({ kind: "planned", date: "2026-10-09" });
  });

  it("does not label a plan date that is the displayed day", () => {
    expect(
      getPrintTaskDateStatus(
        { deadline: null, planned_date: "2026-10-10", due_date: "2026-10-10" },
        "2026-10-10",
      ),
    ).toBeNull();
  });
});
