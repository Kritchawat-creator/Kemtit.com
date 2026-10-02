import "server-only";

import { getGoogleCalendarEnv } from "@/lib/env.server";

import {
  disconnectExternalCalendar,
  persistExternalCalendarConnection,
  syncExternalCalendar,
} from "./service";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

/** Legacy readonly scope list retained for existing Google callback consumers. */
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events.readonly",
] as const;

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
};

export type GoogleUserInfo = {
  sub: string;
  email?: string;
};

/** Compatibility helper; new OAuth routes use the PKCE-aware provider adapter. */
export function buildGoogleAuthorizationUrl(state: string): string {
  const env = getGoogleCalendarEnv();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

/** Compatibility helper for callers that have not migrated to PKCE yet. */
export async function exchangeGoogleAuthorizationCode(code: string): Promise<GoogleTokenResponse> {
  const env = getGoogleCalendarEnv();
  const body = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`googleTokenExchangeFailed:${response.status}`);
  return (await response.json()) as GoogleTokenResponse;
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`googleUserInfoFailed:${response.status}`);
  return (await response.json()) as GoogleUserInfo;
}

/** Compatibility wrapper; credentials are encrypted and persisted by the shared RPC. */
export async function persistGoogleConnection(input: {
  userId: string;
  account: GoogleUserInfo;
  tokens: GoogleTokenResponse;
}): Promise<string> {
  if (!Number.isFinite(input.tokens.expires_in) || input.tokens.expires_in <= 0) {
    throw new Error("googleTokenResponseInvalid");
  }
  return persistExternalCalendarConnection({
    userId: input.userId,
    provider: "google",
    account: {
      providerAccountId: input.account.sub,
      label: input.account.email ?? null,
    },
    tokens: {
      accessToken: input.tokens.access_token,
      expiresAt: new Date(Date.now() + Math.max(60, input.tokens.expires_in - 60) * 1000).toISOString(),
      ...(input.tokens.refresh_token ? { refreshToken: input.tokens.refresh_token } : {}),
      scopes: input.tokens.scope?.split(/\s+/).filter(Boolean) ?? [],
    },
  });
}

/** Legacy Google API now dispatches through the provider-neutral sync service. */
export async function syncGoogleCalendar(userId: string, connectionId: string): Promise<number> {
  return syncExternalCalendar(userId, connectionId);
}

/** Legacy Google API now uses the atomic provider-neutral disconnect RPC. */
export async function disconnectGoogleCalendar(userId: string, connectionId: string): Promise<void> {
  return disconnectExternalCalendar(userId, connectionId);
}
