import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

import type { EventPayloads, EventType } from "./types";

export type DomainEventRow = Database["public"]["Tables"]["domain_events"]["Row"];

/** ดึง event ที่ยังไม่ประมวลผล batch เล็ก (R4: Netlify 10 วิ) เรียงตามเวลา ข้ามที่ล้มเหลวเกิน maxAttempts */
export async function fetchUnprocessedEvents(
  limit: number,
  maxAttempts: number,
): Promise<DomainEventRow[]> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("domain_events")
    .select("*")
    .is("processed_at", null)
    .lt("attempts", maxAttempts)
    .order("created_at")
    .limit(limit);
  if (error) console.error("[events] fetch failed", { code: error.code });
  return data ?? [];
}

export async function markEventProcessed(id: string): Promise<void> {
  const admin = createAdminSupabase();
  await admin
    .from("domain_events")
    .update({ processed_at: new Date().toISOString(), last_error: null })
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
    .update({ attempts, last_error: message.slice(0, 500) })
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
