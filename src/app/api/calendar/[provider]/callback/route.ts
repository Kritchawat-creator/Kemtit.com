import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";
import {
  ExternalCalendarServiceError,
  persistExternalCalendarConnection,
  syncExternalCalendar,
} from "@/core/calendar-integrations/service";
import { isCalendarProviderFailure } from "@/core/calendar-integrations/provider-http";
import { getCalendarProvider } from "@/core/calendar-integrations/providers";
import type { CalendarProviderName } from "@/core/calendar-integrations/provider";
import { verifyCalendarOAuthState } from "@/core/calendar-integrations/oauth-state";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ provider: string }> };

function parseProvider(value: string): CalendarProviderName | null {
  return value === "google" || value === "outlook" ? value : null;
}

function settingsRedirect(request: NextRequest, status: string, returnPath = "/settings") {
  const url = new URL(returnPath, request.url);
  url.searchParams.set("calendar", status);
  return NextResponse.redirect(url);
}

function safeFailureCode(error: unknown): string {
  if (error instanceof ExternalCalendarServiceError) return error.code;
  if (isCalendarProviderFailure(error)) return error.code;
  return "unknown";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const providerName = parseProvider((await context.params).provider);
  if (!providerName) return settingsRedirect(request, "connect-error");

  const cookieStore = await cookies();
  const cookieName = `kemtit-calendar-oauth-${providerName}`;
  const cookieValue = cookieStore.get(cookieName)?.value;
  const queryState = request.nextUrl.searchParams.get("state");

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

  cookieStore.delete(cookieName);
  if (authError && !isUnauthenticatedAuthError(authError)) {
    console.error("[calendar-oauth] callback auth check failed", authFailureContext(authError));
    return settingsRedirect(request, "connect-error");
  }
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=%2Fsettings", request.url));
  }

  let returnPath = "/settings";
  try {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[calendar-oauth] onboarding return-path lookup failed", { code: error.code });
    } else if (!profile?.onboarding_completed_at) {
      returnPath = "/onboarding/starter";
    }
  } catch {
    // Keep the Settings fallback if profile lookup is temporarily unavailable.
  }

  const verifiedState = verifyCalendarOAuthState(cookieValue, queryState, user.id);
  if (!verifiedState) return settingsRedirect(request, "invalid-state", returnPath);

  if (request.nextUrl.searchParams.has("error")) {
    return settingsRedirect(request, "cancelled", returnPath);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 8192) return settingsRedirect(request, "connect-error", returnPath);

  try {
    const provider = getCalendarProvider(providerName);
    const tokens = await provider.exchangeCode(code, verifiedState.verifier);
    const account = await provider.getAccount(tokens.accessToken);
    const connectionId = await persistExternalCalendarConnection({
      userId: user.id,
      provider: providerName,
      account,
      tokens,
    });

    try {
      await syncExternalCalendar(user.id, connectionId);
      return settingsRedirect(request, "connected", returnPath);
    } catch (error) {
      console.error("[calendar-oauth] initial sync failed", {
        provider: providerName,
        code: safeFailureCode(error),
      });
      return settingsRedirect(request, "sync-error", returnPath);
    }
  } catch (error) {
    const code = safeFailureCode(error);
    console.error("[calendar-oauth] callback failed", { provider: providerName, code });
    return settingsRedirect(
      request,
      code === "configuration" ? "not-configured" : "connect-error",
      returnPath,
    );
  }
}
