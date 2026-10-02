import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";
import { createCalendarOAuthState } from "@/core/calendar-integrations/oauth-state";
import { isCalendarProviderFailure } from "@/core/calendar-integrations/provider-http";
import { getCalendarProvider } from "@/core/calendar-integrations/providers";
import type { CalendarProviderName } from "@/core/calendar-integrations/provider";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ provider: string }> };

function parseProvider(value: string): CalendarProviderName | null {
  return value === "google" || value === "outlook" ? value : null;
}

function settingsRedirect(request: NextRequest, status: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("calendar", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const providerName = parseProvider((await context.params).provider);
  if (!providerName) return settingsRedirect(request, "not-configured");

  const supabase = await createServerSupabase();
  let authError: unknown = null;
  let user: { id: string } | null = null;
  try {
    const result = await supabase.auth.getUser();
    authError = result.error;
    user = result.data.user;
  } catch (error) {
    authError = error;
  }

  if (authError && !isUnauthenticatedAuthError(authError)) {
    console.error("[calendar-oauth] connect auth check failed", authFailureContext(authError));
    return settingsRedirect(request, "connect-error");
  }
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=%2Fsettings", request.url));
  }

  try {
    const oauthState = createCalendarOAuthState(user.id);
    const authorizationUrl = getCalendarProvider(providerName).buildAuthorizationUrl(
      oauthState.state,
      oauthState.challenge,
    );
    const cookieStore = await cookies();
    cookieStore.set(`kemtit-calendar-oauth-${providerName}`, oauthState.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const code = isCalendarProviderFailure(error) ? error.code : "unknown";
    console.error("[calendar-oauth] connect failed", { provider: providerName, code });
    return settingsRedirect(
      request,
      isCalendarProviderFailure(error) && error.code === "configuration"
        ? "not-configured"
        : "connect-error",
    );
  }
}
