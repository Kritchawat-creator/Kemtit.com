"use server";

import { redirect } from "next/navigation";
import { getClientEnv } from "@/lib/env";

import { nextRouteFor, ROUTES, safeInternalPath } from "@/core/profile/onboarding";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  emailSchema,
  googleSignInSchema,
  otpSchema,
  passwordSetupSchema,
  passwordSignInSchema,
  resendChallengeSchema,
  type OtpInput,
} from "./schema";
import {
  clearAllChallengeCookies,
  clearChallengeCookie,
  createOpaqueToken,
  getChallengeCookie,
  getTrustedDeviceCookie,
  hashTokenAsBytea,
  isApprovedAuthResponse,
  pendingSessionIdFromAuthResponse,
  setChallengeCookie,
  setTrustedDeviceCookie,
  type LoginChallengePurpose,
} from "./login-security";

type AuthCompletion = { next: string; onboardingRequired: boolean };
type PasswordSignInResult = { mode: "challenge" } | ({ mode: "authenticated" } & AuthCompletion);

function logAuthFailure(area: string, error: { code?: string; status?: number }) {
  console.error(`[auth] ${area} failed`, { code: error.code, status: error.status });
}

function mapSendError(error: { code?: string; status?: number; message: string }) {
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  ) {
    return "otpRateLimited";
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed")
    return "invalidEmail";
  logAuthFailure("email OTP request", error);
  return "generic";
}

function mapSignInError(error: { code?: string; status?: number }) {
  if (error.status === 429 || error.code === "over_request_rate_limit") return "authRateLimited";
  return "invalidCredentials";
}

async function finishApprovedSession(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  expectedSessionId: string,
  refreshToken: string,
  nextInput?: string,
): Promise<AuthCompletion | null> {
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (refreshError || !refreshData.session) {
    if (refreshError) logAuthFailure("approved session refresh", refreshError);
    return null;
  }

  if (!isApprovedAuthResponse(refreshData.session.access_token, userId, expectedSessionId)) {
    console.error("[auth] refreshed claims did not match the approved session");
    return null;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user || user.id !== userId) {
    if (userError) logAuthFailure("approved session verification", userError);
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("active_persona, work_mode, role_code, focus_areas, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    logAuthFailure("approved profile lookup", profileError);
    return null;
  }

  const gate = profile ? nextRouteFor(profile) : ROUTES.persona;
  const requested = safeInternalPath(nextInput);
  const next = gate === ROUTES.dashboard && requested ? requested : gate;
  return { next, onboardingRequired: gate !== ROUTES.dashboard };
}

async function beginChallenge(
  email: string,
  purpose: LoginChallengePurpose,
  options: { userId?: string; preauthSessionId?: string } = {},
) {
  const challengeToken = createOpaqueToken();
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("begin_login_challenge", {
    p_token_hash: hashTokenAsBytea(challengeToken),
    p_email: email,
    p_purpose: purpose,
    p_user_id: options.userId ?? null,
    p_preauth_session_id: options.preauthSessionId ?? null,
  });
  if (error) {
    logAuthFailure("challenge creation", error);
    return { token: null, error: "generic" } as const;
  }
  if (!data) return { token: null, error: "otpRateLimited" } as const;

  await clearAllChallengeCookies();
  await setChallengeCookie(purpose, challengeToken);
  return { token: challengeToken, error: null } as const;
}

async function sendOtpForPurpose(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  email: string,
  purpose: LoginChallengePurpose,
  shouldCreateUser = false,
) {
  if (purpose === "recovery") {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return error;
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser },
  });
  return error;
}

async function sendInitialChallenge(
  email: string,
  purpose: LoginChallengePurpose,
  options: {
    userId?: string;
    preauthSessionId?: string;
    shouldCreateUser?: boolean;
    supabase?: Awaited<ReturnType<typeof createServerSupabase>>;
  } = {},
): Promise<ActionResult<{ sent: true }>> {
  const challenge = await beginChallenge(email, purpose, options);
  if (challenge.error) return fail(challenge.error);

  const supabase = options.supabase ?? (await createServerSupabase());
  const error = await sendOtpForPurpose(
    supabase,
    email,
    purpose,
    options.shouldCreateUser ?? false,
  );
  if (error) {
    await clearChallengeCookie(purpose);
    return fail(mapSendError(error));
  }
  return ok({ sent: true });
}

