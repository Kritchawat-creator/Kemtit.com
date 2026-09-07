"use server";

import { revalidatePath } from "next/cache";

import { emitEvent } from "@/core/events/emit";
import { periodContains, periodOf, type PeriodType } from "@/core/domain/periods";
import { markMetricCompletedIfReached } from "@/core/goals/completion";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import type { ISODate } from "@/lib/date";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";

import { deleteEntrySchema, entryFormSchema, updateEntrySchema } from "./schema";

async function requireUser(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * วันที่ของรายการต้องอยู่ในช่วงของเป้า — trigger รวม entry ทุกใบเข้า current_value แต่กราฟสะสมนับเฉพาะใบที่อยู่ในช่วง
 * ถ้าไม่บังคับตรงนี้ จุดสุดท้ายของกราฟกับตัวเลขบนหน้าปัดจะไม่ตรงกัน (แผน §1.11)
 */
function outsidePeriod(
  goal: { period_type: string; period_start: string },
  entryDate: ISODate,
): boolean {
  return !periodContains(periodOf(goal.period_type as PeriodType, goal.period_start), entryDate);
}

function revalidateEntries(goalId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/entries");
  revalidatePath("/search");
}

type EntryResult = { id: string; total: number; percent: number; completed: boolean };

/** บันทึกยอดใหม่ — goal ต้องเป็นของ user เอง เป็น metric และยังไม่เก็บเข้ากรุ */
export async function addEntry(input: unknown): Promise<ActionResult<EntryResult>> {
  const parsed = entryFormSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { goalId, entryDate, amount, note, channel } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data: goal } = await supabase
    .from("goals")
    .select("id, goal_kind, status, period_type, period_start")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal) return fail("invalidGoal");
  if (goal.goal_kind !== "metric") return fail("notMetric");
  if (goal.status === "archived") return fail("goalArchived");
  if (outsidePeriod(goal, entryDate))
    return fail("entryOutsidePeriod", { entryDate: ["entryOutsidePeriod"] });

  const { data, error } = await supabase
    .from("goal_entries")
    .insert({
      user_id: user.id,
      goal_id: goalId,
      entry_date: entryDate,
      amount,
      note: note ? note : null,
      channel: channel ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[entries] add failed", { code: error?.code });
    return fail("generic");
  }

  const result = await markMetricCompletedIfReached(supabase, user.id, goalId);
  await emitEvent(supabase, user.id, "entry.logged", {
    goalId,
    entryId: data.id,
    amount,
    date: entryDate,
  });
  revalidateEntries(goalId);
  return ok({
    id: data.id,
    total: result?.current ?? amount,
    percent: result?.percent ?? 0,
    completed: result?.completed ?? false,
  });
}

/** แก้รายการที่มีอยู่ — แก้ได้เฉพาะ entry_date/amount/note/channel (ย้าย goal ไม่ได้ ทั้งที่ schema และ trigger) */
export async function updateEntry(input: unknown): Promise<ActionResult<EntryResult>> {
  const parsed = updateEntrySchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { id, values } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data: existing } = await supabase
    .from("goal_entries")
    .select("id, goal:goals(period_type, period_start)")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return fail("notFound");
  if (existing.goal && outsidePeriod(existing.goal, values.entryDate))
    return fail("entryOutsidePeriod", { entryDate: ["entryOutsidePeriod"] });

  const { data, error } = await supabase
    .from("goal_entries")
    .update({
      entry_date: values.entryDate,
      amount: values.amount,
      note: values.note ? values.note : null,
      channel: values.channel ?? null,
    })
    .eq("id", id)
    .select("id, goal_id")
    .maybeSingle();
  if (error) {
    console.error("[entries] update failed", { code: error.code });
    return fail("generic");
  }
  if (!data) return fail("notFound");

  const result = await markMetricCompletedIfReached(supabase, user.id, data.goal_id);
  revalidateEntries(data.goal_id);
  return ok({
    id,
    total: result?.current ?? values.amount,
    percent: result?.percent ?? 0,
    completed: result?.completed ?? false,
  });
}

/** ลบรายการ — ไม่ย้อน completed_at กลับแม้ยอดรวมจะตกลงมาต่ำกว่าเป้าอีกครั้ง (เหมือนพฤติกรรมเดิมของ goal) */
export async function deleteEntry(input: unknown): Promise<ActionResult> {
  const parsed = deleteEntrySchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("goal_entries")
    .delete()
    .eq("id", parsed.data.id)
    .select("id, goal_id")
    .maybeSingle();
  if (error) {
    console.error("[entries] delete failed", { code: error.code });
    return fail("generic");
  }
  if (!data) return fail("notFound");

  revalidateEntries(data.goal_id);
  return ok(null);
}
