import { describe, expect, it } from "vitest";

import { buildHabitHistory, habitHistoryState } from "./history";

describe("habit history", () => {
  it("distinguishes recorded, unrecorded, pre-creation, and future days", () => {
    expect(habitHistoryState("2026-10-02", "2026-10-01", "2026-10-03", false)).toBe("notStarted");
    expect(habitHistoryState("2026-10-02", "2026-10-02", "2026-10-03", true)).toBe("done");
    expect(habitHistoryState("2026-10-02", "2026-10-03", "2026-10-03", false)).toBe("noRecord");
    expect(habitHistoryState("2026-10-02", "2026-10-04", "2026-10-03", false)).toBe("future");
  });

  it("shows weekly cadence records without turning blank days into missed targets", () => {
    const history = buildHabitHistory(
      [
        {
          id: "habit-1",
          title: "Study",
          cadence: "weekly",
          target_per_week: 3,
          created_on: "2026-10-01",
        },
      ],
      ["2026-10-02", "2026-10-03"],
      "2026-10-03",
      new Set(["habit-1:2026-10-02"]),
    );

    expect(history[0]).toMatchObject({ cadence: "weekly", target_per_week: 3 });
    expect(history[0].days.map((day) => day.state)).toEqual(["done", "noRecord"]);
  });
});
