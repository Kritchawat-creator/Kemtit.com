import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  exchangeCode: vi.fn(),
  getAccount: vi.fn(),
  getProfile: vi.fn(),
  getUser: vi.fn(),
  persist: vi.fn(),
  sync: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  ExternalCalendarServiceError: class extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    delete: mocks.cookieDelete,
    get: mocks.cookieGet,
    set: mocks.cookieSet,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.getProfile }),
      }),
    }),
  }),
}));
vi.mock("@/core/calendar-integrations/providers", () => ({
  getCalendarProvider: () => ({
    buildAuthorizationUrl: mocks.buildAuthorizationUrl,
    exchangeCode: mocks.exchangeCode,
    getAccount: mocks.getAccount,
  }),
}));
vi.mock("@/core/calendar-integrations/provider-http", () => ({
  isCalendarProviderFailure: () => false,
}));
vi.mock("@/core/calendar-integrations/service", () => ({
  ExternalCalendarServiceError: mocks.ExternalCalendarServiceError,
  persistExternalCalendarConnection: mocks.persist,
  syncExternalCalendar: mocks.sync,
}));
vi.mock("@/core/auth/session-errors", () => ({
  authFailureContext: () => ({ code: "retryable" }),
  isUnauthenticatedAuthError: () => false,
}));

import { NextRequest } from "next/server";
import { createCalendarOAuthState } from "@/core/calendar-integrations/oauth-state";
import { GET as googleConnect } from "../google/connect/route";
import { GET as googleCallback } from "../google/callback/route";
import { GET as providerConnect } from "./connect/route";
import { GET as providerCallback } from "./callback/route";

function request(url: string) {
  return new NextRequest(url);
}

describe("calendar OAuth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.getProfile.mockResolvedValue({ data: { onboarding_completed_at: "2026-01-01" }, error: null });
    mocks.buildAuthorizationUrl.mockReturnValue("https://provider.example/consent");
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.exchangeCode.mockResolvedValue({
      accessToken: "test-access-token",
      expiresAt: "2026-09-27T12:00:00.000Z",
      refreshToken: "test-refresh-token",
      scopes: ["calendar.events"],
    });
    mocks.getAccount.mockResolvedValue({ providerAccountId: "provider-user", label: "user@example.test" });
    mocks.persist.mockResolvedValue("connection-1");
    mocks.sync.mockResolvedValue(0);
  });

  afterEach(() => vi.restoreAllMocks());

  it("preserves the Google connect URL and starts provider-specific OAuth with a user-bound PKCE cookie", async () => {
    const response = await googleConnect(request("https://kemtit.test/api/calendar/google/connect"));

    expect(response.headers.get("location")).toBe("https://provider.example/consent");
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "kemtit-calendar-oauth-google",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 600 }),
    );
    expect(mocks.buildAuthorizationUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    );
  });

  it("connects Outlook through the shared route and persists before the initial import", async () => {
    const response = await providerConnect(request("https://kemtit.test/api/calendar/outlook/connect"), {
      params: Promise.resolve({ provider: "outlook" }),
    });
    const stateCookie = String(mocks.cookieSet.mock.calls[0]?.[1]);
    const statePayload = JSON.parse(Buffer.from(stateCookie, "base64url").toString("utf8")) as {
      state: string;
    };
    mocks.cookieGet.mockReturnValue({ value: stateCookie });

    const callback = await providerCallback(
      request(`https://kemtit.test/api/calendar/outlook/callback?code=oauth-code&state=${statePayload.state}`),
      { params: Promise.resolve({ provider: "outlook" }) },
    );

    expect(response.headers.get("location")).toBe("https://provider.example/consent");
    expect(mocks.exchangeCode).toHaveBeenCalledWith("oauth-code", expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
    expect(mocks.persist).toHaveBeenCalledWith({
      userId: "user-1",
      provider: "outlook",
      account: { providerAccountId: "provider-user", label: "user@example.test" },
      tokens: expect.objectContaining({ accessToken: "test-access-token" }),
    });
    expect(mocks.sync).toHaveBeenCalledWith("user-1", "connection-1");
    expect(new URL(callback.headers.get("location")!).searchParams.get("calendar")).toBe("connected");
  });

  it("rejects a callback started by a different signed-in user before token exchange", async () => {
    const started = createCalendarOAuthState("user-1");
    mocks.cookieGet.mockReturnValue({ value: started.cookieValue });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-2" } }, error: null });

    const response = await googleCallback(
      request(`https://kemtit.test/api/calendar/google/callback?code=oauth-code&state=${started.state}`),
    );

    expect(new URL(response.headers.get("location")!).searchParams.get("calendar")).toBe("invalid-state");
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });
});
