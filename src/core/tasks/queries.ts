import "server-only";

import { buildDayPlan, goalTaskItems, type DayPlan, type DayTaskItem } from "@/core/domain/dayplan";
import { type ISODate, todayBkk } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

import type { TaskCompletion, TaskWithGoal } from "./schema";

const TASK_WITH_GOAL = "*, goal:goals(id, title)";

/** งานของวัน (ค้าง/ต้องทำ/เสร็จ) — ดึง task เดี่ยวของวันนั้น + task ซ้ำทั้งหมด + task เดี่ยวค้าง */
export async function getDayPlan(date: ISODate): Promise<DayPlan<TaskWithGoal>> {
  const supabase = await createServerSupabase();
  const today = todayBkk();
  const [{ data: tasks, error }, { data: completions, error: completionError }] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_WITH_GOAL)
      .or(
        `due_date.eq.${date},recurrence_rule.not.is.null,and(due_date.lt.${today},completed_at.is.null,recurrence_rule.is.null)`,
      )
      .order("due_date")
      .order("created_at"),
    supabase.from("task_completions").select("*").eq("completed_on", date),
  ]);
  if (error || completionError) {
    console.error("[tasks] getDayPlan failed", { code: error?.code ?? completionError?.code });
    return { date, overdue: [], due: [], done: [] };
  }
  return buildDayPlan((tasks ?? []) as TaskWithGoal[], (completions ?? []) as TaskCompletion[], date, today);
}

/** ช่วงวันที่ (ปฏิทิน): task เดี่ยวในช่วง + task ซ้ำทั้งหมด + completions ในช่วง */
export async function getRangeTasks(from: ISODate, to: ISODate) {
  const supabase = await createServerSupabase();
  const [{ data: tasks }, { data: completions }] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_WITH_GOAL)
      .or(`and(due_date.gte.${from},due_date.lte.${to}),recurrence_rule.not.is.null`)
      .order("due_date"),
    supabase.from("task_completions").select("*").gte("completed_on", from).lte("completed_on", to),
  ]);
  return { tasks: (tasks ?? []) as TaskWithGoal[], completions: (completions ?? []) as TaskCompletion[] };
}

/** งานของ goal หนึ่ง (หน้า detail) — task ซ้ำแสดงสถานะวันนี้ */
export async function getGoalTaskItems(goalId: string): Promise<DayTaskItem<TaskWithGoal>[]> {
  const supabase = await createServerSupabase();
  const today = todayBkk();
  const [{ data: tasks }, { data: completions }] = await Promise.all([
    supabase.from("tasks").select(TASK_WITH_GOAL).eq("goal_id", goalId).order("due_date").order("created_at"),
    supabase.from("task_completions").select("*").eq("completed_on", today),
  ]);
  return goalTaskItems((tasks ?? []) as TaskWithGoal[], (completions ?? []) as TaskCompletion[], today);
}
