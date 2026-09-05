import { describe, expect, it } from "vitest";

import {
  addDaysISO,
  daysBetween,
  eachDayISO,
  endOfMonthISO,
  endOfWeekISO,
  isISODate,
  startOfWeekISO,
  toBkkDate,
  todayBkk,
  weekdayOf,
} from "./date";

describe("date (Asia/Bangkok, สัปดาห์เริ่มอาทิตย์)", () => {
  it("todayBkk ข้ามวันตามเวลาไทย ไม่ใช่ UTC", () => {
    // 2026-09-05 17:30 UTC = 2026-09-06 00:30 เวลาไทย
    expect(todayBkk(new Date("2026-09-05T17:30:00Z"))).toBe("2026-09-06");
    expect(todayBkk(new Date("2026-09-05T16:59:00Z"))).toBe("2026-09-05");
  });

  it("toBkkDate แปลง timestamptz เป็นวันไทย", () => {
    expect(toBkkDate("2026-09-05T18:00:00Z")).toBe("2026-09-06");
  });

  it("สัปดาห์เริ่มอาทิตย์จบเสาร์", () => {
    // 2026-09-05 เป็นวันเสาร์
    expect(weekdayOf("2026-09-05")).toBe(6);
    expect(startOfWeekISO("2026-09-05")).toBe("2026-08-30");
    expect(endOfWeekISO("2026-09-05")).toBe("2026-09-05");
    expect(startOfWeekISO("2026-09-06")).toBe("2026-09-06");
  });

  it("ขอบเดือนและการบวกวันข้ามเดือน", () => {
    expect(endOfMonthISO("2026-02-10")).toBe("2026-02-28");
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(daysBetween("2026-09-01", "2026-09-30")).toBe(29);
  });

  it("eachDayISO รวมทั้งสองข้าง", () => {
    expect(eachDayISO("2026-09-04", "2026-09-06")).toEqual(["2026-09-04", "2026-09-05", "2026-09-06"]);
  });

  it("isISODate ปฏิเสธรูปแบบผิด", () => {
    expect(isISODate("2026-09-05")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("05/09/2026")).toBe(false);
  });
});
