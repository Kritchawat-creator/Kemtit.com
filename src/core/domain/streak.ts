import { addDaysISO, type ISODate } from "@/lib/date";

/**
 * Streak = จำนวนวันติดต่อกันที่มีการทำ task เสร็จ นับถอยหลังจากวันนี้ (หรือเมื่อวาน ถ้าวันนี้ยังไม่ทำ)
 * metric §14 "ทำ task ต่อเนื่อง 7 วัน" — รับวันที่รวมจาก task_completions และ date(tasks.completed_at) ตาม BKK
 */
export function currentStreak(completedDates: Iterable<ISODate>, today: ISODate): number {
  const days = new Set(completedDates);
  let cursor = days.has(today) ? today : addDaysISO(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}
