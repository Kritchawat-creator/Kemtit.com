import { describe, expect, it } from "vitest";

import { periodOf } from "./periods";
import { buildProgressIndex, computeProgress, isMetricComplete, paceStatus, type GoalLike, type TaskLike } from "./progress";

const goal = (over: Partial<GoalLike> & { id: string }): GoalLike => ({
  parent_id: null,
  goal_kind: "execution",
  target_value: null,
  current_value: 0,
  ...over,
});
const task = (goal_id: string, done: boolean, rule: string | null = null): TaskLike => ({
  goal_id,
  completed_at: done ? "2026-09-05T10:00:00Z" : null,
  recurrence_rule: rule,
});

describe("computeProgress (POC Decisions 1.1-1.2)", () => {
  it("metric = current/target ไม่สน task", () => {
    const g = goal({ id: "m", goal_kind: "metric", target_value: 50000, current_value: 20000 });
    expect(computeProgress(g, [], [task("m", true), task("m", false)])).toBe(40);
    expect(computeProgress(goal({ id: "m2", goal_kind: "metric", target_value: 100, current_value: 250 }), [], [])).toBe(100);
    expect(computeProgress(goal({ id: "m3", goal_kind: "metric", target_value: null }), [], [])).toBe(0);
  });

  it("execution = ค่าเฉลี่ยของ child แต่ละตัว + อัตราส่วน task ตรง (น้ำหนักเท่ากัน)", () => {
    const parent = goal({ id: "p" });
    const c1 = goal({ id: "c1", parent_id: "p", goal_kind: "metric", target_value: 100, current_value: 100 }); // 100
    const c2 = goal({ id: "c2", parent_id: "p" }); // 0 (ไม่มีลูก)
    const tasks = [task("p", true), task("p", false), task("p", false), task("p", false)]; // 25
    // (100 + 0 + 25) / 3
    expect(computeProgress(parent, [c1, c2], tasks)).toBeCloseTo(41.67, 1);
  });

  it("ไม่มีลูกเลย = 0 และ task ซ้ำไม่นับ", () => {
    const p = goal({ id: "p" });
    expect(computeProgress(p, [], [])).toBe(0);
    expect(computeProgress(p, [], [task("p", false, "FREQ=DAILY"), task("p", true)])).toBe(100);
  });
});

describe("buildProgressIndex", () => {
  it("คำนวณ bottom-up หลายชั้น", () => {
    const year = goal({ id: "y" });
    const month = goal({ id: "m", parent_id: "y", goal_kind: "metric", target_value: 100, current_value: 50 });
    const week = goal({ id: "w", parent_id: "y" });
    const idx = buildProgressIndex([year, month, week], [task("w", true), task("w", true)]);
    expect(idx.get("m")?.percent).toBe(50);
    expect(idx.get("w")?.percent).toBe(100);
    expect(idx.get("w")?.tasksDone).toBe(2);
    expect(idx.get("y")?.percent).toBe(75);
    expect(idx.get("y")?.childCount).toBe(2);
  });
});

describe("paceStatus / isMetricComplete", () => {
  const sep = periodOf("month", "2026-09-01");
  it("ตกเป้าเมื่อต่ำกว่าเวลาที่ผ่านไปเกิน 10 จุด", () => {
    expect(paceStatus(20, sep, "2026-09-15")).toBe("behind"); // elapsed 50%
    expect(paceStatus(45, sep, "2026-09-15")).toBe("onTrack");
    expect(paceStatus(0, sep, "2026-08-20")).toBe("notStarted");
    expect(paceStatus(100, sep, "2026-09-02")).toBe("done");
  });
  it("metric สำเร็จเมื่อถึงเป้า", () => {
    expect(isMetricComplete({ goal_kind: "metric", target_value: 10, current_value: 10 })).toBe(true);
    expect(isMetricComplete({ goal_kind: "metric", target_value: 10, current_value: 9.99 })).toBe(false);
    expect(isMetricComplete({ goal_kind: "execution", target_value: null, current_value: 0 })).toBe(false);
  });
});
