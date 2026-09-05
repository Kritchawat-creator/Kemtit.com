import { describe, expect, it } from "vitest";

import {
  childPeriodType,
  elapsedRatio,
  normalizePeriodStart,
  overlaps,
  periodContains,
  periodEnd,
  periodOf,
  suggestChildPeriods,
} from "./periods";

describe("periods (cascade engine)", () => {
  it("snap ขอบ period: ปี/ไตรมาส/เดือน/สัปดาห์(อาทิตย์)/วัน", () => {
    expect(normalizePeriodStart("year", "2026-09-05")).toBe("2026-01-01");
    expect(normalizePeriodStart("quarter", "2026-09-05")).toBe("2026-07-01");
    expect(normalizePeriodStart("month", "2026-09-05")).toBe("2026-09-01");
    expect(normalizePeriodStart("week", "2026-09-05")).toBe("2026-08-30");
    expect(normalizePeriodStart("day", "2026-09-05")).toBe("2026-09-05");
  });

  it("ปลาย period", () => {
    expect(periodEnd("year", "2026-01-01")).toBe("2026-12-31");
    expect(periodEnd("quarter", "2026-07-01")).toBe("2026-09-30");
    expect(periodEnd("month", "2026-02-01")).toBe("2026-02-28");
    expect(periodEnd("week", "2026-08-30")).toBe("2026-09-05");
  });

  it("สัปดาห์ที่ทับเดือนกันยายน 2569 มี 5 สัปดาห์ และคร่อมขอบเดือนได้", () => {
    const month = periodOf("month", "2026-09-10");
    const weeks = suggestChildPeriods(month, "week");
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.start).toBe("2026-08-30");
    expect(weeks[4]?.end).toBe("2026-10-03");
    expect(weeks.every((w) => overlaps(w, month))).toBe(true);
    expect(overlaps(periodOf("week", "2026-10-11"), month)).toBe(false);
  });

  it("เดือนในปีมี 12", () => {
    expect(suggestChildPeriods(periodOf("year", "2026-05-01"), "month")).toHaveLength(12);
  });

  it("ลำดับชั้น POC: ปี→เดือน→สัปดาห์→ไม่มี", () => {
    expect(childPeriodType("year")).toBe("month");
    expect(childPeriodType("month")).toBe("week");
    expect(childPeriodType("week")).toBeNull();
  });

  it("elapsedRatio และ periodContains", () => {
    const sep = periodOf("month", "2026-09-01");
    expect(elapsedRatio(sep, "2026-08-31")).toBe(0);
    expect(elapsedRatio(sep, "2026-09-15")).toBeCloseTo(0.5, 1);
    expect(elapsedRatio(sep, "2026-10-01")).toBe(1);
    expect(periodContains(sep, "2026-09-30")).toBe(true);
    expect(periodContains(sep, "2026-10-01")).toBe(false);
  });
});
