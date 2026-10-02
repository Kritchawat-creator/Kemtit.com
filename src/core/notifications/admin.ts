import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import type { ISODate } from "@/lib/date";
import { startOfMonthISO } from "@/lib/date";
import { createAdminSupabase } from "@/lib/supabase/admin";

type NotificationCandidate = {
  id: string;
  active_persona: string | null;
  work_mode: string | null;
  notify_daily_brief: boolean;
  notify_weekly_review: boolean;
  notify_habits: boolean;
  notify_investment: boolean;
};

export async function listV2NotificationCandidates(
  phase: "morning" | "evening",
  afterUserId: string | undefined,
  limit: number,
): Promise<NotificationCandidate[]> {
  const admin = createAdminSupabase();
  let profileQuery = admin
    .from("user_profiles")
    .select(
      "id, active_persona, work_mode, notify_daily_brief, notify_weekly_review, notify_habits, notify_investment",
    )
    .not("line_user_id", "is", null)
    .order("id")
    .limit(limit);

  profileQuery =
    phase === "morning"
      ? profileQuery.or(
          "notify_daily_brief.eq.true,notify_weekly_review.eq.true,notify_investment.eq.true",
        )
      : profileQuery.eq("notify_habits", true);

  if (afterUserId) profileQuery = profileQuery.gt("id", afterUserId);

  const { data, error } = await profileQuery;
  if (error) throw new Error(`notificationCandidatesFailed:${error.code}`);
  return (data ?? []) as NotificationCandidate[];
}

export async function getV2DailyBriefInputs(
  userId: string,
  today: ISODate,
  workMode: "seller" | "professional",
) {
  const admin = createAdminSupabase();
  const { data: plan } = await admin
    .from("daily_plans")
    .select("available_minutes, top_priorities")
    .eq("user_id", userId)
    .eq("plan_date", today)
    .maybeSingle();

  const priorityIds = plan?.top_priorities ?? [];
  const { data: priorityTasks } =
    priorityIds.length > 0
      ? await admin
          .from("tasks")
          .select("id, title, estimated_minutes")
          .eq("user_id", userId)
          .in("data_origin", [...COUNTED_DATA_ORIGINS])
          .in("id", priorityIds)
      : { data: [] as { id: string; title: string; estimated_minutes: number | null }[] };

  const { data: workGoal } =
    workMode === "seller"
      ? await admin
          .from("goals")
          .select("target_value, current_value")
          .eq("user_id", userId)
          .in("data_origin", [...COUNTED_DATA_ORIGINS])
          .eq("domain", "work")
          .eq("goal_kind", "metric")
          .eq("period_type", "month")
          .eq("period_start", startOfMonthISO(today))
          .neq("status", "archived")
          .limit(1)
          .maybeSingle()
      : { data: null };

  return {
    plan,
    priorityTasks: priorityTasks ?? [],
    workGoal,
  };
}

export async function getV2HabitReminderInputs(userId: string, weekStart: ISODate, today: ISODate) {
  const admin = createAdminSupabase();
  const [{ data: habits }, { data: completions }] = await Promise.all([
    admin
      .from("habits")
      .select("id, title, target_per_week")
      .eq("user_id", userId)
      .in("data_origin", [...COUNTED_DATA_ORIGINS])
      .is("archived_at", null),
    admin
      .from("habit_completions")
      .select("habit_id, completed_on")
      .eq("user_id", userId)
      .gte("completed_on", weekStart)
      .lte("completed_on", today),
  ]);

  return {
    habits: habits ?? [],
    completions: completions ?? [],
  };
}

export async function listV2InvestmentReminderGoals(userId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("finance_goal_details")
    .select("goal_id, monthly_target, goal:goals!inner(id, title, data_origin)")
    .eq("user_id", userId)
    .eq("finance_type", "investment")
    .in("goal.data_origin", [...COUNTED_DATA_ORIGINS]);
  return data ?? [];
}
