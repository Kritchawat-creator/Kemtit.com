import "server-only";

import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";
import { QueryError } from "@/core/shared/query-error";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

import type {
  ExternalCalendarConnection,
  ExternalCalendarOperationSummary,
  ExternalCalendarOperationStatus,
} from "./schema";
import { listExternalCalendarEventDetails as loadEventDetails } from "./service";

const SAFE_SYNC_ERRORS = new Set([
  "configuration",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "timeout",
  "request_failed",
  "invalid_response",
]);

const SAFE_OPERATION_ERRORS = new Set([
  "revision_conflict",
  "event_not_editable",
  "operation_mismatch",
  "connection_unavailable",
  "provider_conflict",
  "provider_forbidden",
  "provider_unauthorized",
  "provider_not_found",
  "provider_rate_limited",
  "provider_timeout",
  "provider_request_failed",
  "configuration",
  "invalid_response",
  "response_unknown",
  "lease_lost",
]);

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  source: string,
): Promise<string | null> {
  let user: { id: string } | null = null;
  let authError: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  } catch (error) {
    authError = error;
  }

  if (authError) {
    if (isUnauthenticatedAuthError(authError)) return null;
    const context = authFailureContext(authError);
    console.error("[calendar-integrations] auth verification failed", context);
    throw new QueryError(source, context.code);
  }

  return user?.id ?? null;
}

export async function listExternalCalendarConnections(): Promise<ExternalCalendarConnection[]> {
  const supabase = await createServerSupabase();
  const userId = await authenticatedUserId(supabase, "calendar-integrations.connections-auth");
  if (!userId) return [];

  const { data, error } = await supabase
    .from("external_calendar_connections")
    .select(
      "id, provider, account_label, status, sync_status, can_write, last_synced_at, last_error",
    )
    .eq("user_id", userId)
    .order("created_at");

  if (error) {
    console.error("[calendar-integrations] connection list failed", { code: error.code });
    throw new QueryError("calendar-integrations.connections", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    provider: row.provider as ExternalCalendarConnection["provider"],
    accountLabel: row.account_label,
    status: row.status as ExternalCalendarConnection["status"],
    syncStatus: row.sync_status as ExternalCalendarConnection["syncStatus"],
    canWrite: row.can_write,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error && SAFE_SYNC_ERRORS.has(row.last_error) ? row.last_error : null,
  }));
}

/** Recent unresolved writes, with no provider IDs, ETags, credentials, or payloads. */
export async function listExternalCalendarOperations(
  limit = 40,
): Promise<ExternalCalendarOperationSummary[]> {
  const supabase = await createServerSupabase();
  const userId = await authenticatedUserId(supabase, "calendar-integrations.operations-auth");
  if (!userId) return [];

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("external_calendar_operations")
    .select(
      "operation_id, connection_id, source_event_id, operation_kind, status, error_code, updated_at",
    )
    .eq("user_id", userId)
    .in("status", ["queued", "pending", "unknown", "conflict"])
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(Math.floor(limit), 100)));

  if (error) {
    console.error("[calendar-integrations] unresolved operation list failed", { code: error.code });
    throw new QueryError("calendar-integrations.operations", error.code);
  }

  return (data ?? []).map((row) => ({
    operationId: row.operation_id,
    connectionId: row.connection_id,
    sourceEventId: row.source_event_id,
    kind: row.operation_kind as ExternalCalendarOperationSummary["kind"],
    status: row.status as ExternalCalendarOperationStatus,
    errorCode: row.error_code && SAFE_OPERATION_ERRORS.has(row.error_code) ? row.error_code : null,
    updatedAt: row.updated_at,
  }));
}

/** Canonical source details for provider projections; no provider ID or ETag crosses this boundary. */
export async function listExternalCalendarEventDetails(sourceEventIds: string[]) {
  const supabase = await createServerSupabase();
  const userId = await authenticatedUserId(supabase, "calendar-integrations.event-details-auth");
  if (!userId) return [];

  const ids = [...new Set(sourceEventIds)].slice(0, 100);
  try {
    return await loadEventDetails(userId, ids);
  } catch (error) {
    const code = error instanceof Error ? error.name : "unknown";
    console.error("[calendar-integrations] event details failed", { code });
    throw new QueryError("calendar-integrations.event-details");
  }
}
