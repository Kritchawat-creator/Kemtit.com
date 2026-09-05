import { describe, expect, it } from "vitest";

import { formatRRule, occurrencesBetween, occursOn, parseRRule, type Recurrence } from "./recurrence";

describe("recurrence subset", () => {
  it("parse/format DAILY และ WEEKLY;BYDAY", () => {
    expect(parseRRule("FREQ=DAILY")).toEqual({ freq: "DAILY" });
    expect(parseRRule("FREQ=WEEKLY;BYDAY=MO,WE")).toEqual({ freq: "WEEKLY", byDay: [1, 3] });
    expect(parseRRule("FREQ=WEEKLY;BYDAY=WE,MO,MO")).toEqual({ freq: "WEEKLY", byDay: [1, 3] });
    expect(parseRRule("FREQ=MONTHLY")).toBeNull();
    expect(parseRRule(null)).toBeNull();
    expect(formatRRule({ freq: "WEEKLY", byDay: [0, 6] })).toBe("FREQ=WEEKLY;BYDAY=SU,SA");
    expect(formatRRule({ freq: "DAILY" })).toBe("FREQ=DAILY");
  });

  it("ไม่เกิดก่อน anchor; WEEKLY ไม่มี BYDAY ใช้วันของ anchor", () => {
    const daily: Recurrence = { freq: "DAILY" };
    expect(occursOn(daily, "2026-09-05", "2026-09-04")).toBe(false);
    expect(occursOn(daily, "2026-09-05", "2026-09-05")).toBe(true);
    const weeklySameDay: Recurrence = { freq: "WEEKLY", byDay: [] };
    expect(occursOn(weeklySameDay, "2026-09-05", "2026-09-12")).toBe(true); // เสาร์ → เสาร์
    expect(occursOn(weeklySameDay, "2026-09-05", "2026-09-11")).toBe(false);
  });

  it("occurrencesBetween ข้ามเดือน (จ/พ ของสัปดาห์ที่คร่อม ก.ย.-ต.ค.)", () => {
    const rule: Recurrence = { freq: "WEEKLY", byDay: [1, 3] };
    expect(occurrencesBetween(rule, "2026-09-01", "2026-09-27", "2026-10-03")).toEqual([
      "2026-09-28",
      "2026-09-30",
    ]);
    expect(occurrencesBetween({ freq: "DAILY" }, "2026-09-29", "2026-09-27", "2026-10-01")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
  });
});
