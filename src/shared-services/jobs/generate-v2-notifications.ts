import "server-only";

import { daysLeft, periodOf } from "@/core/domain/periods";
import { insertEventAsAdminOnce } from "@/core/events/admin";
import {
  getV2DailyBriefInputs,
  getV2HabitReminderInputs,
  listV2InvestmentReminderGoals,
  listV2NotificationCandidates,
} from "@/core/notifications/admin";
import type { EventPayloads } from "@/core/events/types";
import { startOfWeekISO, todayBkk, weekdayOf, type ISODate } from "@/lib/date";

export type V2NotificationPhase = "morning" | "evening";

export type V2NotificationSummary = {
  phase: V2NotificationPhase;
  date: ISODate;
  candidates: number;
  eventsCreated: number;
  duplicatesSkipped: number;
  nextCursor: string | null;
};

type Candidate = {
  id: string;
  active_persona: string | null;
  work_mode: string | null;
  notify_daily_brief: boolean;
  notify_weekly_review: boolean;
  notify_habits: boolean;
  notify_investment: boolean;
};

const CANDIDATE_LIMIT = 25; // keep each serverless request bounded; cron workflow follows nextCursor

function resolvedWorkMode(profile: Candidate): "seller" | "professional" | null {
  if (profile.work_mode === "seller" || profile.work_mode === "professional")
    return profile.work_mode;
  if (profile.active_persona === "seller") return "seller";
  if (profile.active_persona === "office") return "professional";
  return null;
}

type ProducedEvent =
  "daily.brief" | "weekly.review.ready" | "habit.reminder" | "investment.reminder";

async function enqueue<T extends ProducedEvent>(
  userId: string,
  eventType: T,
  payload: EventPayloads[T],
  dedupeKey: string,
) {
  return (await insertEventAsAdminOnce(userId, eventType, payload, dedupeKey)) === "created";
}

async function dailyBriefPayload(userId: string, profile: Candidate, today: ISODate) {
  const workMode = resolvedWorkMode(profile);
  if (!workMode) return null;

  const { plan, priorityTasks, workGoal } = await getV2DailyBriefInputs(userId, today, workMode);
  const priorityIds = plan?.top_priorities ?? [];
  const byId = new Map((priorityTasks ?? []).map((task) => [task.id, task]));
  const importantTaskTitles = priorityIds.flatMap((id) => {
    const task = byId.get(id);
    return task ? [task.title] : [];
  });

  if (workMode === "seller") {
    const remaining =
      workGoal?.target_value != null
        ? Math.max(0, Number(workGoal.target_value) - Number(workGoal.current_value ?? 0))
        : null;
    const remainingDays = daysLeft(periodOf("month", today), today);

    return {
      date: today,
      workMode,
      importantTaskTitles,
      revenueRemaining: remaining,
      requiredDailyPace:
        remaining == null ? null : Math.ceil(remaining / Math.max(1, remainingDays)),
      plannedWorkloadMinutes: null,
      remainingCapacityMinutes: null,
    } as const;
  }

  const plannedWorkloadMinutes = priorityIds.reduce(
    (sum, id) => sum + (byId.get(id)?.estimated_minutes ?? 30),
    0,
  );
  const available = plan?.available_minutes ?? 480;

  return {
    date: today,
    workMode,
    importantTaskTitles,
    revenueRemaining: null,
    requiredDailyPace: null,
    plannedWorkloadMinutes,
    remainingCapacityMinutes: Math.max(0, available - plannedWorkloadMinutes),
  } as const;
}

async function generateHabitReminders(userId: string, today: ISODate) {
  const weekStart = startOfWeekISO(today);
  const { habits, completions } = await getV2HabitReminderInputs(userId, weekStart, today);

  const doneToday = new Set(
    (completions ?? []).filter((row) => row.completed_on === today).map((row) => row.habit_id),
  );
  const weeklyCounts = new Map<string, number>();
  for (const completion of completions ?? []) {
    weeklyCounts.set(completion.habit_id, (weeklyCounts.get(completion.habit_id) ?? 0) + 1);
  }

  return (habits ?? []).filter(
    (habit) =>
      !doneToday.has(habit.id) && (weeklyCounts.get(habit.id) ?? 0) < habit.target_per_week,
  );
}

async function generateInvestmentReminders(userId: string) {
  return listV2InvestmentReminderGoals(userId);
}

/**
 * Produce notification source events. Delivery remains the responsibility of the
 * domain-event processor, so provider retries and LINE idempotency stay centralized.
 */
export async function generateV2Notifications(
  phase: V2NotificationPhase,
  date: ISODate = todayBkk(),
  afterUserId?: string,
): Promise<V2NotificationSummary> {
  const profiles = await listV2NotificationCandidates(phase, afterUserId, CANDIDATE_LIMIT);

  const nextCursor =
    profiles.length === CANDIDATE_LIMIT ? (profiles[profiles.length - 1]?.id ?? null) : null;

  const summary: V2NotificationSummary = {
    phase,
    date,
    candidates: profiles.length,
    eventsCreated: 0,
    duplicatesSkipped: 0,
    nextCursor,
  };

  const record = async (created: boolean) => {
    if (created) summary.eventsCreated += 1;
    else summary.duplicatesSkipped += 1;
  };

  for (const profile of (profiles ?? []) as Candidate[]) {
    if (phase === "morning") {
      if (profile.notify_daily_brief) {
        const payload = await dailyBriefPayload(profile.id, profile, date);
        if (payload) {
          await record(
            await enqueue(profile.id, "daily.brief", payload, `daily.brief:${profile.id}:${date}`),
          );
        }
      }

      if (profile.notify_weekly_review && [0, 1].includes(weekdayOf(date))) {
        const weekStart = startOfWeekISO(date);
        await record(
          await enqueue(
            profile.id,
            "weekly.review.ready",
            { weekStart },
            `weekly.review.ready:${profile.id}:${weekStart}`,
          ),
        );
      }

      if (profile.notify_investment && Number(date.slice(8, 10)) <= 3) {
        for (const detail of await generateInvestmentReminders(profile.id)) {
          const goal = Array.isArray(detail.goal) ? detail.goal[0] : detail.goal;
          if (!goal) continue;
          await record(
            await enqueue(
              profile.id,
              "investment.reminder",
              {
                goalId: detail.goal_id,
                title: goal.title,
                monthlyTarget: detail.monthly_target,
                date,
              },
              `investment.reminder:${detail.goal_id}:${date.slice(0, 7)}`,
            ),
          );
        }
      }
    } else if (profile.notify_habits) {
      for (const habit of await generateHabitReminders(profile.id, date)) {
        await record(
          await enqueue(
            profile.id,
            "habit.reminder",
            { habitId: habit.id, title: habit.title, date },
            `habit.reminder:${habit.id}:${date}`,
          ),
        );
      }
    }
  }

  return summary;
}
