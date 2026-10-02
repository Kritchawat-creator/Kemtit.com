import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

import type { EventPayloads, EventType } from "./types";

export type DomainEventRow = Database["public"]["Tables"]["domain_events"]["Row"];

/**
 * Atomically claim a small batch of unprocessed events.
 * The PostgreSQL RPC uses FOR UPDATE SKIP LOCKED + processing_at so two cron
 * invocations cannot own the same event at the same time. Stale claims are
 * recoverable in the RPC after the safety window.
 */
export async function fetchUnprocessedEvents(
  limit: number,
  maxAttempts: number,
): Promise<DomainEventRow[]> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("claim_domain_events", {
    p_limit: limit,
    p_max_attempts: maxAttempts,
  });
  if (error) console.error("[events] claim failed", { code: error.code });
  return (data ?? []) as DomainEventRow[];
}

export async function markEventProcessed(id: string): Promise<void> {
  const admin = createAdminSupabase();
  await admin
    .from("domain_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_at: null,
      last_error: null,
    })
    .eq("id", id);
}

export async function markEventFailed(
  id: string,
  attempts: number,
  message: string,
): Promise<void> {
  const admin = createAdminSupabase();
  await admin
    .from("domain_events")
    .update({
      attempts,
      processing_at: null,
      last_error: message.slice(0, 500),
    })
    .eq("id", id);
}

/** insert event ในนาม service_role (cron/webhook ไม่มี session ของ user) */
export async function insertEventAsAdmin<T extends EventType>(
  userId: string,
  eventType: T,
  payload: EventPayloads[T],
): Promise<void> {
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("domain_events")
    .insert({ user_id: userId, event_type: eventType, payload });
  if (error) console.error("[events] admin insert failed", { eventType, code: error.code });
}

/**
 * Insert one logical source event exactly once. Used by scheduled V2 producers:
 * duplicate retries are benign, while any other database error must fail the job.
 */
export async function insertEventAsAdminOnce<T extends EventType>(
  userId: string,
  eventType: T,
  payload: EventPayloads[T],
  dedupeKey: string,
): Promise<"created" | "duplicate"> {
  const admin = createAdminSupabase();
  const { error } = await admin.from("domain_events").insert({
    user_id: userId,
    event_type: eventType,
    payload,
    dedupe_key: dedupeKey,
  });
  if (error?.code === "23505") return "duplicate";
  if (error) {
    console.error("[events] idempotent admin insert failed", {
      eventType,
      dedupeKey,
      code: error.code,
    });
    throw new Error("eventInsertFailed");
  }
  return "created";
}

/**
 * Reserve one outbound notification per source domain event before calling LINE.
 * The partial unique index on payload.sourceEventId is the final idempotency gate.
 * null = this source event has already reserved/completed a send.
 */
export async function reserveNotificationSend(
  sourceEventId: string,
  userId: string,
  kind: string,
  dryRun: boolean,
): Promise<string | null> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("domain_events")
    .insert({
      user_id: userId,
      event_type: "notification.sent",
      processed_at: new Date().toISOString(),
      payload: {
        channel: "line",
        kind,
        dryRun,
        sourceEventId,
      } satisfies EventPayloads["notification.sent"],
    })
    .select("id")
    .single();

  if (error?.code === "23505") return null;
  if (error || !data) {
    console.error("[events] notification reservation failed", {
      sourceEventId,
      code: error?.code,
    });
    throw new Error("notificationReservationFailed");
  }

  return data.id;
}

/** Release a reservation only when LINE explicitly reports a failed send so a retry is allowed. */
export async function releaseNotificationSend(reservationId: string): Promise<void> {
  const admin = createAdminSupabase();
  const { error } = await admin.from("domain_events").delete().eq("id", reservationId);
  if (error) {
    console.error("[events] notification reservation release failed", {
      reservationId,
      code: error.code,
    });
    throw new Error("notificationReservationReleaseFailed");
  }
}
