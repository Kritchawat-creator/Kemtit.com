"use server";

import { revalidatePath } from "next/cache";

import { emitEvent } from "@/core/events/emit";
import { sumAmounts } from "@/core/domain/entries";
import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { normalizePeriodStart, overlaps, periodContains, periodOf } from "@/core/domain/periods";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { isBeforeISO, todayBkk } from "@/lib/date";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

import { markMetricCompletedIfReached } from "./completion";
import {
  createGoalSchema,
  goalSpecSchema,
  restoreGoalSchema,
  setGoalStatusSchema,
  updateCurrentValueSchema,
  updateGoalSchema,
  type Goal,
  type GoalFormValues,
} from "./schema";

type GoalInsert = Database["public"]["Tables"]["goals"]["Insert"];

async function requireUser(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function revalidateGoals() {
  revalidatePath("/archive");
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/today");
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
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
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
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[goals] update failed", { code: error.code });
    if (error.code === "23514") return fail("invalidParent");
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

  if (parsed.data.status === "archived") {
    const { data, error } = await supabase.rpc("archive_goal_atomic", {
      p_goal_id: parsed.data.id,
    });
    if (error) {
      if (error.message.includes("goal_not_found")) return fail("notFound");
      console.error("[goals] archive failed", { code: error.code });
      return fail("generic");
    }
    if (!data) return fail("notFound");
  } else {
    const { data, error } = await supabase
      .from("goals")
      .update({ status: "active", archived_at: null, archived_from_status: null })
      .eq("id", parsed.data.id)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .select("id")
      .maybeSingle();
    if (error) return fail("generic");
    if (!data) return fail("notFound");
  }

  revalidateGoals();
  revalidatePath(`/goals/${parsed.data.id}`);
  return ok(null);
}

export async function restoreGoal(input: unknown): Promise<ActionResult> {
  const parsed = restoreGoalSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("restore_goal_atomic", {
    p_goal_id: parsed.data.id,
  });
  if (error) {
    if (error.message.includes("goal_not_found")) return fail("notFound");
    console.error("[goals] restore failed", { code: error.code });
    return fail("generic");
  }
  if (!data) return fail("notFound");

  revalidateGoals();
  revalidatePath(`/goals/${parsed.data.id}`);
  return ok(null);
}

/**
 * metric goal: user กรอกยอดรวมล่าสุด (ฟอร์มเดิม/มือถือ) — ภายในแปลงเป็น adjustment entry (delta = ใหม่ − เดิม)
 * ใส่ใน goal_entries แทนการเซ็ต current_value ตรง ๆ (M10a: current_value คำนวณจาก trigger ของ goal_entries)
 * ถึงเป้าครั้งแรกจะ set completed_at + emit goal.completed ครั้งเดียว (ผ่าน markMetricCompletedIfReached ร่วมกับ core/entries)
 */
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
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .maybeSingle();
  if (!goal) return fail("notFound");
  if (goal.goal_kind !== "metric") return fail("notMetric");

  // goals.current_value เป็นค่า clamped (greatest(0, sum)) ที่ trigger เขียน — ถ้ายอดสุทธิเคยติดลบจะไม่เท่าผลรวมจริง
  // จึงคิด delta จากผลรวมจริงใน goal_entries เพื่อให้ยอดหลังบันทึกตรงกับตัวเลขที่ผู้ใช้พิมพ์เสมอ
  const { data: rows, error: sumError } = await supabase
    .from("goal_entries")
    .select("amount")
    .eq("goal_id", goal.id);
  if (sumError) {
    console.error("[goals] updateCurrentValue read entries failed", { code: sumError.code });
    return fail("generic");
  }

  // วันของ adjustment entry ต้องอยู่ในช่วงของเป้า (กราฟสะสมนับเฉพาะ entry ในช่วง) — วันนี้อยู่นอกช่วงก็หนีบเข้าขอบใกล้สุด
  // ไม่ปฏิเสธ เพราะ path นี้คือฟอร์ม "อัปเดตยอด" เดิมที่เคยบันทึกได้ทุกกรณี
  const period = periodOf(goal.period_type as Goal["period_type"], goal.period_start);
  const today = todayBkk();
  const entryDate = periodContains(period, today)
    ? today
    : isBeforeISO(today, period.start)
      ? period.start
      : period.end;

  const delta = parsed.data.currentValue - sumAmounts(rows ?? []);
  if (delta !== 0) {
    const { error } = await supabase.from("goal_entries").insert({
      user_id: user.id,
      goal_id: goal.id,
      entry_date: entryDate,
      amount: delta,
      note: null,
    });
    if (error) {
      console.error("[goals] updateCurrentValue insert entry failed", { code: error.code });
      return fail("generic");
    }
  }

  const result = await markMetricCompletedIfReached(supabase, user.id, goal.id);
  revalidateGoals();
  revalidatePath(`/goals/${goal.id}`);
  revalidatePath("/entries");
  return ok({ percent: result?.percent ?? 0, completed: result?.completed ?? false });
}

/**
 * สร้าง goal + ลูก + task ตัวอย่างจาก spec แบบ atomic ผ่าน PostgreSQL RPC.
 * ถ้า node/task ใดพัง PostgreSQL จะ rollback ทั้ง statement จึงไม่เหลือ cascade ครึ่งชุด.
 */
export async function createGoalCascade(input: unknown): Promise<ActionResult<{ rootId: string }>> {
  const parsed = goalSpecSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data: rootId, error } = await supabase.rpc("create_goal_cascade", {
    p_spec: parsed.data as unknown as Json,
  });

  if (error || !rootId) {
    console.error("[goals] atomic cascade failed", { code: error?.code });
    return fail("generic");
  }

  revalidateGoals();
  return ok({ rootId });
}
