import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { EventPayloads, EventType } from "./types";

type Client = SupabaseClient<Database>;

/**
 * เขียนแถวลง domain_events — side effect ทำโดย cron ทีหลัง (Flow C)
 * ไม่ throw: ถ้าเขียน event ไม่สำเร็จ action หลักต้องไม่พังตาม (log อย่างเดียว)
 */
export async function emitEvent<T extends EventType>(
  client: Client,
  userId: string,
  eventType: T,
  payload: EventPayloads[T],
): Promise<void> {
  const { error } = await client.from("domain_events").insert({
    user_id: userId,
    event_type: eventType,
    payload,
  });
  if (error) console.error("[events] emit failed", { eventType, code: error.code });
}
