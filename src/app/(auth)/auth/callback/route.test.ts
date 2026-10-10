import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  createAdminSupabase: vi.fn(),
  approveSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: mocks.createAdminSupabase }));

import { GET } from "./route";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "650e8400-e29b-41d4-a716-446655440000";

function token(claims: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

function pendingToken(amr: unknown) {
  return token({
    sub: "00000000-0000-0000-0000-000000000000",
    role: "kemtit_pending",
    session_id: sessionId,
    kemtit_claim_version: 1,
    kemtit_session_state: "pending",
    amr,
  });
}

function approvedToken() {
  return token({
    sub: userId,
    role: "authenticated",
    session_id: sessionId,
    kemtit_claim_version: 1,
    kemtit_session_state: "approved",
  });
}

function configureCallback(options: {
  amr: unknown;
  identities: Array<{ provider: string }>;
  profileError?: { code: string; status: number };
}) {
  const user = {
    id: userId,
    app_metadata: { provider: "email" },
    identities: options.identities,
  };
  const session = {
    access_token: pendingToken(options.amr),
    refresh_token: "trusted-auth-refresh-token",
  };
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { onboarding_completed_at: "2026-01-01" },
      error: options.profileError ?? null,
    }),
  };
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);

  const supabase = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user, session },
        error: null,
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: { ...session, access_token: approvedToken() } },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      signOut: mocks.signOut,
    },
    from: vi.fn().mockReturnValue(profileQuery),
  };
  mocks.createServerSupabase.mockResolvedValue(supabase);
  mocks.createAdminSupabase.mockReturnValue({
    rpc: mocks.approveSession,
  });
  return { supabase, user, session, profileQuery };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.approveSession.mockResolvedValue({ data: true, error: null });
});

describe("Google OAuth callback approval", () => {
  it("approves a Google OAuth identity linked to an email-primary account", async () => {
    configureCallback({ amr: [{ method: "oauth" }], identities: [{ provider: "google" }] });
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=provider-code&next=%2Ftoday"),
    );

    expect(mocks.approveSession).toHaveBeenCalledWith("approve_login_session", {
      p_user_id: userId,
      p_session_id: sessionId,
    });
    expect(response.headers.get("location")).toBe("http://localhost:3000/today");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("rejects an email/password exchange even when a Google identity is linked", async () => {
    const { supabase } = configureCallback({
      amr: [{ method: "password" }],
      identities: [{ provider: "google" }],
    });
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=provider-code"),
    );

    expect(mocks.approveSession).not.toHaveBeenCalled();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toContain("/login?error=googleAuthFailed");
  });

  it("rejects OAuth claims when the exchange user has no Google identity", async () => {
    configureCallback({ amr: [{ method: "oauth" }], identities: [] });
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=provider-code"),
    );

    expect(mocks.approveSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/login?error=googleAuthFailed");
  });

  it("clears the approved local session and returns to login when profile lookup fails", async () => {
    const { supabase } = configureCallback({
      amr: [{ method: "oauth" }],
      identities: [{ provider: "google" }],
      profileError: { code: "temporarily_unavailable", status: 503 },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=provider-code"),
    );

    expect(response.headers.get("location")).toContain("/login?error=googleAuthFailed");
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(log).toHaveBeenCalledWith("[auth] Google profile lookup failed", {
      code: "temporarily_unavailable",
    });
  });
});
