import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { googleCalendarProvider } from "./google-provider";
import { CalendarProviderFailure, requestProviderJson } from "./provider-http";
import { outlookCalendarProvider } from "./outlook-provider";

const accessToken = "test-access-token";
const operationId = "a4c5ad9e-0ea4-4c51-9057-2ea4e87a395d";
const verifier = "0123456789012345678901234567890123456789012";
const challenge = "abcdefghijklmnopqrstuvwxyzABCDEFG0123456789_-";

const timedValue = {
  title: "Planning review",
  start: "2026-05-01T16:30:00.000Z",
  end: "2026-05-01T17:30:00.000Z",
  allDay: false,
  blocksTime: true,
};

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function setGoogleEnv() {
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "google-client-id");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "google-client-secret");
  vi.stubEnv("GOOGLE_CALENDAR_REDIRECT_URI", "https://kemtit.example/api/calendar/google/callback");
  vi.stubEnv("CALENDAR_TOKEN_ENCRYPTION_KEY", "calendar-encryption-key-that-is-long-enough");
}

function setOutlookEnv() {
  vi.stubEnv("OUTLOOK_CALENDAR_CLIENT_ID", "outlook-client-id");
  vi.stubEnv("OUTLOOK_CALENDAR_CLIENT_SECRET", "outlook-client-secret");
  vi.stubEnv(
    "OUTLOOK_CALENDAR_REDIRECT_URI",
    "https://kemtit.example/api/calendar/outlook/callback",
  );
  vi.stubEnv("CALENDAR_TOKEN_ENCRYPTION_KEY", "calendar-encryption-key-that-is-long-enough");
}

describe("calendar provider OAuth contracts", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requests Google event write scope with S256 PKCE and preserves no omitted refresh scope", async () => {
    setGoogleEnv();
    const url = new URL(googleCalendarProvider.buildAuthorizationUrl("a".repeat(32), challenge));
    expect(url.searchParams.get("scope")).toContain("auth/calendar.events");
    expect(url.searchParams.get("scope")).not.toContain("calendar.events.readonly");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(challenge);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "issued",
          expires_in: 3600,
          refresh_token: "new-refresh-token",
          scope: "openid email https://www.googleapis.com/auth/calendar.events",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "refreshed", expires_in: 3600, token_type: "Bearer" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const exchanged = await googleCalendarProvider.exchangeCode("authorization-code", verifier);
    const exchangeBody = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(exchangeBody.get("code_verifier")).toBe(verifier);
    expect(exchanged.refreshToken).toBe("new-refresh-token");

    const tokens = await googleCalendarProvider.refreshTokens("stored-refresh-token");
    const body = new URLSearchParams(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body.get("refresh_token")).toBe("stored-refresh-token");
    expect(tokens.accessToken).toBe("refreshed");
    expect(tokens.refreshToken).toBeUndefined();
    expect(tokens.scopes).toEqual([]);
  });

  it("uses Outlook delegated write consent, PKCE, and requires UTC for offset-free timed values", async () => {
    setOutlookEnv();
    const url = new URL(outlookCalendarProvider.buildAuthorizationUrl("b".repeat(32), challenge));
    expect(url.origin).toBe("https://login.microsoftonline.com");
    expect(url.searchParams.get("scope")).toContain("Calendars.ReadWrite");
    expect(url.searchParams.get("scope")).toContain("offline_access");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        value: [
          {
            id: "outlook-timed-event",
            subject: "UTC meeting",
            start: { dateTime: "2026-05-01T16:30:00.0000000", timeZone: "UTC" },
            end: { dateTime: "2026-05-01T17:30:00.0000000", timeZone: "UTC" },
            isAllDay: false,
            showAs: "busy",
            type: "singleInstance",
            "@odata.etag": 'W/"version-1"',
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const events = await outlookCalendarProvider.listEvents(accessToken, "primary", {
      start: "2026-01-01T00:00:00Z",
      end: "2027-12-31T00:00:00Z",
    });
    expect(events[0]).toMatchObject({
      start: "2026-05-01T16:30:00.000Z",
      end: "2026-05-01T17:30:00.000Z",
      blocksTime: true,
    });
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/me/calendarView?");
    expect(headers.get("prefer")).toBe('outlook.timezone="UTC"');
  });

  it("exchanges Outlook authorization codes with the PKCE verifier", async () => {
    setOutlookEnv();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: "outlook-access",
        refresh_token: "outlook-refresh",
        expires_in: 3600,
        scope: "openid profile email offline_access User.Read Calendars.ReadWrite",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const tokens = await outlookCalendarProvider.exchangeCode("outlook-code", verifier);
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.get("code_verifier")).toBe(verifier);
    expect(body.get("scope")).toContain("Calendars.ReadWrite");
    expect(tokens.scopes).toContain("Calendars.ReadWrite");
  });
});

