import { describe, expect, it } from "vitest";

import {
  avatarLetter,
  formatDate,
  formatDateTime,
  formatDayDistance,
  formatPercent,
  formatTHB,
  formatThaiDate,
  formatValueWithUnit,
  formatWeekdayNarrow,
  formatWeekdayShort,
  formatYear,
} from "./format";

describe("format (th-TH, พ.ศ.)", () => {
  it("บาทปัดเป็นจำนวนเต็มเมื่อไม่มีสตางค์", () => {
    expect(formatTHB(50000)).toMatch(/50,000/);
    expect(formatTHB(50000)).toMatch(/฿|บาท|THB/);
    expect(formatTHB(1234.5)).toMatch(/1,234\.50/);
  });

  it("เปอร์เซ็นต์รับสัดส่วน 0-1 และไม่เกิน 100%", () => {
    expect(formatPercent(0.42)).toBe("42%");
    expect(formatPercent(1.7)).toBe("100%");
    expect(formatPercent(-0.2)).toBe("0%");
  });

  it("ค่าพร้อมหน่วย", () => {
    expect(formatValueWithUnit(12, "เล่ม")).toBe("12 เล่ม");
    expect(formatValueWithUnit(1200, "THB")).toMatch(/1,200/);
  });

  it("วันที่เป็น พ.ศ. และไม่เลื่อนวันตาม timezone", () => {
    const s = formatThaiDate("2026-09-05", "medium");
    expect(s).toContain("2569");
    expect(s).toMatch(/^5 /);
    expect(formatThaiDate("2026-01-01", "monthYear")).toContain("2569");
  });

  it("ชื่อวันย่อภาษาไทย อาทิตย์เป็นวันแรก", () => {
    expect(formatWeekdayShort("2026-09-06")).toMatch(/อา/);
  });

  it("ระยะห่างเป็นวันแบบ relative", () => {
    expect(formatDayDistance("2026-09-05", "2026-09-05")).toMatch(/วันนี้/);
    expect(formatDayDistance("2026-09-06", "2026-09-05")).toMatch(/พรุ่งนี้/);
    expect(formatDayDistance("2026-09-04", "2026-09-05")).toMatch(/เมื่อวาน/);
  });
});

describe("locale-aware calendar formatting", () => {
  it("Thai uses Buddhist Era and Thai calendar labels", () => {
    const date = "2026-09-26";
    expect(formatDate(date, "long", "th")).toContain("2569");
    expect(formatYear(date, "th")).toContain("2569");
    expect(formatWeekdayNarrow(date, "th")).toMatch(/[ก-๙]/);
  });

  it("English uses Gregorian year and English calendar labels", () => {
    const date = "2026-09-26";
    const formatted = formatDate(date, "long", "en");
    expect(formatted).toContain("2026");
    expect(formatted).toMatch(/September/i);
    expect(formatted).not.toContain("2569");
    expect(formatYear(date, "en")).toContain("2026");
    expect(formatWeekdayNarrow(date, "en")).toMatch(/Sat/i);
  });

  it("both languages render timestamps in Asia/Bangkok UTC+7", () => {
    const timestamp = "2026-09-26T00:00:00.000Z";
    expect(formatDateTime(timestamp, "th")).toMatch(/07[:.]00/);
    expect(formatDateTime(timestamp, "en")).toMatch(/07[:.]00/);
  });
});

describe("avatarLetter", () => {
  it("ตัวอักษรแรกของชื่อ (ไทยไม่แปลงตัวพิมพ์) → อีเมล → ?", () => {
    expect(avatarLetter("ปุ๊ก ขายดี")).toBe("ป");
    expect(avatarLetter("  ", "somchai@example.com")).toBe("s");
    expect(avatarLetter(null, null)).toBe("?");
  });
});