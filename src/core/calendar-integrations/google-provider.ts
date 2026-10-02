import "server-only";

import { formatInTimeZone, getTimezoneOffset } from "date-fns-tz";

import { getGoogleCalendarEnv } from "@/lib/env.server";

import type {
  CalendarEventValue,
  CalendarEventWindow,
  CalendarProviderAccount,
  CalendarProviderAdapter,
  CalendarProviderEvent,
  CalendarProviderEventChangedField,
  CalendarProviderTokens,
} from "./provider";
import {
  isCalendarProviderFailure,
  providerFailure,
  requireDateOnly,
  requireExplicitInstant,
  requireNonEmptyString,
  requireOperationId,
  requireRecord,
  requireSafePathValue,
  requireWriteEtag,
  requestProviderJson,
  requestProviderNoContent,
  unknownWriteFailure,
  validateCalendarEventValue,
  validateCalendarWindow,
} from "./provider-http";

const PROVIDER = "google" as const;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const API_ROOT = "https://www.googleapis.com/calendar/v3";
const MAX_PAGES = 50;
const MAX_EVENTS = 20_000;
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

type GoogleDateTime = { date?: unknown; dateTime?: unknown; timeZone?: unknown };

function googleEnv() {
  try {
    return getGoogleCalendarEnv();
  } catch {
    throw providerFailure(PROVIDER, "configuration");
  }
}

function requireOauthState(state: string): string {
  if (typeof state !== "string" || state.length < 16 || state.length > 256) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  return state;
}

