import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  createAdminSupabase: vi.fn(),
  getChallengeCookie: vi.fn(),
  getTrustedDeviceCookie: vi.fn(),
  clearAllChallengeCookies: vi.fn(),
  clearChallengeCookie: vi.fn(),
  setChallengeCookie: vi.fn(),
  setTrustedDeviceCookie: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  refreshSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  updateUserById: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://kemtit.example" }),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: mocks.createServerSupabase }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: mocks.createAdminSupabase }));
vi.mock("./login-security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./login-security")>();
  return {
    ...actual,
    getChallengeCookie: mocks.getChallengeCookie,
    getTrustedDeviceCookie: mocks.getTrustedDeviceCookie,
    clearAllChallengeCookies: mocks.clearAllChallengeCookies,
    clearChallengeCookie: mocks.clearChallengeCookie,
    setChallengeCookie: mocks.setChallengeCookie,
    setTrustedDeviceCookie: mocks.setTrustedDeviceCookie,
    hashTokenAsBytea: (token: string) => `hashed:${token}`,
  };
});

import { completeRecoveryOtp, requestRecoveryOtp, signInWithPassword } from "./actions";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "650e8400-e29b-41d4-a716-446655440000";
const passwordSessionId = "750e8400-e29b-41d4-a716-446655440000";
const challengeToken = "server-cookie-challenge-token";