async function approveAndFinish(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  sessionId: string,
  refreshToken: string,
  next?: string,
) {
  const deviceToken = createOpaqueToken();
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("approve_login_session", {
    p_user_id: userId,
    p_session_id: sessionId,
    p_device_token_hash: hashTokenAsBytea(deviceToken),
  });
  if (error || !data) {
    if (error) logAuthFailure("session approval", error);
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  const completion = await finishApprovedSession(supabase, userId, sessionId, refreshToken, next);
  if (!completion) {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }
  await setTrustedDeviceCookie(deviceToken);
  await clearAllChallengeCookies();
  return completion;
}

async function completeChallenge(
  input: OtpInput,
  purpose: LoginChallengePurpose,
  password?: string,
) {
  const challengeToken = await getChallengeCookie(purpose);
  if (!challengeToken) return fail("otpInvalid");

  const admin = createAdminSupabase();
  const { data: attempts, error: attemptError } = await admin.rpc(
    "reserve_login_challenge_attempt",
    {
      p_token_hash: hashTokenAsBytea(challengeToken),
      p_email: input.email,
      p_purpose: purpose,
    },
  );
  if (attemptError) {
    logAuthFailure("challenge attempt reservation", attemptError);
    return fail("generic");
  }
  if (!attempts) return fail("otpInvalid");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: input.email,
    token: input.token,
    type: purpose === "recovery" ? "recovery" : "email",
  });
  if (error || !data.user || !data.session) return fail("otpInvalid");

  const sessionId = pendingSessionIdFromAuthResponse(data.session.access_token, data.user.id);
  if (!sessionId) {
    await supabase.auth.signOut({ scope: "local" });
    await clearAllChallengeCookies();
    return fail("otpInvalid");
  }

  const { data: consumed, error: consumeError } = await admin.rpc("consume_login_challenge", {
    p_token_hash: hashTokenAsBytea(challengeToken),
    p_user_id: data.user.id,
    p_session_id: sessionId,
    p_purpose: purpose,
  });
  if (consumeError || !consumed) {
    if (consumeError) logAuthFailure("challenge consumption", consumeError);
    await supabase.auth.signOut({ scope: "local" });
    return fail("otpInvalid");
  }

  if (password !== undefined) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(data.user.id, {
      password,
    });
    if (passwordError) {
      logAuthFailure("verified password setup", passwordError);
      await supabase.auth.signOut({ scope: "local" });
      await clearChallengeCookie(purpose);
      return fail("passwordSetupFailed");
    }

    // Updating a password revokes the OTP-created session. Authenticate again
    // with the new password, then approve only that fresh session.
    const { data: passwordSignIn, error: passwordSignInError } =
      await supabase.auth.signInWithPassword({ email: input.email, password });
    if (
      passwordSignInError ||
      !passwordSignIn.user ||
      passwordSignIn.user.id !== data.user.id ||
      !passwordSignIn.session
    ) {
      if (passwordSignInError) logAuthFailure("verified password sign-in", passwordSignInError);
      await supabase.auth.signOut({ scope: "local" });
      await clearChallengeCookie(purpose);
      return fail("passwordSetupLoginFailed");
    }

    const passwordSessionId = pendingSessionIdFromAuthResponse(
      passwordSignIn.session.access_token,
      passwordSignIn.user.id,
    );
    if (!passwordSessionId) {
      await supabase.auth.signOut({ scope: "local" });
      await clearChallengeCookie(purpose);
      return fail("generic");
    }

    const result = await approveAndFinish(
      supabase,
      passwordSignIn.user.id,
      passwordSessionId,
      passwordSignIn.session.refresh_token,
      input.next,
    );
    if (!result) {
      await clearChallengeCookie(purpose);
      return fail("generic");
    }
    return ok(result);
  }

  const result = await approveAndFinish(
    supabase,
    data.user.id,
    sessionId,
    data.session.refresh_token,
    input.next,
  );
  if (!result) {
    await clearChallengeCookie(purpose);
    return fail("generic");
  }
  return ok(result);
}

