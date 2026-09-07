import { eachDayISO, isAfterISO, isBeforeISO, daysBetween, type ISODate } from "@/lib/date";

import { elapsedRatio, periodContains, type Period } from "./periods";
import { currentStreak } from "./streak";

/**
 * "บันทึกยอด" (Claude Design turn 6/7) — pure functions ล้วน ไม่แตะ DB
 * goals.current_value คำนวณจาก sum(amount) ผ่าน DB trigger (migration goal_entries) — ที่นี่คำนวณซ้ำฝั่ง client/server
 * สำหรับกราฟ/สถิติที่ query เดียวไม่พอ (สะสมรายวัน, เทียบเดือนก่อน, streak การบันทึก)
 */
export type EntryLike = { amount: number };
export type DatedEntryLike = { entry_date: ISODate; amount: number };

/** ผลรวม amount ตรง ๆ (adjustment entry เป็นค่าลบได้ — ผลรวมจึงไม่ clamp ที่นี่ ต่างจาก goals.current_value) */
export function sumAmounts(entries: EntryLike[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

/** รวม amount ต่อวัน (ใช้ทำกราฟรายวัน) */
export function dailyTotals(entries: DatedEntryLike[]): Map<ISODate, number> {
  const totals = new Map<ISODate, number>();
  for (const e of entries) totals.set(e.entry_date, (totals.get(e.entry_date) ?? 0) + e.amount);
  return totals;
}

/**
 * แต้มกราฟสะสมทีละวันตั้งแต่ต้น period ถึง min(today, ปลาย period) — entry นอกช่วงไม่นับ
 * ใช้กับ SalesChart (phase 2): x-domain ครอบคลุมทั้ง period แม้วันที่ยังไม่มี entry ก็มีจุด (total คงที่จากวันก่อนหน้า)
 */
export function cumulativeSeries(
  entries: DatedEntryLike[],
  period: Period,
  today: ISODate,
): { date: ISODate; total: number }[] {
  const totals = dailyTotals(entries.filter((e) => periodContains(period, e.entry_date)));
  const end = isAfterISO(today, period.end) ? period.end : today;
  if (isBeforeISO(end, period.start)) return [];
  let running = 0;
  return eachDayISO(period.start, end).map((date) => {
    running += totals.get(date) ?? 0;
    return { date, total: running };
  });
}

/** เส้นแผนเฉลี่ยต่อวัน ณ วันที่กำหนด = เป้า × สัดส่วนเวลาที่ผ่านไป (จุดเดียวบนเส้นประในกราฟ) */
export function planValueAt(target: number, period: Period, date: ISODate): number {
  return target * elapsedRatio(period, date);
}

/** streak วันติดต่อกันที่มีการบันทึกยอด — สูตรเดียวกับ streak งาน (currentStreak) นับถอยหลังจากวันนี้ */
export function entryStreak(dates: Iterable<ISODate>, today: ISODate): number {
  return currentStreak(dates, today);
}

/** เฉลี่ยยอด/วัน = ยอดรวม ÷ จำนวนวันที่ผ่านไปใน period นับถึงวันนี้ (รวมวันนี้, อย่างน้อย 1 วัน) */
export function averagePerDay(total: number, period: Period, today: ISODate): number {
  let elapsedDays: number;
  if (isBeforeISO(today, period.start)) elapsedDays = 0;
  else if (isAfterISO(today, period.end)) elapsedDays = daysBetween(period.start, period.end) + 1;
  else elapsedDays = daysBetween(period.start, today) + 1;
  return Math.round(total / Math.max(1, elapsedDays));
}

/** ต้องทำเฉลี่ย/วันเท่าไรถึงจะถึงเป้าในวันที่เหลือ — วันสุดท้าย/เลยกำหนดแล้วคืนยอดที่เหลือทั้งก้อน */
export function perDayNeeded(remaining: number, daysLeft: number): number {
  return daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
}

/**
 * ส่วนต่างจากแผน (Claude Design 4a "เร็วกว่าแผน 1,700 บาท"): ทำได้จริง − (เป้า × สัดส่วนเวลาที่ผ่านไป)
 * บวก = เร็วกว่าแผน, ลบ = ช้ากว่าแผน — สูตรเดียวกับที่ GoalProgressPanel เคยคำนวณ inline
 */
export function paceDelta(current: number, target: number, period: Period, today: ISODate): number {
  return Math.round(current - target * elapsedRatio(period, today));
}

/** % เปลี่ยนแปลงเทียบค่าก่อนหน้า (ปัดเป็นจำนวนเต็ม) — null เมื่อไม่มีฐานเทียบ (previous <= 0) */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
