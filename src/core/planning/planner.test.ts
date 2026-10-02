import { describe, expect, it } from "vitest";

import { childPlannerView, plannerPeriod, shiftPlannerDate } from "./planner";

describe("planner hierarchy", () => {
  it("keeps the product hierarchy Year → Month → Week → Today", () => {
    expect(childPlannerView("year")).toBe("month");
    expect(childPlannerView("month")).toBe("week");
    expect(childPlannerView("week")).toBeNull();
  });

  it("snaps periods without creating duplicate plan records", () => {
    expect(plannerPeriod("month", "2026-09-20")).toEqual({
      type: "month",
      start: "2026-09-01",
      end: "2026-09-30",
    });
    expect(shiftPlannerDate("month", "2026-09-20", 1)).toBe("2026-10-01");
  });
});
