import { describe, expect, it } from "vitest";

import { hasMeasuredGoalProgress } from "./overview";

describe("goal overview progress", () => {
  it("does not report an empty execution goal as zero percent progress", () => {
    expect(
      hasMeasuredGoalProgress({
        progress: { kind: "execution", percent: 0, childCount: 0, tasksDone: 0, tasksTotal: 0 },
      }),
    ).toBe(false);
  });

  it("shows progress when it is measured by a task, child goal, or metric", () => {
    expect(
      hasMeasuredGoalProgress({
        progress: { kind: "execution", percent: 0, childCount: 0, tasksDone: 0, tasksTotal: 1 },
      }),
    ).toBe(true);
    expect(
      hasMeasuredGoalProgress({
        progress: { kind: "execution", percent: 0, childCount: 1, tasksDone: 0, tasksTotal: 0 },
      }),
    ).toBe(true);
    expect(
      hasMeasuredGoalProgress({
        progress: { kind: "metric", percent: 0, childCount: 0, current: 0, target: 5 },
      }),
    ).toBe(true);
  });
});