/** Verify the password first; an unfamiliar browser receives email OTP only after it is correct. */
export async function signInWithPassword(
  input: unknown,
): Promise<ActionResult<PasswordSignInResult>> {
  const parsed = passwordSignInSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user || !data.session) {
    return fail(error ? mapSignInError(error) : "invalidCredentials");
  }

  const sessionId = pendingSessionIdFromAuthResponse(data.session.access_token, data.user.id);
  if (!sessionId) {
    await supabase.auth.signOut({ scope: "local" });
    return fail("generic");
  }

  const trustedToken = await getTrustedDeviceCookie();
  if (trustedToken) {
    const admin = createAdminSupabase();
    const { data: trusted, error: trustedError } = await admin.rpc(
      "approve_trusted_device_session",
      {
        p_user_id: data.user.id,
        p_session_id: sessionId,
        p_device_token_hash: hashTokenAsBytea(trustedToken),
      },
    );
    if (trustedError) logAuthFailure("trusted device check", trustedError);
    if (trusted) {
      const completion = await finishApprovedSession(
        supabase,
        data.user.id,
        sessionId,
        data.session.refresh_token,
        parsed.data.next,
      );
      if (!completion) {
        await supabase.auth.signOut({ scope: "local" });
        return fail("generic");
      }
      await clearAllChallengeCookies();
      return ok({ mode: "authenticated", ...completion });
    }
  }

  const challenge = await sendInitialChallenge(parsed.data.email, "login", {
    userId: data.user.id,
    preauthSessionId: sessionId,
    supabase,
  });
  if (!challenge.ok) {
    await supabase.auth.signOut({ scope: "local" });
    await clearAllChallengeCookies();
    return challenge;
  }
  return ok({ mode: "challenge" });
}

/** Start the login-only OTP step after a successful password check. */
export async function verifyLoginOtp(input: unknown): Promise<ActionResult<AuthCompletion>> {
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  return completeChallenge(parsed.data, "login");
}

export async function resendEmailOtp(input: unknown): Promise<ActionResult<{ sent: true }>> {
  const parsed = resendChallengeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const challengeToken = await getChallengeCookie(parsed.data.purpose);
  if (!challengeToken) return fail("otpInvalid");

  const admin = createAdminSupabase();
  const { data: reserved, error: reserveError } = await admin.rpc(
    "reserve_login_challenge_resend",
    {
      p_token_hash: hashTokenAsBytea(challengeToken),
      p_email: parsed.data.email,
      p_purpose: parsed.data.purpose,
    },
  );
  if (reserveError) {
    logAuthFailure("challenge resend reservation", reserveError);
    return fail("generic");
  }
  if (!reserved) return fail("otpRateLimited");

  const supabase = await createServerSupabase();
  const error = await sendOtpForPurpose(
    supabase,
    parsed.data.email,
    parsed.data.purpose,
    parsed.data.purpose === "signup",
  );
  if (error) return fail(mapSendError(error));
  return ok({ sent: true });
}

export async function requestRegistrationOtp(
  input: unknown,
): Promise<ActionResult<{ sent: true }>> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  return sendInitialChallenge(parsed.data.email, "signup", { shouldCreateUser: true });
}

export async function completeRegistrationOtp(
  input: unknown,
): Promise<ActionResult<AuthCompletion>> {
  const parsed = passwordSetupSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  return completeChallenge(parsed.data, "signup", parsed.data.password);
}

export async function requestRecoveryOtp(input: unknown): Promise<ActionResult<{ sent: true }>> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const result = await sendInitialChallenge(parsed.data.email, "recovery");
  // Keep the same visible response for existing and unknown emails.
  return result;
}

export async function completeRecoveryOtp(input: unknown): Promise<ActionResult<AuthCompletion>> {
  const parsed = passwordSetupSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  return completeChallenge(parsed.data, "recovery", parsed.data.password);
}

/** Start Google sign-in only. Calendar access is a separate opt-in integration. */
export async function startGoogleSignIn(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = googleSignInSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const destination = safeInternalPath(parsed.data.next) ?? ROUTES.dashboard;
  const { NEXT_PUBLIC_APP_URL: appUrl } = getClientEnv();
  const callback = new URL("/auth/callback", appUrl);
  callback.searchParams.set("next", destination);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
  if (error || !data.url) {
    if (error) logAuthFailure("Google OAuth start", error);
    return fail("googleAuthFailed");
  }
  return ok({ url: data.url });
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
