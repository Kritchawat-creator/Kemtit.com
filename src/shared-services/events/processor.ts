import type { DomainEventRow } from "@/core/events/admin";
import type { EventPayloads } from "@/core/events/types";
import type { Notifier } from "@/core/ports/notifier";

import { goalCompletedText, overdueText, type LineT } from "../notifications/line/messages";

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
  getProfile: (userId: string) => Promise<{ line_user_id: string | null; notify_overdue: boolean } | null>;
  getTaskTitles: (userId: string, ids: string[]) => Promise<string[]>;
  recordSent: (userId: string, kind: string, dryRun: boolean) => Promise<void>;
  notifier: Notifier;
  t: LineT;
  appUrl: string;
};

export type ProcessorSummary = { fetched: number; processed: number; failed: number; sent: number; skipped: number };

type HandlerResult = "sent" | "skipped";

async function handleGoalCompleted(event: DomainEventRow, deps: ProcessorDeps): Promise<HandlerResult> {
  const payload = event.payload as unknown as EventPayloads["goal.completed"];
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id) return "skipped";
  const result = await deps.notifier.push(profile.line_user_id, goalCompletedText(deps.t, deps.appUrl, payload.goalId, payload.title));
  if (!result.ok) throw new Error(result.error);
  await deps.recordSent(event.user_id, "goal.completed", result.dryRun);
  return "sent";
}

async function handleTaskOverdue(event: DomainEventRow, deps: ProcessorDeps): Promise<HandlerResult> {
  const payload = event.payload as unknown as EventPayloads["task.overdue"];
  const profile = await deps.getProfile(event.user_id);
  if (!profile?.line_user_id || !profile.notify_overdue) return "skipped";
  const titles = await deps.getTaskTitles(event.user_id, payload.taskIds);
  if (titles.length === 0) return "skipped";
  const result = await deps.notifier.push(profile.line_user_id, overdueText(deps.t, deps.appUrl, titles));
  if (!result.ok) throw new Error(result.error);
  await deps.recordSent(event.user_id, "task.overdue", result.dryRun);
  return "sent";
}

const HANDLERS: Partial<Record<string, (event: DomainEventRow, deps: ProcessorDeps) => Promise<HandlerResult>>> = {
  "goal.completed": handleGoalCompleted,
  "task.overdue": handleTaskOverdue,
};

export async function processEvents(deps: ProcessorDeps, limit = EVENT_BATCH_SIZE): Promise<ProcessorSummary> {
  const events = await deps.fetchBatch(limit, MAX_ATTEMPTS);
  const summary: ProcessorSummary = { fetched: events.length, processed: 0, failed: 0, sent: 0, skipped: 0 };

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
      await deps.markFailed(event.id, event.attempts + 1, error instanceof Error ? error.message : String(error));
    }
  }
  return summary;
}
