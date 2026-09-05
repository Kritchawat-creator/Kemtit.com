"use client";

import { useSearchParams } from "next/navigation";

/**
 * อ่าน `?new=goal|task` แล้ว render ฟอร์มสร้าง (Sheet มือถือ / Dialog desktop)
 * M1: ยังไม่มีฟอร์ม — GoalForm (M2) และ TaskForm (M3) จะมาต่อที่นี่จุดเดียว
 */
export function QuickAddHost() {
  const params = useSearchParams();
  const kind = params.get("new");
  if (kind !== "goal" && kind !== "task") return null;
  return null;
}
