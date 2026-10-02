"use server";

import { revalidatePath } from "next/cache";

import { emitEvent } from "@/core/events/emit";
import { occursOn, parseRRule } from "@/core/domain/recurrence";
import { completeGoalOnce } from "@/core/goals/completion";
import { listGoalsWithProgress } from "@/core/goals/queries";
import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import {
  archiveTaskSchema,
  inboxTaskSchema,
  planInboxTaskSchema,
  recurrenceRuleFromForm,
  rescheduleTaskSchema,
  rescheduleTaskOccurrenceSchema,
  taskFormSchema,
  skipTaskOccurrenceSchema,
  toggleTaskSchema,
  toggleTaskOccurrenceSchema,
  updateTaskSchema,
  type TaskFormValues,
  type InboxTaskValues,
} from "./schema";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type OwnedRecurringTask = {
  id: string;
  goal_id: string | null;
  recurrence_rule: string;
  due_date: string;
  archived_at: string | null;
  deleted_at: string | null;
};

async function requireUser(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function taskScheduleError(error: { message?: string } | null): string {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("time_block_overlap")) return "timeBlockConflict";
  if (message.includes("time_block_locked")) return "timeBlockLocked";
  if (message.includes("time_block_anchor_missing")) return "timeBlockAnchorMissing";
  if (message.includes("time_block_anchor_mismatch")) return "timeBlockAnchorMismatch";
  if (message.includes("recurring_occurrence_required")) return "recurringOccurrenceRequired";
  if (message.includes("task_not_found")) return "notFound";
  return "generic";
}

async function getOwnedRecurringTask(
  supabase: ServerSupabase,
  id: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, goal_id, recurrence_rule, due_date, archived_at, deleted_at")
    .eq("id", id)
    .eq("user_id", userId)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .maybeSingle();
  if (error) return { task: null, error };
  if (!data || data.archived_at || data.deleted_at || !data.recurrence_rule || !data.due_date) {
    return { task: null, error: null };
  }
  return { task: data as OwnedRecurringTask, error: null };
}

function isValidOccurrenceSource(task: { recurrence_rule: string; due_date: string }, date: string) {
  const rule = parseRRule(task.recurrence_rule);
  return Boolean(rule && occursOn(rule, task.due_date, date));
}

function revalidateTasks(goalId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/goals");
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

async function ensureOwnGoal(supabase: ServerSupabase, goalId: string) {
  const { data } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .maybeSingle();
  return Boolean(data);
}

async function ensureOwnProject(supabase: ServerSupabase, projectId: string) {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

function toInsert(userId: string, values: TaskFormValues): TaskInsert {
  return {
    user_id: userId,
    goal_id: values.goalId ?? null,
    project_id: values.projectId ?? null,
    title: values.title,
    due_date: values.dueDate,
    planned_date: values.plannedDate ?? values.dueDate,
    deadline: values.deadline ?? null,
    domain: values.domain,
    recurrence_rule: recurrenceRuleFromForm(values),
    status: "planned",
    priority: values.priority,
    estimated_minutes: values.estimatedMinutes ?? null,
    notes: values.notes ?? null,
  };
}

function toInboxInsert(userId: string, values: InboxTaskValues): TaskInsert {
  return {
    user_id: userId,
    goal_id: null,
    title: values.title,
    due_date: null,
    domain: values.domain,
    recurrence_rule: null,
    notes: values.notes ?? null,
    priority: values.priority,
    estimated_minutes: values.estimatedMinutes ?? null,
    status: "inbox",
  };
}

export async function createTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");
  if (parsed.data.goalId && !(await ensureOwnGoal(supabase, parsed.data.goalId)))
    return fail("invalidGoal");
  if (parsed.data.projectId && !(await ensureOwnProject(supabase, parsed.data.projectId)))
    return fail("invalidProject");

  const { data, error } = await supabase
    .from("tasks")
    .insert(toInsert(user.id, parsed.data))
    .select("id")
    .single();
  if (error || !data) {
    console.error("[tasks] create failed", { code: error?.code });
    return fail("generic");
  }
  revalidateTasks(parsed.data.goalId);
  return ok({ id: data.id });
}

export async function createInboxTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = inboxTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("tasks")
    .insert(toInboxInsert(user.id, parsed.data))
    .select("id")
    .single();
  if (error || !data) {
    console.error("[tasks] create inbox task failed", { code: error?.code });
    return fail("generic");
  }
  revalidateTasks();
  revalidatePath("/inbox");
  return ok({ id: data.id });
}

