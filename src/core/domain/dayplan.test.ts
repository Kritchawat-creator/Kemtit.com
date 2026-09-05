import { describe, expect, it } from "vitest";

import { buildDayPlan, goalTaskItems, type PlanTask } from "./dayplan";

const task = (over: Partial<PlanTask> & { id: string; due_date: string }): PlanTask => ({
  title: over.id,
  domain: "work",
  recurrence_rule: null,
  completed_at: null,
  goal_id: null,
  ...over,
});

describe("buildDayPlan", () => {
  const today = "2026-09-05";
  const tasks = [
    task({ id: "a", due_date: "2026-09-05" }),
    task({ id: "b", due_date: "2026-09-05", completed_at: "2026-09-05T03:00:00Z" }),
    task({ id: "old", due_date: "2026-09-01" }),
    task({ id: "oldDone", due_date: "2026-09-01", completed_at: "2026-09-01T03:00:00Z" }),
    task({ id: "daily", due_date: "2026-09-01", recurrence_rule: "FREQ=DAILY" }),
    task({ id: "sat", due_date: "2026-08-01", recurrence_rule: "FREQ=WEEKLY;BYDAY=SA" }),
    task({ id: "future", due_date: "2026-09-10", recurrence_rule: "FREQ=DAILY" }),
  ];

  it("วันนี้: ค้าง / ต้องทำ / เสร็จ รวม occurrence ของ task ซ้ำ", () => {
    const plan = buildDayPlan(tasks, [{ task_id: "daily", completed_on: "2026-09-05" }], today, today);
    expect(plan.overdue.map((i) => i.task.id)).toEqual(["old"]);
    expect(plan.due.map((i) => i.task.id)).toEqual(["a", "sat"]); // 5 ก.ย. 69 เป็นวันเสาร์
    expect(plan.done.map((i) => i.task.id)).toEqual(["b", "daily"]);
  });

  it("วันอื่นไม่มีกลุ่มค้าง และ task ซ้ำที่ยังไม่ถึง anchor ไม่แสดง", () => {
    const plan = buildDayPlan(tasks, [], "2026-09-06", today);
    expect(plan.overdue).toEqual([]);
    expect(plan.due.map((i) => i.task.id)).toEqual(["daily"]);
    const later = buildDayPlan(tasks, [], "2026-09-12", today);
    expect(later.due.map((i) => i.task.id)).toEqual(["daily", "sat", "future"]);
  });
});

describe("goalTaskItems", () => {
  it("task ซ้ำใช้สถานะวันนี้ task เดี่ยวใช้ completed_at และบอก overdue", () => {
    const items = goalTaskItems(
      [task({ id: "r", due_date: "2026-09-01", recurrence_rule: "FREQ=DAILY" }), task({ id: "o", due_date: "2026-09-01" })],
      [{ task_id: "r", completed_on: "2026-09-05" }],
      "2026-09-05",
    );
    expect(items.find((i) => i.task.id === "r")?.done).toBe(true);
    expect(items.find((i) => i.task.id === "o")?.overdue).toBe(true);
  });
});