function authToken(claims: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

function pendingToken(targetSessionId = sessionId) {
  return authToken({
    sub: "00000000-0000-0000-0000-000000000000",
    role: "kemtit_pending",
    session_id: targetSessionId,
    kemtit_claim_version: 1,
    kemtit_session_state: "pending",
  });
}

function approvedToken(targetSessionId = sessionId) {
  return authToken({
    sub: userId,
    role: "authenticated",
    session_id: targetSessionId,
    kemtit_claim_version: 1,
    kemtit_session_state: "approved",
  });
}

function configureAuth(profile: Record<string, unknown> | null = null) {
  const order: string[] = [];
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);

  mocks.signInWithPassword.mockImplementation(async () => {
    order.push("password-sign-in");
    return {
      data: {
        user: { id: userId },
        session: {
          access_token: pendingToken(passwordSessionId),
          refresh_token: "new-password-refresh-token",
        },
      },
      error: null,
    };
  });
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockImplementation(async () => {
    order.push("verify-otp");
    return {
      data: {
        user: { id: userId },
        session: { access_token: pendingToken(), refresh_token: "otp-refresh-token" },
      },
      error: null,
    };
  });
  mocks.refreshSession.mockResolvedValue({
    data: { session: { access_token: approvedToken(passwordSessionId) } },
    error: null,
  });
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.updateUserById.mockImplementation(async () => {
    order.push("set-password");
    return { data: { user: { id: userId } }, error: null };
  });
  mocks.getChallengeCookie.mockResolvedValue(challengeToken);
  mocks.getTrustedDeviceCookie.mockResolvedValue(null);
  mocks.clearAllChallengeCookies.mockResolvedValue(undefined);
  mocks.clearChallengeCookie.mockResolvedValue(undefined);
  mocks.setChallengeCookie.mockResolvedValue(undefined);
  mocks.setTrustedDeviceCookie.mockResolvedValue(undefined);
  mocks.rpc.mockImplementation(async (name: string) => {
    order.push(name);
    if (name === "reserve_login_challenge_attempt") return { data: true, error: null };
    if (name === "consume_login_challenge") return { data: true, error: null };
    if (name === "approve_login_session") return { data: true, error: null };
    if (name === "begin_login_challenge") return { data: true, error: null };
    return { data: false, error: null };
  });

  const supabase = {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signInWithOtp: mocks.signInWithOtp,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      verifyOtp: mocks.verifyOtp,
      refreshSession: mocks.refreshSession,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
    from: vi.fn().mockReturnValue(profileQuery),
  };
  const admin = {
    rpc: mocks.rpc,
    auth: { admin: { updateUserById: mocks.updateUserById } },
  };
  mocks.createServerSupabase.mockResolvedValue(supabase);
  mocks.createAdminSupabase.mockReturnValue(admin);
  return { order, profileQuery, supabase, admin };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("password and OTP login actions", () => {
  it("does not send OTP when password authentication fails", async () => {
    configureAuth();
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 400, code: "invalid_credentials" },
    });

    await expect(
      signInWithPassword({ email: "person@example.com", password: "wrong-password" }),
    ).resolves.toEqual({ ok: false, error: "invalidCredentials" });
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the Auth hook claims are missing or malformed", async () => {
    configureAuth();
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: userId },
        session: { access_token: authToken({ sub: userId }), refresh_token: "refresh" },
      },
      error: null,
    });

    await expect(
      signInWithPassword({ email: "person@example.com", password: "correct-password" }),
    ).resolves.toEqual({ ok: false, error: "generic" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("does not verify or consume an OTP after the challenge attempt limit is reached", async () => {
    configureAuth();
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      completeRecoveryOtp({
        email: "person@example.com",
        token: "123456",
        password: "a-strong-password",
        confirmPassword: "a-strong-password",
      }),
    ).resolves.toEqual({ ok: false, error: "otpInvalid" });
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("consumes recovery proof before setting a password, then approves and refreshes that session", async () => {
    const { order } = configureAuth();
    const result = await completeRecoveryOtp({
      email: "person@example.com",
      token: "123456",
      password: "a-strong-password",
      confirmPassword: "a-strong-password",
    });

    expect(result).toEqual({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: true },
    });
    expect(order.indexOf("verify-otp")).toBeLessThan(order.indexOf("consume_login_challenge"));
    expect(order.indexOf("consume_login_challenge")).toBeLessThan(order.indexOf("set-password"));
    expect(order.indexOf("set-password")).toBeLessThan(order.indexOf("password-sign-in"));
    expect(order.indexOf("password-sign-in")).toBeLessThan(order.indexOf("approve_login_session"));
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "a-strong-password",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("approve_login_session", {
      p_user_id: userId,
      p_session_id: passwordSessionId,
      p_device_token_hash: expect.stringMatching(/^hashed:/),
    });
    expect(mocks.updateUserById).toHaveBeenCalledWith(userId, { password: "a-strong-password" });
    expect(mocks.setTrustedDeviceCookie).toHaveBeenCalledOnce();
  });

  it("does not approve a session when setting a recovered password fails", async () => {
    const { order } = configureAuth();
    mocks.updateUserById.mockImplementation(async () => {
      order.push("set-password");
      return { data: { user: null }, error: { status: 500, code: "server_error" } };
    });

    await expect(
      completeRecoveryOtp({
        email: "person@example.com",
        token: "123456",
        password: "a-strong-password",
        confirmPassword: "a-strong-password",
      }),
    ).resolves.toEqual({ ok: false, error: "passwordSetupFailed" });
    expect(order).toContain("consume_login_challenge");
    expect(order).not.toContain("approve_login_session");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.setTrustedDeviceCookie).not.toHaveBeenCalled();
  });

  it("does not approve a password session returned for a different user", async () => {
    configureAuth();
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "850e8400-e29b-41d4-a716-446655440000" },
        session: {
          access_token: pendingToken(passwordSessionId),
          refresh_token: "other-users-refresh-token",
        },
      },
      error: null,
    });

    await expect(
      completeRecoveryOtp({
        email: "person@example.com",
        token: "123456",
        password: "a-strong-password",
        confirmPassword: "a-strong-password",
      }),
    ).resolves.toEqual({ ok: false, error: "passwordSetupLoginFailed" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("approve_login_session", expect.anything());
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.setTrustedDeviceCookie).not.toHaveBeenCalled();
  });

  it("does not approve a fresh password session without the pending hook claims", async () => {
    configureAuth();
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: userId },
        session: {
          access_token: authToken({ sub: userId, session_id: passwordSessionId }),
          refresh_token: "unhooked-refresh-token",
        },
      },
      error: null,
    });

    await expect(
      completeRecoveryOtp({
        email: "person@example.com",
        token: "123456",
        password: "a-strong-password",
        confirmPassword: "a-strong-password",
      }),
    ).resolves.toEqual({ ok: false, error: "generic" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("approve_login_session", expect.anything());
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.setTrustedDeviceCookie).not.toHaveBeenCalled();
  });

  it("returns one recovery response without exposing whether the address exists", async () => {
    configureAuth();
    await expect(requestRecoveryOtp({ email: "unknown@example.com" })).resolves.toEqual({
      ok: true,
      data: { sent: true },
    });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("unknown@example.com");
  });
});
