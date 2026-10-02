import type { DomainEventRow } from "@/core/events/admin";
import type { EventPayloads } from "@/core/events/types";
import type { Notifier } from "@/core/ports/notifier";

import {
  dailyBriefText,
  dailyPlanReadyText,
  goalCompletedText,
  habitReminderText,
  investmentReminderText,
  overdueText,
  weeklyReviewReadyText,
  type LineT,
} from "../notifications/line/messages";

/**
 * ประมวลผล domain_events เป็น batch (Flow C): handler ต่อ event type → mark processed / attempts+1
 * dependencies ฉีดเข้ามาเพื่อทดสอบได้โดยไม่ต้องมี DB/LINE
 */
export const EVENT_BATCH_SIZE = 20; // R4: Netlify function 10 วิ
export const MAX_ATTEMPTS = 5;

export type ProcessorDeps = {
  fetchBatch: (limit: number, maxAttempts: number) => Promise<DomainEventRow[]>;
  markProcessed: (id: string) => Promise<void>;
  markFailed: (id: string, attempts: number, message: string) => Promise<void>;
  getProfile: (
    userId: string,
  ) => Promise<{
    line_user_id: string | null;
    notify_overdue: boolean;
    notify_daily_brief: boolean;
    notify_weekly_review: boolean;
    notify_habits: boolean;
    notify_investment: boolean;
  } | null>;
  getTaskTitles: (userId: string, ids: string[]) => Promise<string[]>;
  reserveSend: (
    sourceEventId: string,
    userId: string,
    kind: string,
    dryRun: boolean,
  ) => Promise<string | null>;
  releaseSend: (reservationId: string) => Promise<void>;
  notifier: Notifier;
  t: LineT;
  appUrl: string;
};

export type ProcessorSummary = {
  fetched: number;
  processed: number;
  failed: number;
  sent: number;
  skipped: number;
};

type HandlerResult = "sent" | "skipped";

/**
 * Reserve before calling LINE. The reservation is keyed by source event id in DB,
 * so a retry after a successful push cannot push the same source event again.
 * When LINE explicitly fails, release the reservation so the source event can retry.
 */
async function pushOnce(
  event: DomainEventRow,
  deps: ProcessorDeps,
  kind: string,
  recipientId: string,
  text: string,
): Promise<HandlerResult> {
  const reservationId = await deps.reserveSend(event.id, event.user_id, kind, deps.notifier.dryRun);
  if (!reservationId) return "skipped";

  const result = await deps.notifier.push(recipientId, text);

  if (!result.ok) {
    // An explicit LINE HTTP failure means no delivery was accepted, so release
    // the reservation and allow a retry. If push() itself throws (ambiguous
    // network outcome), keep the reservation to prefer no duplicate delivery.
    await deps.releaseSend(reservationId);
    throw new Error(result.error);
  }

  return "sent";
}

async function handleGoalCompleted(
  event: DomainEventRow,
  deps: ProcessorDeps,
): Promise<HandlerResult> {
  const payload = event.payload as unknown as EventPayloads["goal.completed"];
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id) return "skipped";

  return pushOnce(
    event,
    deps,
    "goal.completed",
    profile.line_user_id,
    goalCompletedText(deps.t, deps.appUrl, payload.goalId, payload.title),
  );
}

async function handleTaskOverdue(
  event: DomainEventRow,
  deps: ProcessorDeps,
): Promise<HandlerResult> {
  const payload = event.payload as unknown as EventPayloads["task.overdue"];
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id || !profile.notify_overdue) return "skipped";

  const titles = await deps.getTaskTitles(event.user_id, payload.taskIds);
  if (titles.length === 0) return "skipped";

  return pushOnce(
    event,
    deps,
    "task.overdue",
    profile.line_user_id,
    overdueText(deps.t, deps.appUrl, titles),
  );
}

async function handleDailyPlanReady(
  event: DomainEventRow,
  deps: ProcessorDeps,
): Promise<HandlerResult> {
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id || !profile.notify_daily_brief) return "skipped";
  return pushOnce(
    event,
    deps,
    "daily.plan.ready",
    profile.line_user_id,
    dailyPlanReadyText(deps.t, deps.appUrl),
  );
}

async function handleDailyBrief(
  event: DomainEventRow,
  deps: ProcessorDeps,
): Promise<HandlerResult> {
  const payload = event.payload as unknown as EventPayloads["daily.brief"];
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id || !profile.notify_daily_brief) return "skipped";
  return pushOnce(
    event,
    deps,
    "daily.brief",
    profile.line_user_id,
    dailyBriefText(deps.t, deps.appUrl, payload),
  );
}

async function handleWeeklyReviewReady(
  event: DomainEventRow,
  deps: ProcessorDeps,
): Promise<HandlerResult> {
  const payload = event.payload as unknown as EventPayloads["weekly.review.ready"];
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id || !profile.notify_weekly_review) return "skipped";
  return pushOnce(
    event,
    deps,
    "weekly.review.ready",
    profile.line_user_id,
    weeklyReviewReadyText(deps.t, deps.appUrl, payload.weekStart),
  );
}

async function handleHabitReminder(
  event: DomainEventRow,
  deps: ProcessorDeps,
): Promise<HandlerResult> {
  const payload = event.payload as unknown as EventPayloads["habit.reminder"];
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id || !profile.notify_habits) return "skipped";
  return pushOnce(
    event,
    deps,
    "habit.reminder",
    profile.line_user_id,
    habitReminderText(deps.t, deps.appUrl, payload.title),
  );
}

async function handleInvestmentReminder(
  event: DomainEventRow,
  deps: ProcessorDeps,
): Promise<HandlerResult> {
  const payload = event.payload as unknown as EventPayloads["investment.reminder"];
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id || !profile.notify_investment) return "skipped";
  return pushOnce(
    event,
    deps,
    "investment.reminder",
    profile.line_user_id,
    investmentReminderText(deps.t, deps.appUrl, payload.title, payload.monthlyTarget),
  );
}

const HANDLERS: Partial<
  Record<string, (event: DomainEventRow, deps: ProcessorDeps) => Promise<HandlerResult>>
> = {
  "goal.completed": handleGoalCompleted,
  "task.overdue": handleTaskOverdue,
  "daily.plan.ready": handleDailyPlanReady,
  "daily.brief": handleDailyBrief,
  "weekly.review.ready": handleWeeklyReviewReady,
  "habit.reminder": handleHabitReminder,
  "investment.reminder": handleInvestmentReminder,
};

export async function processEvents(
  deps: ProcessorDeps,
  limit = EVENT_BATCH_SIZE,
): Promise<ProcessorSummary> {
  const events = await deps.fetchBatch(limit, MAX_ATTEMPTS);
  const summary: ProcessorSummary = {
    fetched: events.length,
    processed: 0,
    failed: 0,
    sent: 0,
    skipped: 0,
  };

  for (const event of events) {
    const handler = HANDLERS[event.event_type];
    try {
      if (handler) {
        const outcome = await handler(event, deps);
        if (outcome === "sent") summary.sent += 1;
        else summary.skipped += 1;
      } else {
        summary.skipped += 1; // event log อย่างเดียว (goal.created, task.completed, …)
      }
      await deps.markProcessed(event.id);
      summary.processed += 1;
    } catch (error) {
      summary.failed += 1;
      await deps.markFailed(
        event.id,
        event.attempts + 1,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return summary;
}
