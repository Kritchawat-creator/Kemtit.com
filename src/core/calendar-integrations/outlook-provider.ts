import "server-only";

import { getOutlookCalendarEnv } from "@/lib/env.server";

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

const PROVIDER = "outlook" as const;
const TENANT = "common";
const AUTH_ROOT = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const GRAPH_ORIGIN = "https://graph.microsoft.com";
const GRAPH_ROOT = `${GRAPH_ORIGIN}/v1.0`;
const MAX_PAGES = 50;
const MAX_EVENTS = 20_000;
const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
] as const;
const EVENT_SELECT =
  "id,subject,start,end,isAllDay,isCancelled,showAs,changeKey,type,transactionId";

function outlookEnv() {
  try {
    return getOutlookCalendarEnv();
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

function parseTokenPayload(
  value: unknown,
  options: { requireRefreshToken?: boolean; assumeRequestedScopes?: boolean } = {},
): CalendarProviderTokens {
  const body = requireRecord(PROVIDER, value);
  const accessToken = requireNonEmptyString(PROVIDER, body.access_token);
  const expiresIn = Number(body.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
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
        ? OUTLOOK_SCOPES.join(" ")
        : "";
  return {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    ...(refreshToken ? { refreshToken } : {}),
    scopes: scopeValue.split(/\s+/).filter(Boolean),
  };
}

function validateLocalDateTime(value: string): { date: string; time: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d{1,7})?$/.exec(value);
  if (!match) return null;
  const date = requireDateOnly(PROVIDER, match[1]);
  return { date, time: match[2] };
}

function outlookTimedInstant(value: unknown, timeZone: unknown): string {
  if (typeof value !== "string") throw providerFailure(PROVIDER, "invalid_response");
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return requireExplicitInstant(PROVIDER, value);
  }
  if (typeof timeZone !== "string" || timeZone.toUpperCase() !== "UTC") {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  return requireExplicitInstant(
    PROVIDER,
    `${value.replace(/\.\d{4,}$/, (fraction) => fraction.slice(0, 4))}Z`,
  );
}

function mapOutlookDate(
  startValue: unknown,
  endValue: unknown,
  isAllDay: unknown,
): { start: string; end: string; allDay: boolean } {
  const start = requireRecord(PROVIDER, startValue);
  const end = requireRecord(PROVIDER, endValue);
  if (isAllDay === true) {
    if (typeof start.dateTime !== "string" || typeof end.dateTime !== "string") {
      throw providerFailure(PROVIDER, "invalid_response");
    }
    if (
      typeof start.timeZone !== "string" ||
      start.timeZone.length === 0 ||
      start.timeZone !== end.timeZone
    ) {
      throw providerFailure(PROVIDER, "invalid_response");
    }
    const localStart = validateLocalDateTime(start.dateTime);
    const localEnd = validateLocalDateTime(end.dateTime);
    if (
      !localStart ||
      !localEnd ||
      localStart.time !== "00:00:00" ||
      localEnd.time !== "00:00:00"
    ) {
      throw providerFailure(PROVIDER, "invalid_response");
    }
    if (localEnd.date <= localStart.date) throw providerFailure(PROVIDER, "invalid_response");
    return { start: localStart.date, end: localEnd.date, allDay: true };
  }

  const normalizedStart = outlookTimedInstant(start.dateTime, start.timeZone);
  const normalizedEnd = outlookTimedInstant(end.dateTime, end.timeZone);
  if (Date.parse(normalizedEnd) <= Date.parse(normalizedStart)) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  return { start: normalizedStart, end: normalizedEnd, allDay: false };
}

function mapOutlookEvent(value: unknown): CalendarProviderEvent | null {
  const event = requireRecord(PROVIDER, value);
  const id = requireNonEmptyString(PROVIDER, event.id);
  if (event.isCancelled === true) return null;
  const { start, end, allDay } = mapOutlookDate(event.start, event.end, event.isAllDay);
  const eventType = event.type;

  return {
    externalId: id,
    title: typeof event.subject === "string" ? event.subject : "",
    start,
    end,
    allDay,
    blocksTime: event.showAs !== "free",
    etag: typeof event["@odata.etag"] === "string" ? event["@odata.etag"] : null,
    operationId: typeof event.transactionId === "string" ? event.transactionId : null,
    kind:
      eventType === "seriesMaster"
        ? "series"
        : eventType === "occurrence" || eventType === "exception"
          ? "occurrence"
          : "single",
  };
}

function calendarViewPath(calendarId: string): string {
  const safeCalendarId = requireSafePathValue(PROVIDER, calendarId);
  return safeCalendarId === "primary"
    ? `${GRAPH_ROOT}/me/calendarView`
    : `${GRAPH_ROOT}/me/calendars/${encodeURIComponent(safeCalendarId)}/calendarView`;
}

function eventCollectionPath(calendarId: string): string {
  return calendarId === "primary"
    ? `${GRAPH_ROOT}/me/events`
    : `${GRAPH_ROOT}/me/calendars/${encodeURIComponent(requireSafePathValue(PROVIDER, calendarId))}/events`;
}

function eventPath(calendarId: string, externalId: string): string {
  return `${eventCollectionPath(calendarId)}/${encodeURIComponent(requireSafePathValue(PROVIDER, externalId))}`;
}

function requireEtag(value: string): string {
  return requireWriteEtag(PROVIDER, value);
}

function dateTimeBody(value: string, allDay: boolean): Record<string, string> {
  return {
    dateTime: allDay ? `${value}T00:00:00` : value.replace(/Z$/i, ""),
    timeZone: "UTC",
  };
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
  if (fields.includes("title")) body.subject = event.title;
  if (fields.includes("time")) {
    body.start = dateTimeBody(event.start, event.allDay);
    body.end = dateTimeBody(event.end, event.allDay);
    body.isAllDay = event.allDay;
  }
  if (fields.includes("blocksTime")) body.showAs = event.blocksTime ? "busy" : "free";
  return body;
}

function mapWriteResult(value: unknown): CalendarProviderEvent {
  try {
    const event = mapOutlookEvent(value);
    if (!event) throw providerFailure(PROVIDER, "invalid_response");
    return event;
  } catch (error) {
    throw unknownWriteFailure(PROVIDER, error);
  }
}

function validateNextLink(value: unknown, expectedPath: string): URL {
  if (typeof value !== "string" || value.length > 16_384) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== GRAPH_ORIGIN ||
    url.pathname !== expectedPath ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0
  ) {
    throw providerFailure(PROVIDER, "invalid_response");
  }
  for (const key of url.searchParams.keys()) {
    if (["access_token", "authorization", "client_secret", "code"].includes(key.toLowerCase())) {
      throw providerFailure(PROVIDER, "invalid_response");
    }
  }
  return url;
}

function graphHeaders(accessToken: string): HeadersInit {
  return {
    authorization: `Bearer ${requireNonEmptyString(PROVIDER, accessToken)}`,
    Prefer: 'outlook.timezone="UTC"',
  };
}

async function listEvents(
  accessToken: string,
  calendarId: string,
  window: CalendarEventWindow,
  signal?: AbortSignal,
): Promise<CalendarProviderEvent[]> {
  const bounds = validateCalendarWindow(PROVIDER, window);
  const initial = new URL(calendarViewPath(calendarId));
  initial.searchParams.set("startDateTime", bounds.start);
  initial.searchParams.set("endDateTime", bounds.end);
  initial.searchParams.set("$top", "100");
  initial.searchParams.set("$select", EVENT_SELECT);
  const expectedPath = initial.pathname;

  let pageUrl: URL | null = initial;
  const seenLinks = new Set<string>();
  const events: CalendarProviderEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (!pageUrl || seenLinks.has(pageUrl.href)) {
      throw providerFailure(PROVIDER, "invalid_response");
    }
    seenLinks.add(pageUrl.href);
    const body = requireRecord(
      PROVIDER,
      await requestProviderJson({
        provider: PROVIDER,
        url: pageUrl,
        signal,
        init: { headers: graphHeaders(accessToken) },
      }),
    );
    if (!Array.isArray(body.value)) throw providerFailure(PROVIDER, "invalid_response");
    for (const rawEvent of body.value as unknown[]) {
      const event = mapOutlookEvent(rawEvent);
      if (event) events.push(event);
      if (events.length > MAX_EVENTS) throw providerFailure(PROVIDER, "invalid_response");
    }

    const nextLink = body["@odata.nextLink"];
    if (nextLink === undefined || nextLink === null || nextLink === "") return events;
    const nextUrl = validateNextLink(nextLink, expectedPath);
    if (seenLinks.has(nextUrl.href)) throw providerFailure(PROVIDER, "invalid_response");
    pageUrl = nextUrl;
  }

  throw providerFailure(PROVIDER, "invalid_response");
}

