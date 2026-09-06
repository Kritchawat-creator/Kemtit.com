"use server";

import { revalidatePath } from "next/cache";

import { emitEvent } from "@/core/events/emit";
import { normalizePeriodStart, overlaps, periodOf } from "@/core/domain/periods";
import { computeProgress, isMetricComplete } from "@/core/domain/progress";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import {
  createGoalSchema,
  goalSpecSchema,
  setGoalStatusSchema,
  updateCurrentValueSchema,
  updateGoalSchema,
  type Goal,
  type GoalFormValues,
  type GoalSpec,
} from "./schema";

type GoalInsert = Database["public"]["Tables"]["goals"]["Insert"];

async function requireUser(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function revalidateGoals() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

/** ตรวจว่า parent เป็นของ user (RLS) และช่วงเวลาลูก "ทับ" กับแม่ (Decision 1.4) */
async function validateParent(
  supabase: ServerSupabase,
  parentId: string,
  values: Pick<GoalFormValues, "periodType" | "periodStart">,
) {
  const { data: parent } = await supabase
    .from("goals")
    .select("id, period_type, period_start")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return "invalidParent";
  const parentPeriod = periodOf(parent.period_type as Goal["period_type"], parent.period_start);
  const childPeriod = periodOf(values.periodType, values.periodStart);
  return overlaps(childPeriod, parentPeriod) ? null : "periodOutsideParent";
}

function toInsert(userId: string, values: GoalFormValues): GoalInsert {
  const isMetric = values.goalKind === "metric";
  return {
    user_id: userId,
    parent_id: values.parentId ?? null,
    title: values.title,
    period_type: values.periodType,
    period_start: normalizePeriodStart(values.periodType, values.periodStart),
    domain: values.domain,
    goal_kind: values.goalKind,
    target_value: isMetric ? (values.targetValue ?? null) : null,
    persona_data: isMetric && values.unit ? { unit: values.unit } : {},
  };
}

export async function createGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  if (parsed.data.parentId) {
    const problem = await validateParent(supabase, parsed.data.parentId, parsed.data);
    if (problem) return fail(problem);
  }

  const { data, error } = await supabase
    .from("goals")
    .insert(toInsert(user.id, parsed.data))
    .select("id")
    .single();
  if (error || !data) {
    console.error("[goals] create failed", { code: error?.code });
    return fail("generic");
  }

  await emitEvent(supabase, user.id, "goal.created", {
    goalId: data.id,
    periodType: parsed.data.periodType,
    goalKind: parsed.data.goalKind,
  });
  revalidateGoals();
  return ok({ id: data.id });
}

export async function updateGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { id, values } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  if (values.parentId === id) return fail("invalidParent");
  if (values.parentId) {
    const problem = await validateParent(supabase, values.parentId, values);
    if (problem) return fail(problem);
  }

  const { user_id: _ignored, ...patch } = toInsert(user.id, values);
  void _ignored;
  const { data, error } = await supabase
    .from("goals")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[goals] update failed", { code: error.code });
    return fail("generic");
  }
  if (!data) return fail("notFound");

  revalidateGoals();
  revalidatePath(`/goals/${id}`);
  return ok({ id });
}

/** archive/restore แบบ undo ได้ (Design §8.5: ทุกการลบต้องมี undo ไม่ใช้ confirm) */
export async function setGoalStatus(input: unknown): Promise<ActionResult> {
  const parsed = setGoalStatusSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("goals")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error) return fail("generic");
  if (!data) return fail("notFound");

  revalidateGoals();
  revalidatePath(`/goals/${parsed.data.id}`);
  return ok(null);
}

/** metric goal: user กรอกยอดล่าสุด → ถึงเป้าครั้งแรกจะ set completed_at + emit goal.completed ครั้งเดียว */
export async function updateCurrentValue(
  input: unknown,
): Promise<ActionResult<{ percent: number; completed: boolean }>> {
  const parsed = updateCurrentValueSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data: goal } = await supabase
    .from("goals")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!goal) return fail("notFound");
  if (goal.goal_kind !== "metric") return fail("notMetric");

  const next: Goal = { ...(goal as Goal), current_value: parsed.data.currentValue };
  const justCompleted = isMetricComplete(next) && !goal.completed_at;
  const patch: Database["public"]["Tables"]["goals"]["Update"] = {
    current_value: parsed.data.currentValue,
    ...(justCompleted ? { completed_at: new Date().toISOString(), status: "completed" } : {}),
  };
  const { error } = await supabase.from("goals").update(patch).eq("id", goal.id);
  if (error) {
    console.error("[goals] updateCurrentValue failed", { code: error.code });
    return fail("generic");
  }

  if (justCompleted) {
    await emitEvent(supabase, user.id, "goal.completed", {
      goalId: goal.id,
      title: goal.title,
      periodType: goal.period_type,
    });
  }
  revalidateGoals();
  revalidatePath(`/goals/${goal.id}`);
  return ok({ percent: computeProgress(next, [], []), completed: justCompleted });
}

/**
 * สร้าง goal + ลูก + task ตัวอย่างจาก spec ทีเดียว (template ตอน onboarding)
 * ไม่มี transaction ใน supabase-js: ถ้าลูกพังกลางทาง แม่ยังอยู่ — ยอมรับใน POC
 */
export async function createGoalCascade(input: unknown): Promise<ActionResult<{ rootId: string }>> {
  const parsed = goalSpecSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const insertNode = async (spec: GoalSpec, parentId: string | null): Promise<string | null> => {
    const { data, error } = await supabase
      .from("goals")
      .insert(
        toInsert(user.id, {
          title: spec.title,
          periodType: spec.periodType,
          periodStart: spec.periodStart,
          domain: spec.domain,
          goalKind: spec.goalKind,
          targetValue: spec.targetValue,
          unit: spec.unit,
          parentId,
        }),
      )
      .select("id")
      .single();
    if (error || !data) {
      console.error("[goals] cascade insert failed", { code: error?.code });
      return null;
    }
    await emitEvent(supabase, user.id, "goal.created", {
      goalId: data.id,
      periodType: spec.periodType,
      goalKind: spec.goalKind,
      fromTemplate: true,
    });
    if (spec.tasks?.length) {
      const { error: taskError } = await supabase.from("tasks").insert(
        spec.tasks.map((t) => ({
          user_id: user.id,
          goal_id: data.id,
          title: t.title,
          due_date: t.dueDate,
          domain: t.domain,
        })),
      );
      if (taskError) console.error("[goals] cascade tasks failed", { code: taskError.code });
    }
    for (const child of spec.children ?? []) await insertNode(child, data.id);
    return data.id;
  };

  const rootId = await insertNode(parsed.data, null);
  if (!rootId) return fail("generic");
  revalidateGoals();
  return ok({ rootId });
}