export async function updateTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { id, values } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");
  if (values.goalId && !(await ensureOwnGoal(supabase, values.goalId))) return fail("invalidGoal");
  if (values.projectId && !(await ensureOwnProject(supabase, values.projectId)))
    return fail("invalidProject");

  const { data: goalId, error } = await supabase.rpc("update_task_with_blocks_atomic", {
    p_task_id: id,
    p_title: values.title,
    p_due_date: values.dueDate,
    p_planned_date: values.plannedDate ?? null,
    p_update_planned_date: values.plannedDate !== undefined,
    p_deadline: values.deadline ?? null,
    p_update_deadline: values.deadline !== undefined,
    p_domain: values.domain,
    p_recurrence_rule: recurrenceRuleFromForm(values),
    p_goal_id: values.goalId ?? null,
    p_project_id: values.projectId ?? null,
    p_priority: values.priority,
    p_estimated_minutes: values.estimatedMinutes ?? null,
    p_notes: values.notes ?? null,
  });
  if (error) return fail(taskScheduleError(error));
  revalidateTasks(goalId);
  return ok({ id });
}

export async function archiveTask(input: unknown): Promise<ActionResult> {
  const parsed = archiveTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("archive_task_atomic", {
    p_task_id: parsed.data.id,
  });
  if (error) return fail(taskScheduleError(error));
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail("notFound");

  const goalId = typeof data.goalId === "string" ? data.goalId : null;
  revalidateTasks(goalId);
  revalidatePath("/inbox");
  revalidatePath("/archive");
  return ok(null);
}

/** Backward-compatible action name; this operation has always been a soft archive. */
export async function deleteTask(input: unknown): Promise<ActionResult> {
  return archiveTask(input);
}

export async function restoreTask(input: unknown): Promise<ActionResult> {
  const parsed = archiveTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("restore_task_atomic", {
    p_task_id: parsed.data.id,
  });
  if (error) return fail(taskScheduleError(error));
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail("notFound");

  const goalId = typeof data.goalId === "string" ? data.goalId : null;
  revalidateTasks(goalId);
  revalidatePath("/inbox");
  revalidatePath("/archive");
  return ok(null);
}

export async function rescheduleTask(input: unknown): Promise<ActionResult> {
  const parsed = rescheduleTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data: goalId, error } = await supabase.rpc("reschedule_task_atomic", {
    p_task_id: parsed.data.id,
    p_new_date: parsed.data.dueDate,
  });
  if (error) return fail(taskScheduleError(error));
  revalidateTasks(goalId);
  return ok(null);
}

export async function planInboxTask(input: unknown): Promise<ActionResult> {
  const parsed = planInboxTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data: goalId, error } = await supabase.rpc("plan_inbox_task_atomic", {
    p_task_id: parsed.data.id,
    p_new_date: parsed.data.dueDate,
  });
  if (error) return fail(taskScheduleError(error));
  revalidateTasks(goalId);
  revalidatePath("/inbox");
  revalidatePath("/today");
  return ok(null);
}

/**
 * ติ๊ก/ยกเลิก — task ซ้ำใช้ task_completions ต่อวัน, task เดี่ยวใช้ completed_at (Decision 1.3)
 * แล้วเช็คว่า goal (execution) และแม่ขึ้นไปถึง 100% ครั้งแรกหรือยัง → completed_at + goal.completed
 */
export async function toggleTask(
  input: unknown,
): Promise<ActionResult<{ done: boolean; completedGoals: { id: string; title: string }[] }>> {
  const parsed = toggleTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { id, date, done } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data: task } = await supabase
    .from("tasks")
    .select("id, goal_id, recurrence_rule, archived_at")
    .eq("id", id)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .maybeSingle();
  if (!task || task.archived_at) return fail("notFound");

  if (task.recurrence_rule) {
    const { error } = done
      ? await supabase
          .from("task_completions")
          .upsert(
            { task_id: id, user_id: user.id, completed_on: date },
            { onConflict: "task_id,completed_on", ignoreDuplicates: true },
          )
      : await supabase.from("task_completions").delete().eq("task_id", id).eq("completed_on", date);
    if (error) {
      console.error("[tasks] toggle recurring failed", { code: error.code });
      return fail("generic");
    }
  } else {
    const { error } = await supabase
      .from("tasks")
      .update({
        completed_at: done ? new Date().toISOString() : null,
        status: done ? "completed" : "planned",
      })
      .eq("id", id)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .is("archived_at", null);
    if (error) {
      console.error("[tasks] toggle failed", { code: error.code });
      return fail("generic");
    }
  }

  if (done)
    await emitEvent(supabase, user.id, "task.completed", {
      taskId: id,
      goalId: task.goal_id,
      date,
    });

  const completedGoals: { id: string; title: string }[] = [];
  if (done && task.goal_id) {
    const goals = await listGoalsWithProgress({ includeArchived: true });
    let current = goals.find((g) => g.id === task.goal_id) ?? null;
    while (current) {
      if (
        current.goal_kind === "execution" &&
        current.status === "active" &&
        !current.completed_at &&
        current.progress.percent >= 100
      ) {
        const completed = await completeGoalOnce(supabase, current.id);
        if (completed) {
          completedGoals.push({ id: current.id, title: current.title });
        }
      }
      const parentId = current.parent_id;
      current = parentId ? (goals.find((g) => g.id === parentId) ?? null) : null;
    }
  }

  revalidateTasks(task.goal_id);
  return ok({ done, completedGoals });
}

