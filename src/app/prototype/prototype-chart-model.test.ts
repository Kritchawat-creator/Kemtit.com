import { describe, expect, it } from "vitest";
import {
  getPrototypeBarPercent,
  getPrototypeBudgetUsage,
  getPrototypeChartCeiling,
  getPrototypeEstimatedWeek,
} from "./prototype-chart-model";
import { INITIAL_PROTOTYPE_RECORDS, getPrototypeMetrics, type PrototypeRecord } from "./prototype-model";

const day = "2026-09-24" as const;
const task: PrototypeRecord = { id: "task", type: "task", title: "Task", date: day, scope: "work", tone: "work", status: "planned", durationMinutes: 60 };

describe("prototype chart data contracts", () => {
  it("preserves very small values instead of imposing a 5% minimum", () => {
    const ceiling = getPrototypeChartCeiling([600, 5]);
    expect(getPrototypeBarPercent(5, ceiling) / getPrototypeBarPercent(600, ceiling)).toBeCloseTo(5 / 600, 10);
    expect(getPrototypeBarPercent(0, ceiling)).toBe(0);
  });

  it("uses a finite positive domain for empty, zero, and unknown data", () => {
    for (const values of [[], [0, 0], [null], [NaN, -1]]) {
      expect(getPrototypeChartCeiling(values)).toBe(60);
    }
    expect(getPrototypeBarPercent(null, 60)).toBe(0);
    expect(getPrototypeBarPercent(NaN, 60)).toBe(0);
    expect(getPrototypeBarPercent(10, 0)).toBe(0);
  });

  it("distinguishes no work, explicit zero, and a missing estimate", () => {
    expect(getPrototypeEstimatedWeek([], day, "all").find((point) => point.date === day)?.minutes).toBe(0);
    const unknown = { ...task, durationMinutes: undefined };
    const partial = getPrototypeEstimatedWeek([unknown, { ...task, id: "known" }], day, "all").find((point) => point.date === day);
    expect(partial?.minutes).toBeNull();
    expect(partial?.knownMinutes).toBe(60);
    expect(partial?.missingEstimateCount).toBe(1);
    const zero = getPrototypeEstimatedWeek([{ ...task, durationMinutes: 0 }], day, "all").find((point) => point.date === day);
    expect(zero?.minutes).toBe(0);
    expect(zero?.missingEstimateCount).toBe(0);
  });

  it("excludes Inbox and archived tasks, like the Today metrics", () => {
    const records = [task, { ...task, id: "inbox", status: "inbox" as const }, { ...task, id: "archived", status: "archived" as const }];
    const metrics = getPrototypeMetrics(records, [], [], day, "all", new Set(["task"]));
    const point = getPrototypeEstimatedWeek(records, day, "all").find((item) => item.date === day);
    expect(metrics.completedTaskCount).toBe(1);
    expect(metrics.taskCount).toBe(1);
    expect(point?.minutes).toBe(60);
    expect(point?.itemCount).toBe(1);
  });

  it("keeps area, week boundaries and canonical dates in the projection", () => {
    const records = [task, { ...task, id: "life", scope: "life" as const, durationMinutes: 30 }];
    const work = getPrototypeEstimatedWeek(records, day, "work");
    expect(work).toHaveLength(7);
    expect(work[0].date).toBe("2026-09-21");
    expect(work[6].date).toBe("2026-09-27");
    expect(work.find((point) => point.date === day)?.minutes).toBe(60);
    expect(getPrototypeEstimatedWeek(records, day, "all").find((point) => point.date === day)?.minutes).toBe(90);
  });

  it("keeps workload as estimates plus events, not estimates plus task blocks", () => {
    const point = getPrototypeEstimatedWeek(INITIAL_PROTOTYPE_RECORDS, day, "all").find((item) => item.date === day);
    expect(point?.minutes).toBe(450);
  });

  it("shows overspend while capping only the visual track", () => {
    expect(getPrototypeBudgetUsage(26000, 20000)).toEqual({ percent: 130, barPercent: 100, overAmount: 6000 });
    expect(getPrototypeBudgetUsage(10000, 20000)).toEqual({ percent: 50, barPercent: 50, overAmount: 0 });
  });

  it("does not divide by a missing, invalid or zero budget", () => {
    expect(getPrototypeBudgetUsage(100, 0).percent).toBeNull();
    expect(getPrototypeBudgetUsage(NaN, 20000).percent).toBeNull();
  });
});
