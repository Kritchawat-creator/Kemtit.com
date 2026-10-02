import "server-only";

import type {
  CalendarEventValue,
  CalendarEventWindow,
  CalendarProviderErrorCode,
  CalendarProviderName,
  CalendarProviderWriteOutcome,
} from "./provider";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_WINDOW_MS = 732 * 24 * 60 * 60 * 1000;
const EXPLICIT_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CalendarProviderFailure extends Error {
  readonly provider: CalendarProviderName;
  readonly code: CalendarProviderErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  readonly writeOutcome?: CalendarProviderWriteOutcome;

  constructor(input: {
    provider: CalendarProviderName;
    code: CalendarProviderErrorCode;
    status?: number;
    retryAfterSeconds?: number;
    writeOutcome?: CalendarProviderWriteOutcome;
  }) {
    super("Calendar provider request could not be completed.");
    this.name = "CalendarProviderFailure";
    this.provider = input.provider;
    this.code = input.code;
    this.status = input.status;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.writeOutcome = input.writeOutcome;
  }
}

export function isCalendarProviderFailure(error: unknown): error is CalendarProviderFailure {
  return error instanceof CalendarProviderFailure;
}

export function providerFailure(
  provider: CalendarProviderName,
  code: CalendarProviderErrorCode,
  options: {
    status?: number;
    retryAfterSeconds?: number;
    writeOutcome?: CalendarProviderWriteOutcome;
  } = {},
): CalendarProviderFailure {
  return new CalendarProviderFailure({ provider, code, ...options });
}

export function unknownWriteFailure(
  provider: CalendarProviderName,
  error: unknown,
): CalendarProviderFailure {
  if (isCalendarProviderFailure(error)) {
    return providerFailure(provider, error.code, {
      status: error.status,
      retryAfterSeconds: error.retryAfterSeconds,
      writeOutcome: "unknown",
    });
  }
  return providerFailure(provider, "invalid_response", { writeOutcome: "unknown" });
}

type RequestOptions = {
  provider: CalendarProviderName;
  url: string | URL;
  init?: Omit<RequestInit, "cache" | "redirect" | "signal">;
  signal?: AbortSignal;
  write?: boolean;
};

export async function requestProviderJson(input: RequestOptions): Promise<unknown> {
  return requestProvider(input, "json");
}

export async function requestProviderNoContent(input: RequestOptions): Promise<void> {
  await requestProvider(input, "none");
}

async function requestProvider(
  input: RequestOptions,
  responseMode: "json" | "none",
): Promise<unknown> {
  if (input.signal?.aborted) {
    throw providerFailure(input.provider, "request_failed", {
      writeOutcome: input.write ? "rejected" : undefined,
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(input.signal?.reason);
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input.url, {
      ...input.init,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw providerFailure(input.provider, "request_failed", {
        status: response.status,
        writeOutcome: input.write ? "rejected" : undefined,
      });
    }

    if (!response.ok) {
      throw providerFailure(input.provider, codeForStatus(response.status), {
        status: response.status,
        retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
        writeOutcome:
          input.write && isAmbiguousWriteStatus(response.status)
            ? "unknown"
            : input.write
              ? "rejected"
              : undefined,
      });
    }

    if (responseMode === "none") return undefined;

    try {
      return await response.json();
    } catch {
      throw providerFailure(input.provider, "invalid_response", {
        status: response.status,
        writeOutcome: input.write ? "unknown" : undefined,
      });
    }
  } catch (error) {
    if (isCalendarProviderFailure(error)) throw error;
    throw providerFailure(input.provider, timedOut ? "timeout" : "request_failed", {
      writeOutcome: input.write ? "unknown" : undefined,
    });
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function codeForStatus(status: number): CalendarProviderErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404 || status === 410) return "not_found";
  if (status === 409 || status === 412) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 408 || status === 504) return "timeout";
  return "request_failed";
}

function isAmbiguousWriteStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 504;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export function requireExplicitInstant(provider: CalendarProviderName, value: string): string {
  if (!EXPLICIT_INSTANT.test(value)) {
    throw providerFailure(provider, "invalid_response");
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw providerFailure(provider, "invalid_response");
  return date.toISOString();
}

export function requireDateOnly(provider: CalendarProviderName, value: string): string {
  if (!ISO_DATE.test(value)) throw providerFailure(provider, "invalid_response");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw providerFailure(provider, "invalid_response");
  }
  return value;
}

export function validateCalendarWindow(
  provider: CalendarProviderName,
  window: CalendarEventWindow,
): { start: string; end: string } {
  const start = requireExplicitInstant(provider, window.start);
  const end = requireExplicitInstant(provider, window.end);
  const duration = Date.parse(end) - Date.parse(start);
  if (duration <= 0 || duration > MAX_WINDOW_MS) {
    throw providerFailure(provider, "invalid_response");
  }
  return { start, end };
}

export function validateCalendarEventValue(
  provider: CalendarProviderName,
  value: CalendarEventValue,
  options: { preserveSourceTitle?: boolean } = {},
): CalendarEventValue {
  const preserveSourceTitle = options.preserveSourceTitle ?? false;
  if (typeof value.title !== "string") {
    throw providerFailure(provider, "invalid_response");
  }
  if (
    preserveSourceTitle
      ? value.title.length > 16_384
      : !value.title.trim() || value.title.length > 200
  ) {
    throw providerFailure(provider, "invalid_response");
  }
  if (value.allDay) {
    const start = requireDateOnly(provider, value.start);
    const end = requireDateOnly(provider, value.end);
    if (end <= start) throw providerFailure(provider, "invalid_response");
    return { ...value, start, end, title: preserveSourceTitle ? value.title : value.title.trim() };
  }

  const start = requireExplicitInstant(provider, value.start);
  const end = requireExplicitInstant(provider, value.end);
  if (Date.parse(end) <= Date.parse(start)) throw providerFailure(provider, "invalid_response");
  return { ...value, start, end, title: preserveSourceTitle ? value.title : value.title.trim() };
}

export function requireSafePathValue(provider: CalendarProviderName, value: string): string {
  if (!value || value.length > 1024 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw providerFailure(provider, "invalid_response");
  }
  return value;
}

export function requireNonEmptyString(provider: CalendarProviderName, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw providerFailure(provider, "invalid_response");
  }
  return value;
}

export function requireRecord(
  provider: CalendarProviderName,
  value: unknown,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw providerFailure(provider, "invalid_response");
  }
  return value as Record<string, unknown>;
}

export function requireWriteEtag(provider: CalendarProviderName, etag: string): string {
  if (typeof etag !== "string" || etag.trim().length === 0 || /[\r\n]/.test(etag)) {
    throw providerFailure(provider, "conflict");
  }
  return etag;
}

export function requireOperationId(provider: CalendarProviderName, operationId: string): string {
  if (
    typeof operationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)
  ) {
    throw providerFailure(provider, "invalid_response");
  }
  return operationId.toLowerCase();
}
