import { describe, expect, it } from "vitest";

import { prepareCapture } from "./parse";

describe("prepareCapture", () => {
  const today = "2026-09-20";

  it("detects a bill and keeps the canonical finance type", () => {
    const proposal = prepareCapture("Pay electricity bill this Friday, 1,200 THB", today);
    expect(proposal.kind).toBe("bill");
    expect(proposal.supported).toBe(true);
    expect(proposal.domain).toBe("finance");
    expect(proposal.dueDate).toBe("2026-09-25");
    expect(proposal.amount).toBe(1200);
  });

  it("suggests monthly recurrence when a bill explicitly says monthly", () => {
    const proposal = prepareCapture("ค่าเช่าทุกเดือน 8,000 บาท", today);
    expect(proposal.kind).toBe("bill");
    expect(proposal.recurrence).toBe("monthly");
  });

  it("keeps everyday spending as Expense instead of a Bill", () => {
    const proposal = prepareCapture("จ่ายค่าอาหาร 250 บาท วันนี้", today);
    expect(proposal.kind).toBe("expense");
    expect(proposal.domain).toBe("finance");
    expect(proposal.amount).toBe(250);
    expect(proposal.dueDate).toBe(today);
  });

  it("detects a recurring habit with deterministic defaults", () => {
    const proposal = prepareCapture("ออกกำลังกายทุกสัปดาห์", today);
    expect(proposal.kind).toBe("habit");
    expect(proposal.supported).toBe(true);
    expect(proposal.domain).toBe("health");
    expect(proposal.cadence).toBe("weekly");
    expect(proposal.targetPerWeek).toBe(3);
  });

  it("detects an event without converting it to a task", () => {
    const proposal = prepareCapture("ประชุมทีมพรุ่งนี้", today);
    expect(proposal.kind).toBe("event");
    expect(proposal.dueDate).toBe("2026-09-21");
  });

  it("uses the user's preferred domain only when text has no stronger context", () => {
    const proposal = prepareCapture("เตรียมเอกสาร", today, undefined, "growth");
    expect(proposal.kind).toBe("task");
    expect(proposal.domain).toBe("growth");

    const health = prepareCapture("นัดหมอ", today, "task", "work");
    expect(health.domain).toBe("health");
  });

  it("allows an explicit manual override", () => {
    const proposal = prepareCapture("จ่ายค่าไฟพรุ่งนี้", today, "task");
    expect(proposal.kind).toBe("task");
    expect(proposal.supported).toBe(true);
    expect(proposal.dueDate).toBe("2026-09-21");
    expect(proposal.domain).toBe("finance");
  });

  it("uses history defaults only when the input does not provide a stronger value", () => {
    const task = prepareCapture("เตรียมเอกสาร", today, undefined, "work", {
      taskEstimatedMinutes: 45,
      habitCadence: "weekly",
      habitTargetPerWeek: 4,
    });
    expect(task.estimatedMinutes).toBe(45);

    const routine = prepareCapture("routine ทบทวนภาษา", today, undefined, "growth", {
      habitCadence: "weekly",
      habitTargetPerWeek: 4,
    });
    expect(routine.cadence).toBe("weekly");
    expect(routine.targetPerWeek).toBe(4);

    const explicitDaily = prepareCapture("ทบทวนภาษาทุกวัน", today, "habit", "growth", {
      habitCadence: "weekly",
      habitTargetPerWeek: 4,
    });
    expect(explicitDaily.cadence).toBe("daily");
  });
});
