import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { addDaysISO, APP_TIME_ZONE, isISODate, type ISODate } from "@/lib/date";
import { getGoogleCalendarEnv, getOutlookCalendarEnv } from "@/lib/env.server";
import { decryptSecret, encryptSecret } from "@/lib/secret-box.server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

import { projectProviderEvent, type CalendarProjectionBounds } from "./projection";
import { providerReadbackWindow } from "./provider-window";
import { isCalendarProviderFailure, validateCalendarEventValue } from "./provider-http";
import { getCalendarProvider } from "./providers";
import type {
  CalendarEventValue,
  CalendarEventWindow,
  CalendarProviderAccount,
  CalendarProviderEvent,
  CalendarProviderEventChangedField,
  CalendarProviderName,
  CalendarProviderTokens,
} from "./provider";
import { EXTERNAL_CALENDAR_PROVIDERS } from "./schema";

const MAX_SNAPSHOT_EVENTS = 20_000;
const MAX_SNAPSHOT_PROJECTIONS = 20_000;
const MAX_OPERATION_PROJECTION_DAYS = 732;
const PROVIDER_WORK_TIMEOUT_MS = 45_000;
const SAFE_DATABASE_ERRORS = [
  "calendar_connection_unavailable",
  "calendar_refresh_token_missing",
  "calendar_sync_lease_lost",
  "calendar_snapshot_invalid",
  "calendar_snapshot_projection_limit",
  "calendar_snapshot_duplicate",
  "calendar_projection_invalid",
  "calendar_operation_invalid",
  "calendar_operation_mismatch",
  "calendar_operation_revision_conflict",
  "calendar_operation_not_editable",
] as const;

type SafeDatabaseError = (typeof SAFE_DATABASE_ERRORS)[number];
type CalendarSyncErrorCode =
  | "configuration"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "timeout"
  | "request_failed"
  | "invalid_response"
  | "response_unknown"
  | "lease_lost";
type OperationStatus = "queued" | "pending" | "succeeded" | "conflict" | "unknown" | "failed";

type CalendarConnection = Pick<
  Database["public"]["Tables"]["external_calendar_connections"]["Row"],
  "id" | "user_id" | "provider" | "external_calendar_id" | "account_label" | "status" | "can_write"
>;

type ExternalSource = Database["public"]["Tables"]["external_calendar_event_sources"]["Row"];
type CalendarOperation = Database["public"]["Tables"]["external_calendar_operations"]["Row"];

export class ExternalCalendarServiceError extends Error {
  constructor(
    readonly code:
      | "unauthorized"
      | "notFound"
      | "validation"
      | "externalCalendarUnavailable"
      | "externalCalendarConflict"
      | "externalCalendarOutcomeUnknown"
      | "calendarSyncFailed"
      | "generic",
  ) {
    super(code);
    this.name = "ExternalCalendarServiceError";
  }
}

export type ExternalCalendarOperationResult = {
  operationId: string;
  status: OperationStatus;
  sourceEventId?: string;
};

export type ExternalCalendarEventDetail = {
  sourceEventId: string;
  connectionId: string;
  provider: CalendarProviderName;
  providerLabel: string | null;
  value: CalendarEventValue;
  kind: CalendarProviderEvent["kind"];
  revision: string;
  editable: boolean;
};

function isProviderName(value: string): value is CalendarProviderName {
  return EXTERNAL_CALENDAR_PROVIDERS.includes(value as CalendarProviderName);
}

function safeDbError(
  error: { message?: string; code?: string } | null | undefined,
): SafeDatabaseError | null {
  const message = error?.message ?? "";
  return SAFE_DATABASE_ERRORS.find((known) => message.includes(known)) ?? null;
}

function syncErrorCode(error: unknown): CalendarSyncErrorCode {
  if (error instanceof ExternalCalendarServiceError) {
    if (error.code === "externalCalendarUnavailable") return "request_failed";
    if (error.code === "externalCalendarConflict") return "conflict";
    if (error.code === "externalCalendarOutcomeUnknown") return "response_unknown";
    if (error.code === "calendarSyncFailed") return "request_failed";
  }
  if (isCalendarProviderFailure(error)) return error.code;
  if (error instanceof Error && error.message === "configuration") return "configuration";
  if (error instanceof Error && error.message === "lease_lost") return "lease_lost";
  return "request_failed";
}

