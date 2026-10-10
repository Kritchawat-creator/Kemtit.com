import { NextResponse } from "next/server";

import { nextRouteFor, ROUTES, safeInternalPath } from "@/core/profile/onboarding";
import {
  claimsFromTrustedAuthResponse,
  isApprovedAuthResponse,
  pendingSessionIdFromAuthResponse,
} from "@/core/auth/login-security";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

function redirectToLogin(requestUrl: URL, next: string | null, error: string) {
  const login = new URL(ROUTES.login, requestUrl.origin);
  login.searchParams.set("error", error);
  const safeNext = safeInternalPath(next);
  if (safeNext) login.searchParams.set("next", safeNext);
  return NextResponse.redirect(login);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next");
  const providerError = requestUrl.searchParams.get("error");
  if (providerError) {
    return redirectToLogin(
      requestUrl,
      next,
      providerError === "access_denied" ? "googleAuthCancelled" : "googleAuthFailed",
    );
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) return redirectToLogin(requestUrl, next, "googleAuthFailed");

  const supabase = await createServerSupabase();
  const { data: exchange, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth] Google OAuth callback failed", { code: exchangeError.code });
    return redirectToLogin(requestUrl, next, "googleAuthFailed");
  }

  const { user, session } = exchange;
  const sessionId =
    user && session ? pendingSessionIdFromAuthResponse(session.access_token, user.id) : null;
  const amr = session ? claimsFromTrustedAuthResponse(session.access_token)?.amr : null;
  const hasGoogleOAuthMethod =
    Array.isArray(amr) &&
    amr.some((entry) =>
      typeof entry === "string"
        ? entry === "oauth"
        : Boolean(
            entry && typeof entry === "object" && "method" in entry && entry.method === "oauth",
          ),
    );

  if (
    !user ||
    !session ||
    !sessionId ||
    !user.identities?.some((identity) => identity.provider === "google") ||
    !hasGoogleOAuthMethod
  ) {
    console.error("[auth] Google OAuth callback did not produce a verified Google session");
    await supabase.auth.signOut({ scope: "local" });
    return redirectToLogin(requestUrl, next, "googleAuthFailed");
  }

  const admin = createAdminSupabase();
  const { data: approved, error: approvalError } = await admin.rpc("approve_login_session", {
    p_user_id: user.id,
    p_session_id: sessionId,
  });
  if (approvalError || !approved) {
    if (approvalError)
      console.error("[auth] Google session approval failed", {
        code: approvalError.code,
      });
    await supabase.auth.signOut({ scope: "local" });
    return redirectToLogin(requestUrl, next, "googleAuthFailed");
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
    refresh_token: session.refresh_token,
  });
  if (
    refreshError ||
    !refreshData.session ||
    !isApprovedAuthResponse(refreshData.session.access_token, user.id, sessionId)
  ) {
    if (refreshError)
      console.error("[auth] Google session refresh failed", {
        code: refreshError.code,
        status: refreshError.status,
      });
    await supabase.auth.signOut({ scope: "local" });
    return redirectToLogin(requestUrl, next, "googleAuthFailed");
  }

  const {
    data: { user: verifiedUser },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !verifiedUser || verifiedUser.id !== exchange.user?.id) {
    await supabase.auth.signOut({ scope: "local" });
    return redirectToLogin(requestUrl, next, "googleAuthFailed");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("active_persona, work_mode, role_code, focus_areas, onboarding_completed_at")
    .eq("id", verifiedUser.id)
    .maybeSingle();
  if (profileError) {
    console.error("[auth] Google profile lookup failed", {
      code: profileError.code,
    });
    await supabase.auth.signOut({ scope: "local" });
    return redirectToLogin(requestUrl, next, "googleAuthFailed");
  }
  const gate = nextRouteFor(profile);
  const destination = gate === ROUTES.dashboard ? (safeInternalPath(next) ?? gate) : gate;
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
