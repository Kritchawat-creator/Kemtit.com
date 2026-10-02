/** Provider-neutral calendar contracts. This module intentionally has no runtime imports. */
export type CalendarProviderName = "google" | "outlook";

/**
 * All-day values use YYYY-MM-DD and an exclusive end date. Timed values are
 * ISO instants with an explicit UTC offset or Z suffix.
 */
export type CalendarEventValue = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  blocksTime: boolean;
};

/** Window bounds are exclusive-ended ISO instants with an explicit offset or Z. */
export type CalendarEventWindow = {
  start: string;
  end: string;
};

export type CalendarProviderEventChangedField = "title" | "time" | "blocksTime";

export type CalendarProviderEvent = CalendarEventValue & {
  externalId: string;
  etag: string | null;
  operationId: string | null;
  kind: "single" | "occurrence" | "series";
};

export type CalendarProviderTokens = {
  accessToken: string;
  expiresAt: string;
  /** Providers may omit a refresh token on refresh; preserve the stored token then. */
  refreshToken?: string;
  scopes: string[];
};

export type CalendarProviderAccount = {
  providerAccountId: string;
  label: string | null;
};

export type CalendarProviderErrorCode =
  | "configuration"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "timeout"
  | "request_failed"
  | "invalid_response";

export type CalendarProviderWriteOutcome = "rejected" | "unknown";

/** Safe typed failure; provider response bodies and credentials must not be included. */
export type CalendarProviderError = Error & {
  readonly provider: CalendarProviderName;
  readonly code: CalendarProviderErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  /** `unknown` means the remote write may have committed despite no response. */
  readonly writeOutcome?: CalendarProviderWriteOutcome;
};

/** Provider transport and OAuth only; persistence and projection reconciliation live elsewhere. */
export interface CalendarProviderAdapter {
  readonly provider: CalendarProviderName;
  buildAuthorizationUrl(state: string, codeChallenge: string): string;
  exchangeCode(
    code: string,
    verifier: string,
    signal?: AbortSignal,
  ): Promise<CalendarProviderTokens>;
  refreshTokens(refreshToken: string, signal?: AbortSignal): Promise<CalendarProviderTokens>;
  getAccount(accessToken: string, signal?: AbortSignal): Promise<CalendarProviderAccount>;
  /** Fully drains a finite, validated page chain before returning. */
  listEvents(
    accessToken: string,
    calendarId: string,
    window: CalendarEventWindow,
    signal?: AbortSignal,
  ): Promise<CalendarProviderEvent[]>;
  /** Returns null only when the provider confirms the event is absent (404/410). */
  getEvent(
    accessToken: string,
    calendarId: string,
    externalId: string,
    signal?: AbortSignal,
  ): Promise<CalendarProviderEvent | null>;
  createEvent(
    accessToken: string,
    calendarId: string,
    operationId: string,
    value: CalendarEventValue,
    signal?: AbortSignal,
  ): Promise<CalendarProviderEvent>;
  /** The caller must reject missing ETags and series-level events before calling. */
  patchEvent(
    accessToken: string,
    calendarId: string,
    externalId: string,
    expectedEtag: string,
    value: CalendarEventValue,
    changedFields: readonly CalendarProviderEventChangedField[],
    signal?: AbortSignal,
  ): Promise<CalendarProviderEvent>;
  /** The caller must reject missing ETags and series-level events before calling. */
  deleteEvent(
    accessToken: string,
    calendarId: string,
    externalId: string,
    expectedEtag: string,
    signal?: AbortSignal,
  ): Promise<void>;
}
