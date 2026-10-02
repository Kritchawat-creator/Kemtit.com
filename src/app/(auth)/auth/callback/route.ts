import { NextResponse } from "next/server";

import { nextRouteFor, ROUTES, safeInternalPath } from "@/core/profile/onboarding";
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
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth] Google OAuth callback failed", { code: exchangeError.code });
    return redirectToLogin(requestUrl, next, "googleAuthFailed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectToLogin(requestUrl, next, "googleAuthFailed");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("active_persona, work_mode, role_code, focus_areas, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  const gate = nextRouteFor(profile);
  const destination = gate === ROUTES.dashboard ? safeInternalPath(next) ?? gate : gate;
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
