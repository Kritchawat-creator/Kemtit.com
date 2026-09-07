import "server-only";

import { emitEvent } from "@/core/events/emit";
import { computeProgress, isMetricComplete } from "@/core/domain/progress";
import type { ServerSupabase } from "@/lib/supabase/server";

import type { Goal } from "./schema";

/**
 * เช็คว่า metric goal ถึงเป้าครั้งแรกหรือยัง แล้ว set completed_at + emit goal.completed ครั้งเดียว (ใช้ร่วมกันโดย
 * updateCurrentValue และ core/entries/actions — เพราะ current_value ตอนนี้คำนวณจาก trigger ของ goal_entries เอง
 * ไม่ใช่ path ที่ action set ตรง ๆ อีกต่อไป จึงต้องอ่านค่าล่าสุดจาก DB มาเช็คทีหลัง)
 * คืน null เมื่อไม่พบ goal (แถวถูกลบระหว่างทาง) — completed = true เฉพาะตอน update สำเร็จจริง (ไม่ throw ถ้า update พลาด)
 */
export async function markMetricCompletedIfReached(
  supabase: ServerSupabase,
  userId: string,
  goalId: string,
): Promise<{ current: number; percent: number; completed: boolean } | null> {
  const { data: goal } = await supabase.from("goals").select("*").eq("id", goalId).maybeSingle();
  if (!goal) return null;
  const typed = goal as Goal;
  const percent = computeProgress(typed, [], []);

  let completed = false;
  if (isMetricComplete(typed) && !typed.completed_at) {
    const { error } = await supabase
      .from("goals")
      .update({ completed_at: new Date().toISOString(), status: "completed" })
      .eq("id", goalId);
    if (error) {
      console.error("[goals] markMetricCompletedIfReached failed", { code: error.code });
    } else {
      completed = true;
      await emitEvent(supabase, userId, "goal.completed", {
        goalId: typed.id,
        title: typed.title,
        periodType: typed.period_type,
      });
    }
  }
  return { current: typed.current_value, percent, completed };
}
