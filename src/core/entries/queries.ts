import "server-only";

import { cache } from "react";

import { entryStreak, sumAmounts } from "@/core/domain/entries";
import type { PeriodType } from "@/core/domain/periods";
import { goalUnit } from "@/core/goals/schema";
import { addDaysISO, type ISODate } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

import type { Channel, EntryGoalOption, GoalEntry, GoalEntryWithGoal } from "./schema";

const ENTRY_WITH_GOAL = "*, goal:goals(id, title, persona_data)";

/** ทุกรายการบันทึกยอดของ goal เดียว เรียงเก่า→ใหม่ (ใช้ทำกราฟสะสม) */
export async function listGoalEntries(goalId: string): Promise<GoalEntry[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("goal_entries")
    .select("*")
    .eq("goal_id", goalId)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[entries] listGoalEntries failed", { code: error.code });
    return [];
  }
  return (data ?? []) as unknown as GoalEntry[];
}

export type EntryFilter = {
  goalId?: string;
  from?: ISODate;
  to?: ISODate;
  channel?: Channel;
  search?: string;
  limit?: number;
  offset?: number;
};

/** รายการบันทึกยอด (ทุก goal หรือกรองตาม filter) พร้อมจำนวนทั้งหมด — ใช้กับหน้า /entries และ dashboard */
export async function listEntries(
  filter: EntryFilter = {},
): Promise<{ rows: GoalEntryWithGoal[]; total: number }> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("goal_entries")
    .select(ENTRY_WITH_GOAL, { count: "exact" })
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filter.goalId) query = query.eq("goal_id", filter.goalId);
  if (filter.from) query = query.gte("entry_date", filter.from);
  if (filter.to) query = query.lte("entry_date", filter.to);
  if (filter.channel) query = query.eq("channel", filter.channel);
  if (filter.search) query = query.ilike("note", `%${filter.search}%`);

  const limit = filter.limit ?? 20;
  const offset = filter.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[entries] listEntries failed", { code: error.code });
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []) as unknown as GoalEntryWithGoal[], total: count ?? 0 };
}

/** เป้าที่บันทึกยอดได้ (metric, active) สำหรับตัวเลือกในฟอร์ม — cache() กันยิงซ้ำในคำขอเดียว (§2.9) */
export const listEntryGoalOptions = cache(async (): Promise<EntryGoalOption[]> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("goals")
    .select("id, title, persona_data, period_type, period_start, target_value")
    .eq("status", "active")
    .eq("goal_kind", "metric")
    .order("period_start");
  if (error) {
    console.error("[entries] listEntryGoalOptions failed", { code: error.code });
    return [];
  }
  return (data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    unit: goalUnit(g),
    period_type: g.period_type as PeriodType,
    period_start: g.period_start,
    target_value: g.target_value,
  }));
});

const STREAK_LOOKBACK_DAYS = 60;

/** streak วันติดต่อกันที่มีการบันทึกยอด (ทุก goal รวมกัน) — คนละสูตรข้อมูลกับ getStreak (งาน) แต่สูตรนับเดียวกัน */
export async function getEntryStreak(today: ISODate): Promise<number> {
  const supabase = await createServerSupabase();
  const since = addDaysISO(today, -STREAK_LOOKBACK_DAYS);
  const { data, error } = await supabase
    .from("goal_entries")
    .select("entry_date")
    .gte("entry_date", since);
  if (error) {
    console.error("[entries] getEntryStreak failed", { code: error.code });
    return 0;
  }
  return entryStreak(
    (data ?? []).map((e) => e.entry_date),
    today,
  );
}

/** ผลรวมยอดในช่วง [from, to] — ใช้เทียบเดือนก่อน/เมื่อวาน ("เทียบ ส.ค." / "เทียบเมื่อวาน") จำกัด goal เดียวได้ */
export async function sumEntriesBetween(
  from: ISODate,
  to: ISODate,
  goalId?: string,
): Promise<number> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("goal_entries")
    .select("amount")
    .gte("entry_date", from)
    .lte("entry_date", to);
  if (goalId) query = query.eq("goal_id", goalId);
  const { data, error } = await query;
  if (error) {
    console.error("[entries] sumEntriesBetween failed", { code: error.code });
    return 0;
  }
  return sumAmounts(data ?? []);
}
