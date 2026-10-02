import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";

import type { CalendarProviderName } from "./provider";

export type ExternalCalendarSyncCandidate = {
  id: string;
  user_id: string;
  provider: CalendarProviderName;
};

export type GoogleCalendarSyncCandidate = Omit<ExternalCalendarSyncCandidate, "provider">;

/** Oldest attempted active provider connection wins so failures cannot starve another account. */
export async function listActiveExternalCalendarConnections(
  limit: number,
  provider?: CalendarProviderName,
): Promise<ExternalCalendarSyncCandidate[]> {
  const admin = createAdminSupabase();
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 10));
  let query = admin
    .from("external_calendar_connections")
    .select("id, user_id, provider")
    .eq("status", "active");
  if (provider) query = query.eq("provider", provider);
  const { data, error } = await query
    .order("last_sync_attempt_at", { ascending: true, nullsFirst: true })
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(boundedLimit);

  if (error) {
    console.error("[calendar-integrations] sync candidate query failed", { code: error.code });
    throw new Error("calendarSyncCandidatesFailed");
  }
  return (data ?? []).flatMap((row) => {
    if (row.provider !== "google" && row.provider !== "outlook") return [];
    return [{ id: row.id, user_id: row.user_id, provider: row.provider }];
  });
}

/** Compatibility wrapper for older Google-only job callers. */
export async function listActiveGoogleCalendarConnections(
  limit: number,
): Promise<GoogleCalendarSyncCandidate[]> {
  const candidates = await listActiveExternalCalendarConnections(limit, "google");
  return candidates
    .filter((connection) => connection.provider === "google")
    .map(({ id, user_id }) => ({ id, user_id }));
}
