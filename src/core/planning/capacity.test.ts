import { describe, expect, it } from "vitest";

import { calculateCapacity, calculateEffectiveAvailableMinutes } from "./capacity";

describe("calculateCapacity", () => {
  it("uses the default duration when a task has no estimate", () => {
    expect(calculateCapacity(60, [{ status: "planned" }, { status: "completed" }])).toMatchObject({
      plannedMinutes: 30,
      remainingMinutes: 30,
      taskCount: 1,
    });
  });

  it("reports over-capacity without returning negative remaining time", () => {
    expect(
      calculateCapacity(45, [{ estimated_minutes: 60 }, { estimated_minutes: 30 }]),
    ).toMatchObject({
      plannedMinutes: 90,
      remainingMinutes: 0,
      overCapacityMinutes: 45,
    });
  });

  it("does not count the estimate again when a linked block already covers it", () => {
    expect(
      calculateCapacity(60, [{ estimated_minutes: 60 }], { linkedTaskMinutes: 60 }),
    ).toMatchObject({
      plannedMinutes: 60,
      scheduledTaskMinutes: 60,
      unscheduledTaskMinutes: 0,
      remainingMinutes: 60,
      overCapacityMinutes: 0,
    });
  });

  it("subtracts scheduled blocks from a configured budget before counting unscheduled work", () => {
    const availableMinutes = calculateEffectiveAvailableMinutes(180, 420, 30);
    const capacity = calculateCapacity(
      availableMinutes,
      [{ estimated_minutes: 30 }, { estimated_minutes: 45 }],
      { linkedTaskMinutes: 30 },
    );

    expect(availableMinutes).toBe(150);
    expect(capacity).toMatchObject({
      plannedMinutes: 75,
      scheduledTaskMinutes: 30,
      unscheduledTaskMinutes: 45,
      remainingMinutes: 105,
    });
  });

  it("uses calendar free time directly when there is no saved day budget", () => {
    expect(calculateEffectiveAvailableMinutes(null, 420, 30)).toBe(420);
    expect(calculateEffectiveAvailableMinutes(180, 15, 30)).toBe(15);
  });
});
