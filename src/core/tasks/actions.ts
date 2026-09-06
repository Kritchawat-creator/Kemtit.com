"use server";

import { revalidatePath } from "next/cache";

import { emitEvent } from "@/core/events/emit";
import { listGoalsWithProgress } from "@/core/goals/queries";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import {
  deleteTaskSchema,
  recurrenceRuleFromForm,
  rescheduleTaskSchema,
  taskFormSchema,
  toggleTaskSchema,
  updateTaskSchema,
  type TaskFormValues,
} from "./schema";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

async function requireUser(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function revalidateTasks(goalId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/goals");
  if (goalId) revalidatePath(`/goals/${goalId}`);
}

async function ensureOwnGoal(supabase: ServerSupabase, goalId: string) {
  const { data } = await supabase.from("goals").select("id").eq("id", goalId).maybeSingle();
  return Boolean(data);
}

function toInsert(userId: string, values: TaskFormValues): TaskInsert {
  return {
    user_id: userId,
    goal_id: values.goalId ?? null,
    title: values.title,
    due_date: values.dueDate,
    domain: values.domain,
    recurrence_rule: recurrenceRuleFromForm(values),
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

export async function updateTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { id, values } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");
  if (values.goalId && !(await ensureOwnGoal(supabase, values.goalId))) return fail("invalidGoal");

  const { user_id: _ignored, ...patch } = toInsert(user.id, values);
  void _ignored;
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("id, goal_id")
    .maybeSingle();
  if (error) return fail("generic");
  if (!data) return fail("notFound");
  revalidateTasks(data.goal_id);
  return ok({ id });
}

export async function deleteTask(input: unknown): Promise<ActionResult> {
  const parsed = deleteTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", parsed.data.id)
    .select("id, goal_id")
    .maybeSingle();
  if (error) return fail("generic");
  revalidateTasks(data?.goal_id);
  return ok(null);
}

export async function rescheduleTask(input: unknown): Promise<ActionResult> {
  const parsed = rescheduleTaskSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("tasks")
    .update({ due_date: parsed.data.dueDate })
    .eq("id", parsed.data.id)
    .select("id, goal_id")
    .maybeSingle();
  if (error) return fail("generic");
  if (!data) return fail("notFound");
  revalidateTasks(data.goal_id);
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
    .select("id, goal_id, recurrence_rule")
    .eq("id", id)
    .maybeSingle();
  if (!task) return fail("notFound");

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
      .update({ completed_at: done ? new Date().toISOString() : null })
      .eq("id", id);
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
        const { error } = await supabase
          .from("goals")
          .update({ completed_at: new Date().toISOString(), status: "completed" })
          .eq("id", current.id);
        if (!error) {
          await emitEvent(supabase, user.id, "goal.completed", {
            goalId: current.id,
            title: current.title,
            periodType: current.period_type,
          });
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