function requirePkceChallenge(challenge: string): string {
  if (typeof challenge !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  return challenge;
}

function requirePkceVerifier(verifier: string): string {
  if (typeof verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  return verifier;
}

function formBody(values: Record<string, string>): URLSearchParams {
  return new URLSearchParams(values);
}

function parseTokenPayload(
  value: unknown,
  options: { requireRefreshToken?: boolean; assumeRequestedScopes?: boolean } = {},
): CalendarProviderTokens {
  const body = requireRecord(PROVIDER, value);
  const accessToken = requireNonEmptyString(PROVIDER, body.access_token);
  const expiresIn = body.expires_in;
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  const refreshToken =
    typeof body.refresh_token === "string" && body.refresh_token.length > 0
      ? body.refresh_token
      : undefined;
  if (options.requireRefreshToken && !refreshToken) {
    throw providerFailure(PROVIDER, "invalid_response");
  }

  const scopeValue =
    typeof body.scope === "string"
      ? body.scope
      : options.assumeRequestedScopes
        ? GOOGLE_SCOPES.join(" ")
        : "";
  const scopes = scopeValue.split(/\s+/).filter(Boolean);
  return {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    ...(refreshToken ? { refreshToken } : {}),
    scopes,
  };
}

function tokenRequestBody(values: Record<string, string>): URLSearchParams {
  return formBody(values);
}

function localDateTimeToInstant(value: string, timeZone: string): string {
  const provider = PROVIDER;
  const local = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!local || !timeZone) throw providerFailure(provider, "invalid_response");

  const seconds = local[3] ?? "00";
  const milliseconds = (local[4] ?? "").padEnd(3, "0");
  const canonical = `${local[1]}T${local[2]}:${seconds}.${milliseconds}`;
  const wallClockAsUtc = new Date(`${canonical}Z`);
  if (!Number.isFinite(wallClockAsUtc.getTime())) {
    throw providerFailure(provider, "invalid_response");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(wallClockAsUtc);
  } catch {
    throw providerFailure(provider, "invalid_response");
  }

  // A timeZone without an offset is usable only when it identifies one exact
  // instant. This rejects nonexistent and repeated wall-clock times at DST changes.
  const sampleOffsets = [-36, -24, 0, 24, 36].map((hours) =>
    getTimezoneOffset(timeZone, new Date(wallClockAsUtc.getTime() + hours * 60 * 60 * 1000)),
  );
  const matchingInstants = new Set<number>();
  for (const offset of sampleOffsets) {
    const candidate = wallClockAsUtc.getTime() - offset;
    try {
      if (formatInTimeZone(candidate, timeZone, "yyyy-MM-dd'T'HH:mm:ss.SSS") === canonical) {
        matchingInstants.add(candidate);
      }
    } catch {
      throw providerFailure(provider, "invalid_response");
    }
  }
  if (matchingInstants.size !== 1) throw providerFailure(provider, "invalid_response");
  return new Date([...matchingInstants][0]).toISOString();
}

function googleDateTimeToInstant(value: unknown, timeZone: unknown): string {
  if (typeof value !== "string") throw providerFailure(PROVIDER, "invalid_response");
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return requireExplicitInstant(PROVIDER, value);
  if (typeof timeZone !== "string") throw providerFailure(PROVIDER, "invalid_response");
  return localDateTimeToInstant(value, timeZone);
}

function mapGoogleDate(
  startValue: unknown,
  endValue: unknown,
): { start: string; end: string; allDay: boolean } {
  const start = requireRecord(PROVIDER, startValue) as GoogleDateTime;
  const end = requireRecord(PROVIDER, endValue) as GoogleDateTime;
  if (typeof start.date === "string" || typeof end.date === "string") {
    if (typeof start.date !== "string" || typeof end.date !== "string") {
      throw providerFailure(PROVIDER, "invalid_response");
    }
    const allDayStart = requireDateOnly(PROVIDER, start.date);
    const allDayEnd = requireDateOnly(PROVIDER, end.date);
    if (allDayEnd <= allDayStart) throw providerFailure(PROVIDER, "invalid_response");
    return {
      start: allDayStart,
      end: allDayEnd,
      allDay: true,
    };
  }

  const normalizedStart = googleDateTimeToInstant(start.dateTime, start.timeZone);
  const normalizedEnd = googleDateTimeToInstant(end.dateTime, end.timeZone);
  if (Date.parse(normalizedEnd) <= Date.parse(normalizedStart)) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  return { start: normalizedStart, end: normalizedEnd, allDay: false };
}

function mapGoogleEvent(value: unknown): CalendarProviderEvent | null {
  const event = requireRecord(PROVIDER, value);
  const id = requireNonEmptyString(PROVIDER, event.id);
  if (event.status === "cancelled") return null;

  const startValue = event.start;
  const endValue = event.end;
  const { start, end, allDay } = mapGoogleDate(startValue, endValue);
  const title = typeof event.summary === "string" ? event.summary : "";
  const extended = event.extendedProperties;
  const privateProperties =
    typeof extended === "object" && extended !== null && !Array.isArray(extended)
      ? (extended as Record<string, unknown>).private
      : null;
  const operationId =
    typeof privateProperties === "object" &&
    privateProperties !== null &&
    !Array.isArray(privateProperties)
      ? (privateProperties as Record<string, unknown>).kemtitOperationId
      : null;

  return {
    externalId: id,
    title,
    start,
    end,
    allDay,
    blocksTime: event.transparency !== "transparent",
    etag: typeof event.etag === "string" && event.etag.length > 0 ? event.etag : null,
    operationId: typeof operationId === "string" && operationId.length > 0 ? operationId : null,
    kind:
      typeof event.recurringEventId === "string"
        ? "occurrence"
        : Array.isArray(event.recurrence) && event.recurrence.length > 0
          ? "series"
          : "single",
  };
}

function requireEtag(provider: "google", value: string): string {
  return requireWriteEtag(provider, value);
}

function eventPath(calendarId: string, externalId?: string): string {
  const safeCalendarId = requireSafePathValue(PROVIDER, calendarId);
  const base = `${API_ROOT}/calendars/${encodeURIComponent(safeCalendarId)}/events`;
  return externalId === undefined
    ? base
    : `${base}/${encodeURIComponent(requireSafePathValue(PROVIDER, externalId))}`;
}

function eventValueBody(
  value: CalendarEventValue,
  options: {
    preserveSourceTitle?: boolean;
    changedFields?: readonly CalendarProviderEventChangedField[];
  } = {},
): Record<string, unknown> {
  const event = validateCalendarEventValue(PROVIDER, value, options);
  const fields = options.changedFields ?? ["title", "time", "blocksTime"];
  if (
    fields.length === 0 ||
    fields.some((field) => !["title", "time", "blocksTime"].includes(field))
  ) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  const body: Record<string, unknown> = {};
  if (fields.includes("title")) body.summary = event.title;
  if (fields.includes("time")) {
    body.start = event.allDay ? { date: event.start } : { dateTime: event.start };
    body.end = event.allDay ? { date: event.end } : { dateTime: event.end };
  }
  if (fields.includes("blocksTime"))
    body.transparency = event.blocksTime ? "opaque" : "transparent";
  return body;
}

function mapWriteResult(value: unknown): CalendarProviderEvent {
  try {
    const event = mapGoogleEvent(value);
    if (!event) throw providerFailure(PROVIDER, "invalid_response");
    return event;
  } catch (error) {
    throw unknownWriteFailure(PROVIDER, error);
  }
}

async function listEvents(
  accessToken: string,
  calendarId: string,
  window: CalendarEventWindow,
  signal?: AbortSignal,
): Promise<CalendarProviderEvent[]> {
  const bounds = validateCalendarWindow(PROVIDER, window);
  const baseUrl = new URL(eventPath(calendarId));
  baseUrl.searchParams.set("singleEvents", "true");
  baseUrl.searchParams.set("showDeleted", "false");
  baseUrl.searchParams.set("orderBy", "startTime");
  baseUrl.searchParams.set("maxResults", "2500");
  baseUrl.searchParams.set("timeMin", bounds.start);
  baseUrl.searchParams.set("timeMax", bounds.end);

  const events: CalendarProviderEvent[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(baseUrl);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const body = requireRecord(
      PROVIDER,
      await requestProviderJson({
        provider: PROVIDER,
        url,
        signal,
        init: {
          headers: { authorization: `Bearer ${requireNonEmptyString(PROVIDER, accessToken)}` },
        },
      }),
    );
    const hasCompleteEmptyEnvelope =
      body.items === undefined &&
      body.kind === "calendar#events" &&
      typeof body.etag === "string" &&
      body.etag.length > 0 &&
      ((typeof body.nextSyncToken === "string" && body.nextSyncToken.length > 0) ||
        (typeof body.nextPageToken === "string" && body.nextPageToken.length > 0));
    if (!Array.isArray(body.items) && !hasCompleteEmptyEnvelope) {
      throw providerFailure(PROVIDER, "invalid_response");
    }

    const pageItems = Array.isArray(body.items) ? body.items : [];
    for (const rawEvent of pageItems as unknown[]) {
      const event = mapGoogleEvent(rawEvent);
      if (event) events.push(event);
      if (events.length > MAX_EVENTS) throw providerFailure(PROVIDER, "invalid_response");
    }

    const nextPageToken = body.nextPageToken;
    if (nextPageToken === undefined || nextPageToken === null || nextPageToken === "") {
      return events;
    }
    if (
      typeof nextPageToken !== "string" ||
      nextPageToken.length > 4096 ||
      seenTokens.has(nextPageToken)
    ) {
      throw providerFailure(PROVIDER, "invalid_response");
    }
    seenTokens.add(nextPageToken);
    pageToken = nextPageToken;
  }

  throw providerFailure(PROVIDER, "invalid_response");
}

export const googleCalendarProvider: CalendarProviderAdapter = {
  provider: PROVIDER,

  buildAuthorizationUrl(state, codeChallenge) {
    const env = googleEnv();
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", env.clientId);
    url.searchParams.set("redirect_uri", env.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", requireOauthState(state));
    url.searchParams.set("code_challenge", requirePkceChallenge(codeChallenge));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },

  async exchangeCode(code, verifier, signal) {
    const env = googleEnv();
    const body = tokenRequestBody({
      code: requireNonEmptyString(PROVIDER, code),
      code_verifier: requirePkceVerifier(verifier),
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: env.redirectUri,
      grant_type: "authorization_code",
    });
    const result = await requestProviderJson({
      provider: PROVIDER,
      url: TOKEN_URL,
      signal,
      init: {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      },
    });
    return parseTokenPayload(result, { assumeRequestedScopes: true });
  },

  async refreshTokens(refreshToken, signal) {
    const env = googleEnv();
    const body = tokenRequestBody({
      refresh_token: requireNonEmptyString(PROVIDER, refreshToken),
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: "refresh_token",
    });
    const result = await requestProviderJson({
      provider: PROVIDER,
      url: TOKEN_URL,
      signal,
      init: {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      },
    });
    return parseTokenPayload(result);
  },

  async getAccount(accessToken, signal): Promise<CalendarProviderAccount> {
    const body = requireRecord(
      PROVIDER,
      await requestProviderJson({
        provider: PROVIDER,
        url: USERINFO_URL,
        signal,
        init: {
          headers: { authorization: `Bearer ${requireNonEmptyString(PROVIDER, accessToken)}` },
        },
      }),
    );
    return {
      providerAccountId: requireNonEmptyString(PROVIDER, body.sub),
      label: typeof body.email === "string" && body.email.length > 0 ? body.email : null,
    };
  },

  listEvents,

  async getEvent(accessToken, calendarId, externalId, signal) {
    try {
      const body = await requestProviderJson({
        provider: PROVIDER,
        url: eventPath(calendarId, externalId),
        signal,
        init: {
          headers: { authorization: `Bearer ${requireNonEmptyString(PROVIDER, accessToken)}` },
        },
      });
      return mapGoogleEvent(body);
    } catch (error) {
      if (isCalendarProviderFailure(error) && error.code === "not_found") return null;
      throw error;
    }
  },

  async createEvent(accessToken, calendarId, operationId, value, signal) {
    const normalizedOperationId = requireOperationId(PROVIDER, operationId);
    const id = `k${normalizedOperationId.replaceAll("-", "")}`;
    const body = {
      ...eventValueBody(value),
      id,
      extendedProperties: { private: { kemtitOperationId: normalizedOperationId } },
    };
    const result = await requestProviderJson({
      provider: PROVIDER,
      url: eventPath(calendarId),
      signal,
      write: true,
      init: {
        method: "POST",
        headers: {
          authorization: `Bearer ${requireNonEmptyString(PROVIDER, accessToken)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    });
    return { ...mapWriteResult(result), operationId: normalizedOperationId };
  },

  async patchEvent(
    accessToken,
    calendarId,
    externalId,
    expectedEtag,
    value,
    changedFields,
    signal,
  ) {
    const body = eventValueBody(value, { preserveSourceTitle: true, changedFields });
    const result = await requestProviderJson({
      provider: PROVIDER,
      url: eventPath(calendarId, externalId),
      signal,
      write: true,
      init: {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${requireNonEmptyString(PROVIDER, accessToken)}`,
          "content-type": "application/json",
          "if-match": requireEtag(PROVIDER, expectedEtag),
        },
        body: JSON.stringify(body),
      },
    });
    return mapWriteResult(result);
  },

  async deleteEvent(accessToken, calendarId, externalId, expectedEtag, signal) {
    await requestProviderNoContent({
      provider: PROVIDER,
      url: eventPath(calendarId, externalId),
      signal,
      write: true,
      init: {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${requireNonEmptyString(PROVIDER, accessToken)}`,
          "if-match": requireEtag(PROVIDER, expectedEtag),
        },
      },
    });
  },
};
