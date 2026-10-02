import { describe, expect, it } from "vitest";
import type { PrototypeRecord } from "./prototype-model";
import { getWeekDayEntries, getWeekDayPreview } from "./prototype-week-model";

const date = "2026-09-24" as const;
const event = (id: string, time = "09:00"): PrototypeRecord => ({ id, title: id, type: "event", date, scope: "work", tone: "work", startTime: time, durationMinutes: 30 });

describe("week overflow presentation", () => {
  for (const count of [0, 1, 5, 6, 10, 12, 20, 50]) {
    it(`shows at most five of ${count} items with an exact overflow count`, () => {
      const records = Array.from({ length: count }, (_, index) => event(String(index)));
      const entries = getWeekDayEntries(records, date);
      const preview = getWeekDayPreview(entries);
      expect(preview.visible.length).toBe(Math.min(5, count));
      expect(preview.remaining).toBe(Math.max(0, count - 5));
      expect(preview.total).toBe(count);
      expect(entries.length).toBe(count);
    });
  }
  it("sorts real event times without inventing a time for an untimed task", () => {
    const task: PrototypeRecord = { id: "task", title: "Task", type: "task", date, scope: "work", tone: "work", durationMinutes: 45 };
    const records = [event("late", "16:00"), task, event("early", "09:00")];
    const entries = getWeekDayEntries(records, date);
    expect(entries.map((entry) => entry.record.id)).toEqual(["early", "late", "task"]);
    expect(entries[2].timing).toBe("Task · 45m estimate");
    expect(records[0].id).toBe("late");
    expect(entries[2].record).toBe(task);
  });
  it("keeps one item for several time blocks linked to the same task", () => {
    const task: PrototypeRecord = { ...event("task"), type: "task", startTime: undefined };
    const entries = getWeekDayEntries([task, task], date, [
      { id: "block-b", itemId: task.id, date, startTime: "14:00", durationMinutes: 30 },
      { id: "block-a", itemId: task.id, date, startTime: "11:00", durationMinutes: 60 },
    ]);
    expect(entries.length).toBe(1);
    expect(entries[0].record).toBe(task);
    expect(entries[0].timing).toBe("11:00–12:00 · 14:00–14:30");
  });
  it("does not turn archived or Inbox records into planned items", () => {
    expect(getWeekDayEntries([{ ...event("a"), status: "archived" }, { ...event("b"), status: "inbox" }], date)).toEqual([]);
  });
  it("keeps invalid times explicit and indicates overnight event ranges", () => {
    const entries = getWeekDayEntries([{ ...event("invalid"), startTime: "25:00" }, { ...event("night", "23:30"), durationMinutes: 60 }], date);
    expect(entries[0].timing).toBe("23:30–00:30 (+1d)");
    expect(entries[1].timing).toBe("Event · Time not set");
  });
});