export const outlookCalendarProvider: CalendarProviderAdapter = {
  provider: PROVIDER,

  buildAuthorizationUrl(state, codeChallenge) {
    const env = outlookEnv();
    const url = new URL(`${AUTH_ROOT}/authorize`);
    url.searchParams.set("client_id", env.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", env.redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set("scope", OUTLOOK_SCOPES.join(" "));
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", requireOauthState(state));
    url.searchParams.set("code_challenge", requirePkceChallenge(codeChallenge));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },

  async exchangeCode(code, verifier, signal) {
    const env = outlookEnv();
    const body = new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code: requireNonEmptyString(PROVIDER, code),
      code_verifier: requirePkceVerifier(verifier),
      redirect_uri: env.redirectUri,
      grant_type: "authorization_code",
      scope: OUTLOOK_SCOPES.join(" "),
    });
    const result = await requestProviderJson({
      provider: PROVIDER,
      url: `${AUTH_ROOT}/token`,
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
    const env = outlookEnv();
    const body = new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: requireNonEmptyString(PROVIDER, refreshToken),
      grant_type: "refresh_token",
      scope: OUTLOOK_SCOPES.join(" "),
    });
    const result = await requestProviderJson({
      provider: PROVIDER,
      url: `${AUTH_ROOT}/token`,
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
        url: `${GRAPH_ROOT}/me?$select=id,mail,userPrincipalName`,
        signal,
        init: { headers: graphHeaders(accessToken) },
      }),
    );
    const email =
      typeof body.mail === "string" && body.mail.length > 0
        ? body.mail
        : typeof body.userPrincipalName === "string" && body.userPrincipalName.length > 0
          ? body.userPrincipalName
          : null;
    return { providerAccountId: requireNonEmptyString(PROVIDER, body.id), label: email };
  },

  listEvents,

  async getEvent(accessToken, calendarId, externalId, signal) {
    try {
      const body = await requestProviderJson({
        provider: PROVIDER,
        url: eventPath(calendarId, externalId),
        signal,
        init: { headers: graphHeaders(accessToken) },
      });
      return mapOutlookEvent(body);
    } catch (error) {
      if (isCalendarProviderFailure(error) && error.code === "not_found") return null;
      throw error;
    }
  },

  async createEvent(accessToken, calendarId, operationId, value, signal) {
    const normalizedOperationId = requireOperationId(PROVIDER, operationId);
    const body = { ...eventValueBody(value), transactionId: normalizedOperationId };
    const result = await requestProviderJson({
      provider: PROVIDER,
      url: eventCollectionPath(calendarId),
      signal,
      write: true,
      init: {
        method: "POST",
        headers: { ...graphHeaders(accessToken), "content-type": "application/json" },
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
    const result = await requestProviderJson({
      provider: PROVIDER,
      url: eventPath(calendarId, externalId),
      signal,
      write: true,
      init: {
        method: "PATCH",
        headers: {
          ...graphHeaders(accessToken),
          "content-type": "application/json",
          // Graph event-update docs do not explicitly guarantee this precondition.
          // Keep the check fail-closed and verify the live provider contract before rollout.
          "if-match": requireEtag(expectedEtag),
        },
        body: JSON.stringify(eventValueBody(value, { preserveSourceTitle: true, changedFields })),
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
          ...graphHeaders(accessToken),
          "if-match": requireEtag(expectedEtag),
        },
      },
    });
  },
};