/**
 * Transition one recurring occurrence without mutating the recurring series.
 * Legacy task_completions remain readable so historical rows survive the rollout.
 */
export async function toggleTaskOccurrence(
  input: unknown,
): Promise<ActionResult<{ done: boolean; completedGoals: { id: string; title: string }[] }>> {
  const parsed = toggleTaskOccurrenceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { id, occurrenceDate, date, done } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { task, error: taskError } = await getOwnedRecurringTask(supabase, id, user.id);
  if (taskError) return fail("generic");
  if (!task) return fail("notFound");
  if (!isValidOccurrenceSource(task, occurrenceDate)) return fail("invalidDate");

  const { error } = await supabase.from("task_occurrences").upsert(
    {
      task_id: id,
      user_id: user.id,
      occurrence_date: occurrenceDate,
      scheduled_date: date,
      status: done ? "completed" : "planned",
      completed_at: done ? new Date().toISOString() : null,
      skipped_at: null,
    },
    { onConflict: "task_id,occurrence_date" },
  );
  if (error) {
    console.error("[tasks] toggle occurrence failed", { code: error.code });
    return fail("generic");
  }

  if (done)
    await emitEvent(supabase, user.id, "task.completed", {
      taskId: id,
      goalId: task.goal_id,
      date,
    });

  const completedGoals: { id: string; title: string }[] = [];
  if (done && task.goal_id) {
    const goals = await listGoalsWithProgress({ includeArchived: true });
    let current = goals.find((g) => g.id === task.goal_id) ?? null;
    while (current) {
      if (
        current.goal_kind === "execution" &&
        current.status === "active" &&
        !current.completed_at &&
        current.progress.percent >= 100
      ) {
        const completed = await completeGoalOnce(supabase, current.id);
        if (completed) completedGoals.push({ id: current.id, title: current.title });
      }
      const parentId = current.parent_id;
      current = parentId ? (goals.find((g) => g.id === parentId) ?? null) : null;
    }
  }

  revalidateTasks(task.goal_id);
  return ok({ done, completedGoals });
}

/** Move only one recurring occurrence; the task RRULE and anchor remain unchanged. */
export async function rescheduleTaskOccurrence(input: unknown): Promise<ActionResult> {
  const parsed = rescheduleTaskOccurrenceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { task, error: taskError } = await getOwnedRecurringTask(supabase, parsed.data.id, user.id);
  if (taskError) return fail("generic");
  if (!task) return fail("notFound");
  if (!isValidOccurrenceSource(task, parsed.data.occurrenceDate)) return fail("invalidDate");

  const { data: id, error } = await supabase.rpc("reschedule_task_occurrence_atomic", {
    p_task_id: parsed.data.id,
    p_occurrence_date: parsed.data.occurrenceDate,
    p_new_occurrence_date: parsed.data.newDate,
  });
  if (error) {
    console.error("[tasks] reschedule occurrence failed", { code: error.code });
    return fail(taskScheduleError(error));
  }
  if (!id) return fail("occurrenceConflict");

  revalidateTasks();
  return ok(null);
}

/** Skip one recurring occurrence while retaining the series and its history. */
export async function skipTaskOccurrence(input: unknown): Promise<ActionResult> {
  const parsed = skipTaskOccurrenceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { task, error: taskError } = await getOwnedRecurringTask(supabase, parsed.data.id, user.id);
  if (taskError) return fail("generic");
  if (!task) return fail("notFound");
  if (!isValidOccurrenceSource(task, parsed.data.occurrenceDate)) return fail("invalidDate");

  const { error } = await supabase.from("task_occurrences").upsert(
    {
      task_id: parsed.data.id,
      user_id: user.id,
      occurrence_date: parsed.data.occurrenceDate,
      scheduled_date: parsed.data.date,
      status: "skipped",
      completed_at: null,
      skipped_at: new Date().toISOString(),
    },
    { onConflict: "task_id,occurrence_date" },
  );
  if (error) {
    console.error("[tasks] skip occurrence failed", { code: error.code });
    return fail("generic");
  }

  revalidateTasks(task.goal_id);
  return ok(null);
}
