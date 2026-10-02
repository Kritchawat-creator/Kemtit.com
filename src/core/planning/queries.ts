import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { addDaysISO, type ISODate } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  DEFAULT_PLANNING_PREFERENCES,
  parsePlanningPreferences,
  type PlanningPreferences,
} from "./preferences";

export async function getPlanningPreferences(): Promise<PlanningPreferences> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("planning_preferences")
    .select("timezone, working_windows, break_windows")
    .maybeSingle();
  if (error) {
    console.error("[planning] getPlanningPreferences failed", { code: error.code });
    throw new QueryError("planning.getPlanningPreferences", error.code);
  }
  if (!data) return DEFAULT_PLANNING_PREFERENCES;
  return parsePlanningPreferences({
    timezone: data.timezone,
    workingWindows: data.working_windows,
    breakWindows: data.break_windows,
  });
}

export async function getDailyPlan(planDate: ISODate) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("daily_plans")
    .select("*")
    .eq("plan_date", planDate)
    .maybeSingle();
  if (error) {
    console.error("[planning] getDailyPlan failed", { code: error.code });
    throw new QueryError("planning.getDailyPlan", error.code);
  }
  return data;
}

export async function getTimeBlocksForDate(date: ISODate) {
  const supabase = await createServerSupabase();
  const nextDate = addDaysISO(date, 1);
  const { data, error } = await supabase
    .from("time_blocks")
    .select("*")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .eq("status", "active")
    .gte("start_at", `${date}T00:00:00+07:00`)
    .lt("start_at", `${nextDate}T00:00:00+07:00`)
    .order("start_at");
  if (error) {
    console.error("[planning] getTimeBlocksForDate failed", { code: error.code });
    throw new QueryError("planning.getTimeBlocksForDate", error.code);
  }
  return data ?? [];
}

export async function getTimeBlockStatsForRange(
  from: ISODate,
  to: ISODate,
): Promise<{ blocks: number; minutes: number }> {
  const supabase = await createServerSupabase();
  const until = addDaysISO(to, 1);
  const { data, error } = await supabase
    .from("time_blocks")
    .select("start_at, end_at")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .eq("status", "active")
    .gte("start_at", `${from}T00:00:00+07:00`)
    .lt("start_at", `${until}T00:00:00+07:00`);

  if (error) {
    console.error("[planning] getTimeBlockStatsForRange failed", { code: error.code });
    throw new QueryError("planning.getTimeBlockStatsForRange", error.code);
  }

  const minutes = (data ?? []).reduce((sum, block) => {
    const duration = Math.max(
      0,
      Math.round((new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) / 60_000),
    );
    return sum + duration;
  }, 0);

  return { blocks: data?.length ?? 0, minutes };
}

export async function getLatestWeeklyReview() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[reviews] getLatestWeeklyReview failed", { code: error.code });
    throw new QueryError("reviews.getLatestWeeklyReview", error.code);
  }
  return data;
}

export async function getWeeklyReview(weekStart: ISODate) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) {
    console.error("[reviews] getWeeklyReview failed", { code: error.code });
    throw new QueryError("reviews.getWeeklyReview", error.code);
  }
  return data;
}

export async function getReviewCarryoverTasks(weekStart: ISODate) {
  const supabase = await createServerSupabase();
  const weekEnd = addDaysISO(weekStart, 6);
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, planned_date, deadline, priority, estimated_minutes")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .is("archived_at", null)
    .is("deleted_at", null)
    .is("completed_at", null)
    .not("planned_date", "is", null)
    .gte("planned_date", weekStart)
    .lte("planned_date", weekEnd)
    .order("priority")
    .order("planned_date")
    .order("created_at");
  if (error) {
    console.error("[reviews] getReviewCarryoverTasks failed", { code: error.code });
    throw new QueryError("reviews.getReviewCarryoverTasks", error.code);
  }
  return data ?? [];
}
