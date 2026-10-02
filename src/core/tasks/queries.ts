import "server-only";

import { cache } from "react";

import {
  buildDayPlan,
  goalTaskItems,
  type DayPlan,
  type DayTaskItem,
  type PlanOccurrence,
} from "@/core/domain/dayplan";
import { currentStreak } from "@/core/domain/streak";
import { withSignedPhotoUrls } from "@/core/photos/queries";
import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import {
  addDaysISO,
  endOfWeekISO,
  type ISODate,
  startOfWeekISO,
  toBkkDate,
  todayBkk,
} from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

import type { TaskCompletion, TaskWithGoal } from "./schema";

const TASK_WITH_GOAL = "*, goal:goals(id, title), photos:task_photos(id, path)";

/** แถวจาก select ข้างบน (ยังไม่มี url) → TaskWithGoal โดยลงชื่อ signed URL ให้รูป (batch เดียว) */
async function toTasksWithGoal(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  rows: unknown[] | null,
): Promise<TaskWithGoal[]> {
  type Raw = Omit<TaskWithGoal, "photos"> & { photos?: { id: string; path: string }[] };
  return (await withSignedPhotoUrls(supabase, (rows ?? []) as Raw[])) as TaskWithGoal[];
}

/** งานของวัน (ค้าง/ต้องทำ/เสร็จ) — ดึง task เดี่ยวของวันนั้น + task ซ้ำทั้งหมด + task เดี่ยวค้าง — cache() กันยิงซ้ำในคำขอเดียว (§2.9) */
export const getDayPlan = cache(async (date: ISODate): Promise<DayPlan<TaskWithGoal>> => {
  const supabase = await createServerSupabase();
  const today = todayBkk();
  const [
    { data: tasks, error },
    { data: completions, error: completionError },
    { data: occurrences, error: occurrenceError },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_WITH_GOAL)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .is("archived_at", null)
      .is("deleted_at", null)
      .or(
        `due_date.eq.${date},recurrence_rule.not.is.null,and(due_date.lt.${today},completed_at.is.null,recurrence_rule.is.null)`,
      )
      .order("due_date")
      .order("created_at"),
    supabase
      .from("task_completions")
      .select("*")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .eq("completed_on", date),
    supabase
      .from("task_occurrences")
      .select("id, task_id, occurrence_date, scheduled_date, status")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .or(`occurrence_date.eq.${date},scheduled_date.eq.${date}`),
  ]);
  if (error || completionError || occurrenceError) {
    console.error("[tasks] getDayPlan failed", {
      code: error?.code ?? completionError?.code ?? occurrenceError?.code,
    });
    throw new QueryError(
      "tasks.getDayPlan",
      error?.code ?? completionError?.code ?? occurrenceError?.code,
    );
  }
  return buildDayPlan(
    await toTasksWithGoal(supabase, tasks),
    (completions ?? []) as TaskCompletion[],
    date,
    today,
    (occurrences ?? []) as PlanOccurrence[],
  );
});

/** ช่วงวันที่ (ปฏิทิน): task เดี่ยวในช่วง + task ซ้ำทั้งหมด + completions ในช่วง */
export async function getRangeTasks(from: ISODate, to: ISODate) {
  const supabase = await createServerSupabase();
  const [
    { data: tasks, error: taskError },
    { data: completions, error: completionError },
    { data: occurrences, error: occurrenceError },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_WITH_GOAL)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .is("archived_at", null)
      .is("deleted_at", null)
      .or(`and(due_date.gte.${from},due_date.lte.${to}),recurrence_rule.not.is.null`)
      .order("due_date"),
    supabase
      .from("task_completions")
      .select("*")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .gte("completed_on", from)
      .lte("completed_on", to),
    supabase
      .from("task_occurrences")
      .select("id, task_id, occurrence_date, scheduled_date, status")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .or(
        `and(occurrence_date.gte.${from},occurrence_date.lte.${to}),and(scheduled_date.gte.${from},scheduled_date.lte.${to})`,
      ),
  ]);
  if (taskError || completionError || occurrenceError) {
    console.error("[tasks] getRangeTasks failed", {
      code: taskError?.code ?? completionError?.code ?? occurrenceError?.code,
    });
    throw new QueryError(
      "tasks.getRangeTasks",
      taskError?.code ?? completionError?.code ?? occurrenceError?.code,
    );
  }
  return {
    tasks: await toTasksWithGoal(supabase, tasks),
    completions: (completions ?? []) as TaskCompletion[],
    occurrences: (occurrences ?? []) as PlanOccurrence[],
  };
}

/** งานของ goal หนึ่ง (หน้า detail) — task ซ้ำแสดงสถานะวันนี้ */
export async function getGoalTaskItems(goalId: string): Promise<DayTaskItem<TaskWithGoal>[]> {
  const supabase = await createServerSupabase();
  const today = todayBkk();
  const [
    { data: tasks, error: taskError },
    { data: completions, error: completionError },
    { data: occurrences, error: occurrenceError },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_WITH_GOAL)
      .eq("goal_id", goalId)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("due_date")
      .order("created_at"),
    supabase
      .from("task_completions")
      .select("*")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .eq("completed_on", today),
    supabase
      .from("task_occurrences")
      .select("id, task_id, occurrence_date, scheduled_date, status")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .or(`occurrence_date.eq.${today},scheduled_date.eq.${today}`),
  ]);
  if (taskError || completionError || occurrenceError) {
    console.error("[tasks] getGoalTaskItems failed", {
      code: taskError?.code ?? completionError?.code ?? occurrenceError?.code,
    });
    throw new QueryError(
      "tasks.getGoalTaskItems",
      taskError?.code ?? completionError?.code ?? occurrenceError?.code,
    );
  }
  return goalTaskItems(
    await toTasksWithGoal(supabase, tasks),
    (completions ?? []) as TaskCompletion[],
    today,
    (occurrences ?? []) as PlanOccurrence[],
  );
}