describe("Google Calendar adapter", () => {
  beforeEach(setGoogleEnv);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("normalizes all-day exclusivity, transparent availability, and a timezone-only event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "all-day",
            summary: "Holiday",
            start: { date: "2026-05-01" },
            end: { date: "2026-05-03" },
            transparency: "transparent",
            etag: "etag-all-day",
          },
          {
            id: "timed",
            summary: "West coast call",
            start: { dateTime: "2026-05-01T09:30:00", timeZone: "America/Los_Angeles" },
            end: { dateTime: "2026-05-01T10:30:00", timeZone: "America/Los_Angeles" },
            etag: "etag-timed",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const events = await googleCalendarProvider.listEvents(accessToken, "primary", {
      start: "2026-01-01T00:00:00Z",
      end: "2027-12-31T00:00:00Z",
    });

    expect(events[0]).toMatchObject({
      start: "2026-05-01",
      end: "2026-05-03",
      allDay: true,
      blocksTime: false,
    });
    expect(events[1]).toMatchObject({
      start: "2026-05-01T16:30:00.000Z",
      end: "2026-05-01T17:30:00.000Z",
      allDay: false,
      blocksTime: true,
    });
  });

  it("accepts a documented empty collection envelope but rejects a malformed empty snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          kind: "calendar#events",
          etag: "collection-etag",
          nextSyncToken: "sync-token",
        }),
      ),
    );
    await expect(
      googleCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).resolves.toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
    await expect(
      googleCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects an all-day event with an invalid exclusive end before returning a snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              id: "invalid-all-day",
              summary: "Invalid",
              start: { date: "2026-05-03" },
              end: { date: "2026-05-01" },
            },
          ],
        }),
      ),
    );
    await expect(
      googleCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("stops when Google repeats a page token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [], nextPageToken: "repeated-token" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      googleCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["nonexistent DST time", "2026-03-08T02:30:00", "America/New_York"],
    ["ambiguous DST time", "2026-11-01T01:30:00", "America/New_York"],
    ["missing timezone", "2026-05-01T09:30:00", undefined],
  ])("fails closed for a %s", async (_description, dateTime, timeZone) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              id: "uncertain-local-time",
              start: { dateTime, timeZone },
              end: { dateTime: "2026-05-01T10:30:00", timeZone },
            },
          ],
        }),
      ),
    );
    await expect(
      googleCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("creates with a deterministic provider ID and operation marker", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({
        ...sent,
        etag: "etag-created",
        start: { dateTime: timedValue.start },
        end: { dateTime: timedValue.end },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const event = await googleCalendarProvider.createEvent(
      accessToken,
      "primary",
      operationId,
      timedValue,
    );
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(sent.id).toBe(`ka4c5ad9e0ea44c5190572ea4e87a395d`);
    expect(sent.extendedProperties).toMatchObject({
      private: { kemtitOperationId: operationId },
    });
    expect(event.operationId).toBe(operationId);
  });

  it("uses If-Match and changes only supported fields when patching", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({
        id: "event-1",
        etag: "etag-2",
        summary: sent.summary,
        start: sent.start,
        end: sent.end,
        transparency: sent.transparency,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await googleCalendarProvider.patchEvent(
      accessToken,
      "primary",
      "event-1",
      '"etag-1"',
      timedValue,
      ["title", "time", "blocksTime"],
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    const headers = new Headers(init.headers);
    expect(init.method).toBe("PATCH");
    expect(headers.get("if-match")).toBe('"etag-1"');
    expect(Object.keys(sent).sort()).toEqual(["end", "start", "summary", "transparency"]);
  });

  it("preserves a long source title when patching an imported event", async () => {
    const sourceTitle = `  ${"x".repeat(201)}  `;
    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({
        id: "event-1",
        etag: "etag-2",
        summary: sent.summary,
        start: { dateTime: timedValue.start },
        end: { dateTime: timedValue.end },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await googleCalendarProvider.patchEvent(
      accessToken,
      "primary",
      "event-1",
      '"etag-1"',
      {
        ...timedValue,
        title: sourceTitle,
      },
      ["title"],
    );

    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(sent.summary).toBe(sourceTitle);
    expect(Object.keys(sent)).toEqual(["summary"]);
  });

  it("rejects a missing ETag before issuing a mutation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      googleCalendarProvider.deleteEvent(accessToken, "primary", "event-1", ""),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null only for confirmed missing events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 410 })));
    await expect(
      googleCalendarProvider.getEvent(accessToken, "primary", "gone"),
    ).resolves.toBeNull();
  });
});

describe("Outlook Calendar adapter", () => {
  beforeEach(setOutlookEnv);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps free all-day imports visible while preserving their exclusive end date", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          value: [
            {
              id: "free-holiday",
              subject: "Holiday",
              start: { dateTime: "2026-05-01T00:00:00.0000000", timeZone: "UTC" },
              end: { dateTime: "2026-05-03T00:00:00.0000000", timeZone: "UTC" },
              isAllDay: true,
              showAs: "free",
              type: "singleInstance",
            },
          ],
        }),
      ),
    );
    const events = await outlookCalendarProvider.listEvents(accessToken, "primary", {
      start: "2026-01-01T00:00:00Z",
      end: "2027-12-31T00:00:00Z",
    });
    expect(events[0]).toMatchObject({
      start: "2026-05-01",
      end: "2026-05-03",
      allDay: true,
      blocksTime: false,
    });
  });

  it("filters cancelled Outlook events and rejects an incomplete collection envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              id: "cancelled",
              isCancelled: true,
              subject: "Cancelled",
              start: { dateTime: "2026-05-01T00:00:00.0000000", timeZone: "UTC" },
              end: { dateTime: "2026-05-01T01:00:00.0000000", timeZone: "UTC" },
              isAllDay: false,
            },
          ],
        }),
      ),
    );
    await expect(
      outlookCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).resolves.toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
    await expect(
      outlookCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("does not follow a foreign Graph nextLink with the bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ value: [], "@odata.nextLink": "https://attacker.example/leak" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      outlookCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not follow a same-origin nextLink to a different Graph path", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        value: [],
        "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skiptoken=abc",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      outlookCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops when Graph repeats a validated nextLink", async () => {
    const nextLink = "https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=repeat";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ value: [], "@odata.nextLink": nextLink }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      outlookCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("creates with a stable transaction ID and patches a narrow field set with If-Match", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (init?.method === "POST") {
        return jsonResponse({
          id: "outlook-created",
          subject: sent.subject,
          start: sent.start,
          end: sent.end,
          isAllDay: sent.isAllDay,
          showAs: sent.showAs,
          transactionId: sent.transactionId,
          type: "singleInstance",
          "@odata.etag": "etag-1",
        });
      }
      return jsonResponse({
        id: "outlook-created",
        subject: sent.subject,
        start: { dateTime: "2026-05-01T16:30:00.0000000", timeZone: "UTC" },
        end: { dateTime: "2026-05-01T17:30:00.0000000", timeZone: "UTC" },
        isAllDay: false,
        showAs: "busy",
        type: "singleInstance",
        "@odata.etag": "etag-2",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const created = await outlookCalendarProvider.createEvent(
      accessToken,
      "primary",
      operationId,
      timedValue,
    );
    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(createBody.transactionId).toBe(operationId);
    expect(created.operationId).toBe(operationId);

    await outlookCalendarProvider.patchEvent(
      accessToken,
      "primary",
      "outlook-created",
      "etag-1",
      {
        ...timedValue,
        title: "Updated title",
        blocksTime: false,
      },
      ["title", "blocksTime"],
    );
    const [, patchInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const patchBody = JSON.parse(String(patchInit.body)) as Record<string, unknown>;
    expect(patchInit.method).toBe("PATCH");
    expect(new Headers(patchInit.headers).get("if-match")).toBe("etag-1");
    expect(Object.keys(patchBody).sort()).toEqual(["showAs", "subject"]);
    expect(patchBody.showAs).toBe("free");
    expect(createBody.start).toEqual({ dateTime: "2026-05-01T16:30:00.000", timeZone: "UTC" });
    expect(createBody.end).toEqual({ dateTime: "2026-05-01T17:30:00.000", timeZone: "UTC" });
  });

  it("preserves a long source subject without rewriting imported time metadata", async () => {
    const sourceTitle = `  ${"x".repeat(201)}  `;
    const fetchMock = vi.fn().mockImplementation(async (_input, init) => {
      const sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({
        id: "outlook-event",
        subject: sent.subject,
        start: { dateTime: "2026-05-01T09:30:00-07:00", timeZone: "Pacific Standard Time" },
        end: { dateTime: "2026-05-01T10:30:00-07:00", timeZone: "Pacific Standard Time" },
        isAllDay: false,
        showAs: "busy",
        type: "singleInstance",
        "@odata.etag": "etag-2",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await outlookCalendarProvider.patchEvent(
      accessToken,
      "primary",
      "outlook-event",
      "etag-1",
      {
        title: sourceTitle,
        start: "2026-05-01T16:30:00.000Z",
        end: "2026-05-01T17:30:00.000Z",
        allDay: false,
        blocksTime: true,
      },
      ["title"],
    );

    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(sent.subject).toBe(sourceTitle);
    expect(Object.keys(sent)).toEqual(["subject"]);
  });

  it("normalizes both offset endpoints for a time-only Outlook patch", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      return jsonResponse({
        id: "outlook-event",
        subject: "Original subject",
        start: { dateTime: "2026-05-01T16:30:00.0000000", timeZone: "UTC" },
        end: { dateTime: "2026-05-01T17:30:00.0000000", timeZone: "UTC" },
        isAllDay: false,
        showAs: "busy",
        type: "singleInstance",
        "@odata.etag": "etag-2",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await outlookCalendarProvider.patchEvent(
      accessToken,
      "primary",
      "outlook-event",
      "etag-1",
      {
        ...timedValue,
        start: "2026-05-01T18:30:00+02:00",
        end: "2026-05-01T19:30:00+02:00",
      },
      ["time"],
    );

    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(["end", "isAllDay", "start"]);
    expect(sent.start).toEqual({ dateTime: "2026-05-01T16:30:00.000", timeZone: "UTC" });
    expect(sent.end).toEqual({ dateTime: "2026-05-01T17:30:00.000", timeZone: "UTC" });
  });

  it("fails closed when Graph returns an unrecognized timezone for a timed event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          value: [
            {
              id: "unknown-zone",
              subject: "Unknown zone",
              start: { dateTime: "2026-05-01T09:00:00.0000000", timeZone: "Pacific Standard Time" },
              end: { dateTime: "2026-05-01T10:00:00.0000000", timeZone: "Pacific Standard Time" },
              isAllDay: false,
              showAs: "busy",
            },
          ],
        }),
      ),
    );
    await expect(
      outlookCalendarProvider.listEvents(accessToken, "primary", {
        start: "2026-01-01T00:00:00Z",
        end: "2027-12-31T00:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("calendar provider HTTP failure behavior", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("blocks redirects and never includes raw provider bodies in errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("private-token-like-provider-body", {
        status: 302,
        headers: { location: "https://attacker.example/collect" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(googleCalendarProvider.getAccount(accessToken)).rejects.toMatchObject({
      code: "request_failed",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe("manual");
    expect(String(fetchMock.mock.results[0]?.value)).not.toContain(
      "private-token-like-provider-body",
    );
  });

  it("marks transport ambiguity as unknown and explicit precondition rejection as rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "secret response body" }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: "secret response body" }, 412));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      googleCalendarProvider.deleteEvent(accessToken, "primary", "event-1", "etag"),
    ).rejects.toMatchObject({ code: "request_failed", writeOutcome: "unknown" });
    await expect(
      googleCalendarProvider.deleteEvent(accessToken, "primary", "event-1", "etag"),
    ).rejects.toMatchObject({ code: "conflict", writeOutcome: "rejected" });
    expect(fetchMock.mock.results.map((result) => String(result.value))).not.toEqual(
      expect.arrayContaining([expect.stringContaining("secret response body")]),
    );
  });

  it("marks malformed successful mutation responses unknown", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("not-json", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      googleCalendarProvider.createEvent(accessToken, "primary", operationId, timedValue),
    ).rejects.toMatchObject({ code: "invalid_response", writeOutcome: "unknown" });
  });

  it("aborts a stalled provider request at the bounded timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = requestProviderJson({
      provider: "google",
      url: "https://provider.example/events",
      write: true,
    });
    const failure = expect(request).rejects.toMatchObject({
      code: "timeout",
      writeOutcome: "unknown",
    });
    await vi.advanceTimersByTimeAsync(12_000);
    await failure;
    vi.useRealTimers();
  });

  it("does not echo network exception details and records ambiguous write aborts", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("private network detail")),
            {
              once: true,
            },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = googleCalendarProvider.createEvent(
      accessToken,
      "primary",
      operationId,
      timedValue,
      controller.signal,
    );
    controller.abort();
    try {
      await request;
      throw new Error("Expected the provider request to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(CalendarProviderFailure);
      expect(error).toMatchObject({ writeOutcome: "unknown" });
      expect((error as Error).message).not.toContain("private network detail");
    }
  });
});