function encryptionKey(provider: CalendarProviderName): string {
  try {
    return provider === "google"
      ? getGoogleCalendarEnv().tokenEncryptionKey
      : getOutlookCalendarEnv().tokenEncryptionKey;
  } catch {
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}

function safeProviderEvent(event: CalendarProviderEvent): CalendarProviderEvent {
  return {
    externalId: event.externalId,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    blocksTime: event.blocksTime,
    etag: event.etag,
    operationId: event.operationId,
    kind: event.kind,
  };
}

function snapshotWindow(now = new Date()): {
  window: CalendarEventWindow;
  bounds: CalendarProjectionBounds;
} {
  const start = addDays(now, -365);
  const end = addDays(now, 365);
  const startDate = formatInTimeZone(start, APP_TIME_ZONE, "yyyy-MM-dd") as ISODate;
  const endDate = addDaysISO(formatInTimeZone(end, APP_TIME_ZONE, "yyyy-MM-dd"), 1);
  return {
    window: { start: start.toISOString(), end: end.toISOString() },
    bounds: { startDate, endDateExclusive: endDate },
  };
}

function eventProjectionBounds(value: CalendarEventValue): CalendarProjectionBounds {
  const startDate = value.allDay
    ? value.start
    : formatInTimeZone(new Date(value.start), APP_TIME_ZONE, "yyyy-MM-dd");
  const lastDate = value.allDay
    ? addDaysISO(value.end as ISODate, -1)
    : formatInTimeZone(new Date(Date.parse(value.end) - 1), APP_TIME_ZONE, "yyyy-MM-dd");
  const endDateExclusive = addDaysISO(lastDate, 1);
  if (!isISODate(startDate) || !isISODate(endDateExclusive)) {
    throw new ExternalCalendarServiceError("validation");
  }
  const duration = Math.round(
    (Date.parse(`${endDateExclusive}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) /
      86_400_000,
  );
  if (duration < 1 || duration > MAX_OPERATION_PROJECTION_DAYS) {
    throw new ExternalCalendarServiceError("validation");
  }
  return { startDate, endDateExclusive };
}

function snapshotPayload(event: CalendarProviderEvent, bounds: CalendarProjectionBounds) {
  const source = safeProviderEvent(event);
  const projections = projectProviderEvent(source, bounds);
  return {
    ...source,
    payloadHash: hashValue(source),
    projections,
  };
}

async function loadOwnedConnection(
  userId: string,
  connectionId: string,
  options: { active?: boolean } = {},
): Promise<CalendarConnection & { provider: CalendarProviderName }> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("external_calendar_connections")
    .select("id, user_id, provider, external_calendar_id, account_label, status, can_write")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[calendar-integrations] connection read failed", { code: error.code });
    throw new ExternalCalendarServiceError("generic");
  }
  if (!data || !isProviderName(data.provider)) throw new ExternalCalendarServiceError("notFound");
  if (options.active && data.status !== "active") {
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }
  return data as CalendarConnection & { provider: CalendarProviderName };
}

async function validAccessToken(
  userId: string,
  connection: CalendarConnection & { provider: CalendarProviderName },
  leaseId: string,
  signal?: AbortSignal,
): Promise<string> {
  const admin = createAdminSupabase();
  const { data: credential, error } = await admin
    .from("external_calendar_credentials")
    .select("refresh_token_ciphertext, access_token_ciphertext, access_token_expires_at, scope")
    .eq("connection_id", connection.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[calendar-integrations] credential read failed", { code: error.code });
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }
  if (!credential) throw new ExternalCalendarServiceError("externalCalendarUnavailable");

  const key = encryptionKey(connection.provider);
  if (
    credential.access_token_ciphertext &&
    credential.access_token_expires_at &&
    Date.parse(credential.access_token_expires_at) > Date.now() + 60_000
  ) {
    try {
      return decryptSecret(credential.access_token_ciphertext, key);
    } catch {
      throw new ExternalCalendarServiceError("externalCalendarUnavailable");
    }
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(credential.refresh_token_ciphertext, key);
  } catch {
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }

  let tokens: CalendarProviderTokens;
  try {
    tokens = await getCalendarProvider(connection.provider).refreshTokens(refreshToken, signal);
  } catch (error) {
    if (isCalendarProviderFailure(error) && error.code === "configuration") {
      throw new ExternalCalendarServiceError("externalCalendarUnavailable");
    }
    throw error;
  }

  const { data, error: updateError } = await admin.rpc("update_external_calendar_tokens", {
    p_user_id: userId,
    p_connection_id: connection.id,
    p_lease_id: leaseId,
    p_refresh_token_ciphertext: tokens.refreshToken
      ? encryptSecret(tokens.refreshToken, key)
      : null,
    p_access_token_ciphertext: encryptSecret(tokens.accessToken, key),
    p_access_token_expires_at: tokens.expiresAt,
    p_scopes: tokens.scopes,
  });
  if (updateError) {
    console.error("[calendar-integrations] refreshed credentials could not be saved", {
      code: updateError.code,
    });
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }
  if (!data) throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  return tokens.accessToken;
}

export async function persistExternalCalendarConnection(input: {
  userId: string;
  provider: CalendarProviderName;
  account: CalendarProviderAccount;
  tokens: CalendarProviderTokens;
}): Promise<string> {
  if (
    !input.userId ||
    !input.account.providerAccountId.trim() ||
    !input.tokens.accessToken ||
    !Number.isFinite(Date.parse(input.tokens.expiresAt))
  ) {
    throw new ExternalCalendarServiceError("validation");
  }

  const key = encryptionKey(input.provider);
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("persist_external_calendar_connection", {
    p_user_id: input.userId,
    p_provider: input.provider,
    p_account_id: input.account.providerAccountId,
    p_account_label: input.account.label,
    p_calendar_id: "primary",
    p_refresh_token_ciphertext: input.tokens.refreshToken
      ? encryptSecret(input.tokens.refreshToken, key)
      : null,
    p_access_token_ciphertext: encryptSecret(input.tokens.accessToken, key),
    p_access_token_expires_at: input.tokens.expiresAt,
    p_scopes: input.tokens.scopes,
  });
  if (error || !data) {
    if (safeDbError(error) === "calendar_refresh_token_missing") {
      throw new ExternalCalendarServiceError("externalCalendarUnavailable");
    }
    console.error("[calendar-integrations] connection persist failed", { code: error?.code });
    throw new ExternalCalendarServiceError("generic");
  }
  return data;
}

/** Drain a complete provider window, build all day projections, then commit one snapshot RPC. */
export async function syncExternalCalendar(userId: string, connectionId: string): Promise<number> {
  const connection = await loadOwnedConnection(userId, connectionId, { active: true });
  const admin = createAdminSupabase();
  const leaseId = randomUUID();
  const { data: claimed, error: claimError } = await admin.rpc("claim_external_calendar_sync", {
    p_user_id: userId,
    p_connection_id: connectionId,
    p_lease_id: leaseId,
  });
  if (claimError) {
    console.error("[calendar-integrations] sync lease claim failed", { code: claimError.code });
    throw new ExternalCalendarServiceError("generic");
  }
  if (!claimed) throw new ExternalCalendarServiceError("externalCalendarUnavailable");

  const { window, bounds } = snapshotWindow();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_WORK_TIMEOUT_MS);
  try {
    const accessToken = await validAccessToken(userId, connection, leaseId, controller.signal);
    const providerEvents = await getCalendarProvider(connection.provider).listEvents(
      accessToken,
      connection.external_calendar_id || "primary",
      window,
      controller.signal,
    );
    if (providerEvents.length > MAX_SNAPSHOT_EVENTS) {
      throw new ExternalCalendarServiceError("calendarSyncFailed");
    }
    const seenExternalIds = new Set<string>();
    let projectionCount = 0;
    const events = providerEvents.map((event) => {
      if (seenExternalIds.has(event.externalId)) {
        throw new ExternalCalendarServiceError("calendarSyncFailed");
      }
      seenExternalIds.add(event.externalId);
      const snapshot = snapshotPayload(event, bounds);
      projectionCount += snapshot.projections.length;
      if (projectionCount > MAX_SNAPSHOT_PROJECTIONS) {
        throw new ExternalCalendarServiceError("calendarSyncFailed");
      }
      return snapshot;
    });

    const { data, error } = await admin.rpc("apply_external_calendar_snapshot", {
      p_user_id: userId,
      p_connection_id: connectionId,
      p_lease_id: leaseId,
      p_sync_id: randomUUID(),
      p_window_start: window.start,
      p_window_end: window.end,
      p_projection_start: bounds.startDate,
      p_projection_end: bounds.endDateExclusive,
      p_events: events as unknown as Json,
    });
    if (error) {
      console.error("[calendar-integrations] snapshot transaction failed", { code: error.code });
      throw error;
    }
    if (typeof data !== "number") throw new ExternalCalendarServiceError("calendarSyncFailed");
    return data;
  } catch (error) {
    const code = syncErrorCode(error);
    const { error: finishError } = await admin.rpc("finish_external_calendar_sync_error", {
      p_user_id: userId,
      p_connection_id: connectionId,
      p_lease_id: leaseId,
      p_error_code: code,
    });
    if (finishError) {
      console.error("[calendar-integrations] sync failure state could not be saved", {
        code: finishError.code,
      });
    }
    if (error instanceof ExternalCalendarServiceError) throw error;
    if (isCalendarProviderFailure(error)) {
      throw new ExternalCalendarServiceError(
        error.code === "conflict"
          ? "externalCalendarConflict"
          : error.code === "unauthorized" ||
              error.code === "forbidden" ||
              error.code === "not_found"
            ? "externalCalendarUnavailable"
            : "calendarSyncFailed",
      );
    }
    if (safeDbError(error as { message?: string }) === "calendar_sync_lease_lost") {
      throw new ExternalCalendarServiceError("externalCalendarUnavailable");
    }
    throw new ExternalCalendarServiceError("calendarSyncFailed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function disconnectExternalCalendar(
  userId: string,
  connectionId: string,
): Promise<void> {
  await loadOwnedConnection(userId, connectionId);
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("disconnect_external_calendar_connection", {
    p_user_id: userId,
    p_connection_id: connectionId,
  });
  if (error) {
    console.error("[calendar-integrations] disconnect failed", { code: error.code });
    throw new ExternalCalendarServiceError("generic");
  }
  if (!data) throw new ExternalCalendarServiceError("notFound");
}

function sourceValue(source: ExternalSource): CalendarEventValue {
  const start = source.all_day
    ? source.start_date
    : source.start_at
      ? new Date(source.start_at).toISOString()
      : null;
  const end = source.all_day
    ? source.end_date
    : source.end_at
      ? new Date(source.end_at).toISOString()
      : null;
  if (!start || !end) throw new ExternalCalendarServiceError("calendarSyncFailed");
  return {
    title: source.title,
    start,
    end,
    allDay: source.all_day,
    blocksTime: source.blocks_time,
  };
}

function validateOperationValue(
  value: CalendarEventValue,
  options: { allowStoredTitle: boolean },
): CalendarEventValue {
  if (
    !value ||
    typeof value.title !== "string" ||
    (options.allowStoredTitle
      ? value.title.length > 16_384
      : !value.title.trim() || value.title.length > 200)
  ) {
    throw new ExternalCalendarServiceError("validation");
  }
  try {
    const validated = validateCalendarEventValue("google", value, {
      preserveSourceTitle: options.allowStoredTitle,
    });
    eventProjectionBounds(validated);
    return validated;
  } catch {
    throw new ExternalCalendarServiceError("validation");
  }
}

function operationStatus(value: unknown): OperationStatus | null {
  return value === "queued" ||
    value === "pending" ||
    value === "succeeded" ||
    value === "conflict" ||
    value === "unknown" ||
    value === "failed"
    ? value
    : null;
}

function resultFromOperation(value: unknown, operationId: string): ExternalCalendarOperationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExternalCalendarServiceError("generic");
  }
  const row = value as Record<string, unknown>;
  const status = operationStatus(row.status);
  if (!status) throw new ExternalCalendarServiceError("generic");
  const sourceEventId = typeof row.sourceEventId === "string" ? row.sourceEventId : undefined;
  return { operationId, status, ...(sourceEventId ? { sourceEventId } : {}) };
}

function operationErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const errorCode = (value as Record<string, unknown>).errorCode;
  return typeof errorCode === "string" ? errorCode : null;
}

function throwOperationError(errorCode: string | null): never {
  if (
    errorCode === "revision_conflict" ||
    errorCode === "provider_conflict" ||
    errorCode === "operation_mismatch"
  ) {
    throw new ExternalCalendarServiceError("externalCalendarConflict");
  }
  if (errorCode === "event_not_editable" || errorCode === "connection_unavailable") {
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }
  if (errorCode === "provider_not_found") throw new ExternalCalendarServiceError("notFound");
  throw new ExternalCalendarServiceError("generic");
}

async function loadSource(
  userId: string,
  connectionId: string,
  sourceEventId: string,
): Promise<ExternalSource> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("external_calendar_event_sources")
    .select("*")
    .eq("id", sourceEventId)
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) {
    console.error("[calendar-integrations] source read failed", { code: error.code });
    throw new ExternalCalendarServiceError("generic");
  }
  if (!data) throw new ExternalCalendarServiceError("notFound");
  return data;
}

async function loadOperation(
  userId: string,
  connectionId: string,
  operationId: string,
): Promise<CalendarOperation | null> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("external_calendar_operations")
    .select("*")
    .eq("operation_id", operationId)
    .eq("user_id", userId)
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) {
    console.error("[calendar-integrations] operation read failed", { code: error.code });
    throw new ExternalCalendarServiceError("generic");
  }
  return data;
}

function jsonRecord(value: Json): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExternalCalendarServiceError("generic");
  }
  return value as Record<string, unknown>;
}

function jsonValue(value: unknown): Json {
  return value as Json;
}

function changedFieldsFromPatch(
  patch: Partial<CalendarEventValue>,
): CalendarProviderEventChangedField[] {
  const fields: CalendarProviderEventChangedField[] = [];
  if (Object.hasOwn(patch, "title")) fields.push("title");
  if (
    Object.hasOwn(patch, "start") ||
    Object.hasOwn(patch, "end") ||
    Object.hasOwn(patch, "allDay")
  ) {
    fields.push("time");
  }
  if (Object.hasOwn(patch, "blocksTime")) fields.push("blocksTime");
  return fields;
}

async function finishOperation(input: {
  userId: string;
  connectionId: string;
  operationId: string;
  leaseId: string;
  status: "succeeded" | "conflict" | "unknown" | "failed";
  errorCode: string | null;
  event?: CalendarProviderEvent;
}): Promise<ExternalCalendarOperationResult> {
  const admin = createAdminSupabase();
  const bounds = input.event ? eventProjectionBounds(input.event) : snapshotWindow().bounds;
  const providerEvent = input.event ? snapshotPayload(input.event, bounds) : null;
  const { data, error } = await admin.rpc("finish_external_calendar_operation", {
    p_user_id: input.userId,
    p_connection_id: input.connectionId,
    p_operation_id: input.operationId,
    p_lease_id: input.leaseId,
    p_status: input.status,
    p_error_code: input.errorCode,
    p_provider_event: providerEvent as unknown as Json | null,
    p_projection_start: bounds.startDate,
    p_projection_end: bounds.endDateExclusive,
  });
  if (error) {
    console.error("[calendar-integrations] operation result could not be saved", {
      code: error.code,
    });
    throw new ExternalCalendarServiceError("externalCalendarOutcomeUnknown");
  }
  const result = resultFromOperation(data, input.operationId);
  if (result.status === "conflict")
    throw new ExternalCalendarServiceError("externalCalendarConflict");
  return result;
}

function operationPayloadValue(payload: Json): CalendarEventValue {
  const row = jsonRecord(payload);
  const value = row.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExternalCalendarServiceError("generic");
  }
  return validateOperationValue(value as CalendarEventValue, { allowStoredTitle: true });
}

async function reconcileOperation(input: {
  userId: string;
  connection: CalendarConnection & { provider: CalendarProviderName };
  operation: CalendarOperation;
  claim: Record<string, unknown>;
  leaseId: string;
  signal: AbortSignal;
}): Promise<ExternalCalendarOperationResult> {
  const { userId, connection, operation, claim, leaseId, signal } = input;
  const provider = getCalendarProvider(connection.provider);
  const value =
    operation.operation_kind === "delete" ? null : operationPayloadValue(operation.request_payload);
  const calendarId =
    typeof claim.calendarId === "string"
      ? claim.calendarId
      : connection.external_calendar_id || "primary";
  const accessToken = await validAccessToken(userId, connection, leaseId, signal);
  let event: CalendarProviderEvent | null = null;

  if (operation.operation_kind === "create") {
    if (!value) throw new ExternalCalendarServiceError("generic");
    const window = providerReadbackWindow(value);
    const matches = (await provider.listEvents(accessToken, calendarId, window, signal)).filter(
      (candidate) => candidate.operationId === operation.operation_id,
    );
    if (matches.length === 1) event = matches[0];
    if (matches.length > 1) {
      return finishOperation({
        userId,
        connectionId: connection.id,
        operationId: operation.operation_id,
        leaseId,
        status: "conflict",
        errorCode: "provider_conflict",
      });
    }
    if (!event) {
      return finishOperation({
        userId,
        connectionId: connection.id,
        operationId: operation.operation_id,
        leaseId,
        status: "unknown",
        errorCode: "response_unknown",
      });
    }
  } else {
    const externalId = typeof claim.externalEventId === "string" ? claim.externalEventId : null;
    if (!externalId) throw new ExternalCalendarServiceError("generic");
    event = await provider.getEvent(accessToken, calendarId, externalId, signal);
    if (operation.operation_kind === "delete") {
      if (!event) {
        return finishOperation({
          userId,
          connectionId: connection.id,
          operationId: operation.operation_id,
          leaseId,
          status: "succeeded",
          errorCode: null,
        });
      }
      const expectedEtag = typeof claim.etag === "string" ? claim.etag : null;
      return finishOperation({
        userId,
        connectionId: connection.id,
        operationId: operation.operation_id,
        leaseId,
        status: event.etag && expectedEtag && event.etag !== expectedEtag ? "conflict" : "unknown",
        errorCode:
          event.etag && expectedEtag && event.etag !== expectedEtag
            ? "provider_conflict"
            : "response_unknown",
      });
    }
    if (!event || !value) {
      return finishOperation({
        userId,
        connectionId: connection.id,
        operationId: operation.operation_id,
        leaseId,
        status: "conflict",
        errorCode: "provider_not_found",
      });
    }
    const matchesDesired =
      event.title === value.title &&
      event.start === value.start &&
      event.end === value.end &&
      event.allDay === value.allDay &&
      event.blocksTime === value.blocksTime;
    if (matchesDesired) {
      return finishOperation({
        userId,
        connectionId: connection.id,
        operationId: operation.operation_id,
        leaseId,
        status: "succeeded",
        errorCode: null,
        event,
      });
    }
    const expectedEtag = typeof claim.etag === "string" ? claim.etag : null;
    const changedRemotely = Boolean(event.etag && expectedEtag && event.etag !== expectedEtag);
    return finishOperation({
      userId,
      connectionId: connection.id,
      operationId: operation.operation_id,
      leaseId,
      status: changedRemotely ? "conflict" : "unknown",
      errorCode: changedRemotely ? "provider_conflict" : "response_unknown",
    });
  }

  if (
    !value ||
    event.title !== value.title ||
    event.start !== value.start ||
    event.end !== value.end ||
    event.allDay !== value.allDay ||
    event.blocksTime !== value.blocksTime
  ) {
    return finishOperation({
      userId,
      connectionId: connection.id,
      operationId: operation.operation_id,
      leaseId,
      status: "unknown",
      errorCode: "response_unknown",
    });
  }
  return finishOperation({
    userId,
    connectionId: connection.id,
    operationId: operation.operation_id,
    leaseId,
    status: "succeeded",
    errorCode: null,
    event,
  });
}

async function performExternalCalendarOperation(input: {
  userId: string;
  connectionId: string;
  operationId: string;
  kind: "create" | "update" | "delete";
  sourceEventId: string | null;
  expectedRevision: string | null;
  payload: Json;
  payloadHash: string;
}): Promise<ExternalCalendarOperationResult> {
  const connection = await loadOwnedConnection(input.userId, input.connectionId, { active: true });
  if (!connection.can_write) throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  const priorOperation = await loadOperation(input.userId, input.connectionId, input.operationId);
  const leaseId = randomUUID();
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("claim_external_calendar_operation", {
    p_user_id: input.userId,
    p_connection_id: input.connectionId,
    p_operation_id: input.operationId,
    p_operation_kind: input.kind,
    p_source_event_id: input.sourceEventId,
    p_expected_revision: input.expectedRevision,
    p_request_payload: input.payload,
    p_payload_hash: input.payloadHash,
    p_lease_id: leaseId,
  });
  if (error) {
    const dbError = safeDbError(error);
    if (dbError === "calendar_operation_invalid")
      throw new ExternalCalendarServiceError("validation");
    console.error("[calendar-integrations] operation claim failed", { code: error.code });
    throw new ExternalCalendarServiceError("generic");
  }
  const claim =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const status = claim.status;
  if (status === "unavailable") throwOperationError(operationErrorCode(claim));
  if (status === "notFound") throw new ExternalCalendarServiceError("notFound");
  if (status === "conflict") {
    return resultFromOperation(claim, input.operationId);
  }
  if (status === "succeeded" || status === "failed") {
    return resultFromOperation(claim, input.operationId);
  }
  if (status === "queued") {
    const priorStatus = priorOperation?.status;
    if (priorStatus === "pending" || priorStatus === "unknown") {
      return {
        operationId: input.operationId,
        status: priorStatus,
        ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
      };
    }
    return {
      operationId: input.operationId,
      status: "queued",
      ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
    };
  }
  if (status !== "ready") throw new ExternalCalendarServiceError("generic");

  const operation = await loadOperation(input.userId, input.connectionId, input.operationId);
  if (!operation) throw new ExternalCalendarServiceError("generic");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_WORK_TIMEOUT_MS);
  if (claim.reconcile === true) {
    try {
      return await reconcileOperation({
        userId: input.userId,
        connection,
        operation,
        claim,
        leaseId,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof ExternalCalendarServiceError) throw error;
      return finalizeProviderFailure({
        userId: input.userId,
        connection,
        operation,
        leaseId,
        error,
        requestWasSent: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    return await dispatchOperation({
      userId: input.userId,
      connection,
      operation,
      claim,
      leaseId,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function finalizeProviderFailure(input: {
  userId: string;
  connection: CalendarConnection & { provider: CalendarProviderName };
  operation: CalendarOperation;
  leaseId: string;
  error: unknown;
  requestWasSent: boolean;
}): Promise<ExternalCalendarOperationResult> {
  const providerFailureCode = isCalendarProviderFailure(input.error) ? input.error.code : null;
  const ambiguous =
    input.requestWasSent &&
    (!isCalendarProviderFailure(input.error) || input.error.writeOutcome !== "rejected");
  const status = ambiguous ? "unknown" : providerFailureCode === "conflict" ? "conflict" : "failed";
  const errorCode = ambiguous
    ? "response_unknown"
    : providerFailureCode === "conflict"
      ? "provider_conflict"
      : providerFailureCode === "forbidden"
        ? "provider_forbidden"
        : providerFailureCode === "unauthorized"
          ? "provider_unauthorized"
          : providerFailureCode === "not_found"
            ? "provider_not_found"
            : providerFailureCode === "rate_limited"
              ? "provider_rate_limited"
              : providerFailureCode === "timeout"
                ? "provider_timeout"
                : providerFailureCode === "configuration"
                  ? "configuration"
                  : providerFailureCode === "invalid_response"
                    ? "invalid_response"
                    : "provider_request_failed";
  const result = await finishOperation({
    userId: input.userId,
    connectionId: input.connection.id,
    operationId: input.operation.operation_id,
    leaseId: input.leaseId,
    status,
    errorCode,
  });
  if (result.status === "unknown")
    throw new ExternalCalendarServiceError("externalCalendarOutcomeUnknown");
  if (result.status === "conflict")
    throw new ExternalCalendarServiceError("externalCalendarConflict");
  if (input.error instanceof ExternalCalendarServiceError) throw input.error;
  if (
    providerFailureCode === "configuration" ||
    providerFailureCode === "unauthorized" ||
    providerFailureCode === "forbidden"
  ) {
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }
  return result;
}

async function dispatchOperation(input: {
  userId: string;
  connection: CalendarConnection & { provider: CalendarProviderName };
  operation: CalendarOperation;
  claim: Record<string, unknown>;
  leaseId: string;
  signal: AbortSignal;
}): Promise<ExternalCalendarOperationResult> {
  const { userId, connection, operation, claim, leaseId, signal } = input;
  let accessToken: string;
  try {
    accessToken = await validAccessToken(userId, connection, leaseId, signal);
  } catch (error) {
    return finalizeProviderFailure({
      userId,
      connection,
      operation,
      leaseId,
      error,
      requestWasSent: false,
    });
  }

  const provider = getCalendarProvider(connection.provider);
  const request = jsonRecord(operation.request_payload);
  const value =
    operation.operation_kind === "delete" ? null : operationPayloadValue(operation.request_payload);
  const calendarId =
    typeof claim.calendarId === "string"
      ? claim.calendarId
      : connection.external_calendar_id || "primary";
  let providerRequestStarted = false;
  try {
    let event: CalendarProviderEvent | undefined;
    if (operation.operation_kind === "create") {
      if (!value) throw new ExternalCalendarServiceError("validation");
      providerRequestStarted = true;
      event = await provider.createEvent(
        accessToken,
        calendarId,
        operation.operation_id,
        value,
        signal,
      );
    } else if (operation.operation_kind === "update") {
      if (!value) throw new ExternalCalendarServiceError("validation");
      const externalId = typeof claim.externalEventId === "string" ? claim.externalEventId : null;
      const etag = typeof claim.etag === "string" ? claim.etag : null;
      const fields = Array.isArray(request.changedFields)
        ? request.changedFields.filter(
            (field): field is CalendarProviderEventChangedField =>
              field === "title" || field === "time" || field === "blocksTime",
          )
        : [];
      if (!externalId || !etag || fields.length === 0)
        throw new ExternalCalendarServiceError("externalCalendarUnavailable");
      providerRequestStarted = true;
      event = await provider.patchEvent(
        accessToken,
        calendarId,
        externalId,
        etag,
        value,
        fields,
        signal,
      );
    } else {
      const externalId = typeof claim.externalEventId === "string" ? claim.externalEventId : null;
      const etag = typeof claim.etag === "string" ? claim.etag : null;
      if (!externalId || !etag)
        throw new ExternalCalendarServiceError("externalCalendarUnavailable");
      providerRequestStarted = true;
      await provider.deleteEvent(accessToken, calendarId, externalId, etag, signal);
    }

    return finishOperation({
      userId,
      connectionId: connection.id,
      operationId: operation.operation_id,
      leaseId,
      status: "succeeded",
      errorCode: null,
      event,
    });
  } catch (error) {
    if (providerRequestStarted && error instanceof ExternalCalendarServiceError) throw error;
    return finalizeProviderFailure({
      userId,
      connection,
      operation,
      leaseId,
      error,
      requestWasSent: providerRequestStarted,
    });
  }
}

export async function createExternalCalendarEvent(input: {
  userId: string;
  connectionId: string;
  operationId: string;
  value: CalendarEventValue;
}): Promise<ExternalCalendarOperationResult> {
  const value = validateOperationValue(input.value, { allowStoredTitle: false });
  const payload = { value };
  const payloadHash = hashValue({ kind: "create", payload });
  return performExternalCalendarOperation({
    userId: input.userId,
    connectionId: input.connectionId,
    operationId: input.operationId,
    kind: "create",
    sourceEventId: null,
    expectedRevision: null,
    payload: jsonValue(payload),
    payloadHash,
  });
}

export async function updateExternalCalendarEvent(input: {
  userId: string;
  connectionId: string;
  operationId: string;
  sourceEventId: string;
  expectedRevision: string;
  patch: Partial<CalendarEventValue>;
}): Promise<ExternalCalendarOperationResult> {
  const connection = await loadOwnedConnection(input.userId, input.connectionId, { active: true });
  if (!connection.can_write) throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  const source = await loadSource(input.userId, input.connectionId, input.sourceEventId);
  if (source.event_kind === "series" || !source.etag) {
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }
  const fields = changedFieldsFromPatch(input.patch);
  if (fields.length === 0) throw new ExternalCalendarServiceError("validation");
  const storedValue = sourceValue(source);
  const merged = { ...storedValue, ...input.patch };
  if (Object.hasOwn(input.patch, "title") && typeof input.patch.title === "string") {
    merged.title = input.patch.title.trim();
  }
  const value = validateOperationValue(merged, {
    allowStoredTitle: !Object.hasOwn(input.patch, "title"),
  });
  const payload = { value, changedFields: fields, expectedRevision: input.expectedRevision };
  const payloadHash = hashValue({
    kind: "update",
    sourceEventId: input.sourceEventId,
    expectedRevision: input.expectedRevision,
    payload,
  });
  return performExternalCalendarOperation({
    userId: input.userId,
    connectionId: input.connectionId,
    operationId: input.operationId,
    kind: "update",
    sourceEventId: input.sourceEventId,
    expectedRevision: input.expectedRevision,
    payload: jsonValue(payload),
    payloadHash,
  });
}

export async function deleteExternalCalendarEvent(input: {
  userId: string;
  connectionId: string;
  operationId: string;
  sourceEventId: string;
  expectedRevision: string;
}): Promise<ExternalCalendarOperationResult> {
  const connection = await loadOwnedConnection(input.userId, input.connectionId, { active: true });
  if (!connection.can_write) throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  const source = await loadSource(input.userId, input.connectionId, input.sourceEventId);
  if (source.event_kind === "series" || !source.etag) {
    throw new ExternalCalendarServiceError("externalCalendarUnavailable");
  }
  const payload = { expectedRevision: input.expectedRevision };
  const payloadHash = hashValue({
    kind: "delete",
    sourceEventId: input.sourceEventId,
    expectedRevision: input.expectedRevision,
    payload,
  });
  return performExternalCalendarOperation({
    userId: input.userId,
    connectionId: input.connectionId,
    operationId: input.operationId,
    kind: "delete",
    sourceEventId: input.sourceEventId,
    expectedRevision: input.expectedRevision,
    payload: jsonValue(payload),
    payloadHash,
  });
}

export async function reconcileExternalCalendarOperation(input: {
  userId: string;
  connectionId: string;
  operationId: string;
}): Promise<ExternalCalendarOperationResult> {
  const operation = await loadOperation(input.userId, input.connectionId, input.operationId);
  if (!operation) throw new ExternalCalendarServiceError("notFound");
  if (operation.status === "succeeded") {
    return {
      operationId: operation.operation_id,
      status: "succeeded",
      ...(operation.source_event_id ? { sourceEventId: operation.source_event_id } : {}),
    };
  }
  if (operation.status === "failed")
    return { operationId: operation.operation_id, status: "failed" };
  if (operation.status === "conflict")
    return { operationId: operation.operation_id, status: "conflict" };

  const payload = operation.request_payload;
  const expectedRevision = (() => {
    const row = jsonRecord(payload);
    return typeof row.expectedRevision === "string" ? row.expectedRevision : null;
  })();
  return performExternalCalendarOperation({
    userId: input.userId,
    connectionId: input.connectionId,
    operationId: operation.operation_id,
    kind: operation.operation_kind as "create" | "update" | "delete",
    sourceEventId: operation.source_event_id,
    expectedRevision,
    payload,
    payloadHash: operation.payload_hash,
  });
}

export async function loadExternalCalendarEvent(input: {
  userId: string;
  connectionId: string;
  sourceEventId: string;
}): Promise<ExternalCalendarEventDetail> {
  const connection = await loadOwnedConnection(input.userId, input.connectionId);
  const source = await loadSource(input.userId, input.connectionId, input.sourceEventId);
  const value = sourceValue(source);
  return {
    sourceEventId: source.id,
    connectionId: connection.id,
    provider: connection.provider,
    providerLabel: connection.account_label,
    value,
    kind: source.event_kind as CalendarProviderEvent["kind"],
    revision: source.revision,
    editable:
      connection.status === "active" &&
      connection.can_write &&
      Boolean(source.etag) &&
      source.event_kind !== "series",
  };
}

export async function listExternalCalendarEventDetails(
  userId: string,
  sourceEventIds: string[],
): Promise<ExternalCalendarEventDetail[]> {
  const sourceIds = [...new Set(sourceEventIds)].slice(0, 100);
  if (sourceIds.length === 0) return [];
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("external_calendar_event_sources")
    .select(
      "id, user_id, connection_id, title, all_day, start_date, end_date, start_at, end_at, blocks_time, event_kind, etag, revision, connection:external_calendar_connections!inner(provider, account_label, status, can_write)",
    )
    .eq("user_id", userId)
    .in("id", sourceIds);
  if (error) {
    console.error("[calendar-integrations] event detail read failed", { code: error.code });
    throw new ExternalCalendarServiceError("generic");
  }
  return (data ?? []).flatMap((row) => {
    const connection = Array.isArray(row.connection) ? row.connection[0] : row.connection;
    if (!connection || !isProviderName(connection.provider)) return [];
    const start = row.all_day
      ? row.start_date
      : row.start_at
        ? new Date(row.start_at).toISOString()
        : null;
    const end = row.all_day ? row.end_date : row.end_at ? new Date(row.end_at).toISOString() : null;
    if (!start || !end) return [];
    return [
      {
        sourceEventId: row.id,
        connectionId: row.connection_id,
        provider: connection.provider,
        providerLabel: connection.account_label,
        value: {
          title: row.title,
          start,
          end,
          allDay: row.all_day,
          blocksTime: row.blocks_time,
        },
        kind: row.event_kind as CalendarProviderEvent["kind"],
        revision: row.revision,
        editable:
          connection.status === "active" &&
          connection.can_write &&
          Boolean(row.etag) &&
          row.event_kind !== "series",
      },
    ];
  });
}
