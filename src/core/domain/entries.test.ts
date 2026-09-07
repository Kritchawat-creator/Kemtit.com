import { describe, expect, it } from "vitest";

import { periodOf } from "./periods";
import {
  averagePerDay,
  cumulativeSeries,
  dailyTotals,
  entryStreak,
  paceDelta,
  perDayNeeded,
  percentChange,
  planValueAt,
  sumAmounts,
  type DatedEntryLike,
} from "./entries";

const SEPT = periodOf("month", "2026-09-15"); // 2026-09-01 .. 2026-09-30 (30 วัน)

describe("sumAmounts", () => {
  it("ไม่มี entry เลย = 0", () => {
    expect(sumAmounts([])).toBe(0);
  });

  it("รวมทั้งบวกและลบ (adjustment entry ติดลบได้)", () => {
    expect(sumAmounts([{ amount: 1000 }, { amount: -200 }, { amount: 500 }])).toBe(1300);
  });
});

describe("dailyTotals", () => {
  it("รวม amount ของวันเดียวกัน แยก key ตามวัน", () => {
    const totals = dailyTotals([
      { entry_date: "2026-09-05", amount: 1000 },
      { entry_date: "2026-09-05", amount: 500 },
      { entry_date: "2026-09-06", amount: 200 },
    ]);
    expect(totals.get("2026-09-05")).toBe(1500);
    expect(totals.get("2026-09-06")).toBe(200);
    expect(totals.size).toBe(2);
  });
});

describe("cumulativeSeries", () => {
  it("ไม่มี entry เลย = จุดเดียวต่อวันตั้งแต่ต้น period ถึงวันนี้ ทุกจุด total 0", () => {
    const series = cumulativeSeries([], SEPT, "2026-09-05");
    expect(series).toHaveLength(5); // 1..5 ก.ย.
    expect(series.every((p) => p.total === 0)).toBe(true);
    expect(series[0]?.date).toBe("2026-09-01");
    expect(series.at(-1)?.date).toBe("2026-09-05");
  });

  it("entry ก่อน/หลัง period ไม่นับ — สะสมเฉพาะที่อยู่ในช่วง", () => {
    const entries: DatedEntryLike[] = [
      { entry_date: "2026-08-31", amount: 9999 }, // ก่อน period
      { entry_date: "2026-09-05", amount: 1000 },
      { entry_date: "2026-09-10", amount: 500 },
      { entry_date: "2026-10-01", amount: 8888 }, // หลัง period
    ];
    const series = cumulativeSeries(entries, SEPT, "2026-09-12");
    expect(series).toHaveLength(12); // 1..12 ก.ย. (ตัดที่ today เพราะ today < period.end)
    expect(series.find((p) => p.date === "2026-09-04")?.total).toBe(0);
    expect(series.find((p) => p.date === "2026-09-05")?.total).toBe(1000);
    expect(series.find((p) => p.date === "2026-09-09")?.total).toBe(1000);
    expect(series.find((p) => p.date === "2026-09-10")?.total).toBe(1500);
    expect(series.at(-1)?.total).toBe(1500);
  });

  it("today ก่อน period เริ่ม = ไม่มีจุดเลย", () => {
    expect(cumulativeSeries([], SEPT, "2026-08-20")).toEqual([]);
  });
});

describe("planValueAt", () => {
  it("= target × สัดส่วนเวลาที่ผ่านไป", () => {
    // 15 ก.ย. จาก 30 วัน = ผ่านมาแล้ว 15/30 = 0.5
    expect(planValueAt(3000, SEPT, "2026-09-15")).toBe(1500);
    expect(planValueAt(3000, SEPT, "2026-09-01")).toBeCloseTo(100, 0);
  });
});

describe("entryStreak", () => {
  it("นับวันติดกันถอยหลังจากวันนี้ (ใช้สูตรเดียวกับ currentStreak)", () => {
    expect(entryStreak(["2026-09-03", "2026-09-04", "2026-09-05"], "2026-09-05")).toBe(3);
  });

  it("มีช่องว่างระหว่างวัน — เริ่มนับใหม่จากวันล่าสุดที่ติดกัน", () => {
    expect(entryStreak(["2026-09-01", "2026-09-04", "2026-09-05"], "2026-09-05")).toBe(2);
    expect(entryStreak([], "2026-09-05")).toBe(0);
  });
});

describe("averagePerDay", () => {
  it("กลาง period: ผลรวม ÷ จำนวนวันที่ผ่านไป (รวมวันนี้)", () => {
    expect(averagePerDay(1500, SEPT, "2026-09-15")).toBe(100); // 1500/15
  });

  it("today หลัง period จบ: หารด้วยจำนวนวันเต็ม period", () => {
    expect(averagePerDay(3000, SEPT, "2026-10-05")).toBe(100); // 3000/30
  });

  it("today ก่อน period เริ่ม: ยังไม่มีวันผ่านไปเลย → หารด้วย 1 (กันหารศูนย์)", () => {
    expect(averagePerDay(500, SEPT, "2026-08-20")).toBe(500);
  });
});

describe("perDayNeeded", () => {
  it("หารลงตัว", () => {
    expect(perDayNeeded(1000, 4)).toBe(250);
  });

  it("หารไม่ลงตัว — ปัดขึ้น", () => {
    expect(perDayNeeded(1001, 4)).toBe(251);
  });

  it("ไม่เหลือวันแล้ว (daysLeft <= 0) — คืนยอดที่เหลือทั้งก้อน", () => {
    expect(perDayNeeded(500, 0)).toBe(500);
    expect(perDayNeeded(500, -2)).toBe(500);
  });
});

describe("paceDelta", () => {
  it("เร็วกว่าแผน = บวก", () => {
    // ผ่านมา 50% ของเป้า 10000 = แผน 5000; ทำได้ 6000 → เร็วกว่า 1000
    expect(paceDelta(6000, 10000, SEPT, "2026-09-15")).toBe(1000);
  });

  it("ช้ากว่าแผน = ลบ", () => {
    expect(paceDelta(4000, 10000, SEPT, "2026-09-15")).toBe(-1000);
  });

  it("ตรงแผนพอดี = 0", () => {
    expect(paceDelta(5000, 10000, SEPT, "2026-09-15")).toBe(0);
  });
});

describe("percentChange", () => {
  it("เพิ่มขึ้นจากค่าก่อนหน้า", () => {
    expect(percentChange(1200, 1000)).toBe(20);
  });

  it("ลดลงจากค่าก่อนหน้า", () => {
    expect(percentChange(800, 1000)).toBe(-20);
  });

  it("ไม่มีฐานเทียบ (previous <= 0) = null", () => {
    expect(percentChange(1000, 0)).toBeNull();
    expect(percentChange(1000, -50)).toBeNull();
  });
});