const STREAK_LOOKBACK_DAYS = 60;

/** streak วันติดต่อกันที่มี task เสร็จ — รวม task_completions และ date(tasks.completed_at) ตาม BKK (metric §14) — cache() §2.9 */
export const getStreak = cache(async (today: ISODate): Promise<number> => {
  const supabase = await createServerSupabase();
  const since = addDaysISO(today, -STREAK_LOOKBACK_DAYS);
  const [
    { data: completions, error: completionError },
    { data: tasks, error: taskError },
    { data: occurrences, error: occurrenceError },
  ] = await Promise.all([
    supabase
      .from("task_completions")
      .select("completed_on")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .gte("completed_on", since),
    supabase
      .from("tasks")
      .select("completed_at")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .not("completed_at", "is", null)
      .gte("completed_at", `${since}T00:00:00Z`),
    supabase
      .from("task_occurrences")
      .select("scheduled_date")
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .eq("status", "completed")
      .gte("scheduled_date", since),
  ]);
  if (completionError || taskError || occurrenceError) {
    console.error("[tasks] getStreak failed", {
      code: completionError?.code ?? taskError?.code ?? occurrenceError?.code,
    });
    throw new QueryError(
      "tasks.getStreak",
      completionError?.code ?? taskError?.code ?? occurrenceError?.code,
    );
  }
  const dates = [
    ...(completions ?? []).map((c) => c.completed_on),
    ...(tasks ?? []).flatMap((t) => (t.completed_at ? [toBkkDate(t.completed_at)] : [])),
    ...(occurrences ?? []).flatMap((occurrence) =>
      occurrence.scheduled_date ? [occurrence.scheduled_date] : [],
    ),
  ];
  return currentStreak(dates, today);
});

/**
 * งานสัปดาห์นี้ (Claude Design turn 7 KPI "งานเสร็จสัปดาห์นี้"): task เดี่ยว (ไม่ใช่ตัวซ้ำ) ที่ครบกำหนดใน
 * สัปดาห์นี้ (อาทิตย์–เสาร์) → { done, total } — task ซ้ำนับสถานะรายวันซับซ้อนกว่านี้ จึงไม่รวมในสถิตินี้ (POC)
 */
export async function getWeekTaskStats(today: ISODate): Promise<{ done: number; total: number }> {
  const supabase = await createServerSupabase();
  const from = startOfWeekISO(today);
  const to = endOfWeekISO(today);
  const { data, error } = await supabase
    .from("tasks")
    .select("completed_at")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .is("recurrence_rule", null)
    .is("archived_at", null)
    .is("deleted_at", null)
    .gte("due_date", from)
    .lte("due_date", to);
  if (error) {
    console.error("[tasks] getWeekTaskStats failed", { code: error.code });
    throw new QueryError("tasks.getWeekTaskStats", error.code);
  }
  const rows = data ?? [];
  return { done: rows.filter((t) => t.completed_at !== null).length, total: rows.length };
}

/** Tasks captured without a date. Inbox is a task state, not a second table. */
export async function getInboxTasks(): Promise<TaskWithGoal[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_WITH_GOAL)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .eq("status", "inbox")
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[tasks] getInboxTasks failed", { code: error.code });
    throw new QueryError("tasks.getInboxTasks", error.code);
  }
  const tasks = await toTasksWithGoal(supabase, data);
  const priorityRank = { high: 0, normal: 1, low: 2 } as const;
  return tasks.sort(
    (a, b) =>
      priorityRank[a.priority ?? "normal"] - priorityRank[b.priority ?? "normal"] ||
      b.created_at.localeCompare(a.created_at),
  );
}

export type TaskLibraryView = "planned" | "all" | "done" | "overdue";

export async function getTaskLibrary(input: {
  view: TaskLibraryView;
  search: string;
  today: ISODate;
}): Promise<{ tasks: TaskWithGoal[]; hasMore: boolean }> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("tasks")
    .select(TASK_WITH_GOAL)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .is("archived_at", null)
    .is("deleted_at", null)
    .order("planned_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(201);

  if (input.view === "planned" || input.view === "overdue") {
    query = query.eq("status", "planned");
  } else if (input.view === "done") {
    query = query.eq("status", "completed");
  } else {
    query = query.in("status", ["planned", "completed"]);
  }

  const search = input.search.trim();
  if (search) query = query.ilike("title", `%${search}%`);
  if (input.view === "overdue") query = query.lt("deadline", input.today);

  const { data, error } = await query;
  if (error) {
    console.error("[tasks] getTaskLibrary failed", { code: error.code });
    throw new QueryError("tasks.getTaskLibrary", error.code);
  }

  const rows = await toTasksWithGoal(supabase, data);
  return { tasks: rows.slice(0, 200), hasMore: rows.length > 200 };
}

export async function listArchivedTasks(pageIndex = 0, pageSize = 50) {
  const offset = Math.max(0, pageIndex) * pageSize;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, due_date, planned_date, completed_at, recurrence_rule, archived_at, archived_from_status",
    )
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .or("archived_at.not.is.null,status.eq.archived")
    .is("deleted_at", null)
    .order("archived_at", { ascending: false })
    .range(offset, offset + pageSize);

  if (error) {
    console.error("[tasks] archive list failed", { code: error.code });
    throw new QueryError("tasks.listArchived", error.code);
  }
  const rows = data ?? [];
  return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}
