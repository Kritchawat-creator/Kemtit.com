import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export type LoginChallengePurpose = "login" | "signup" | "recovery";

export type TrustedAuthClaims = {
  sub?: unknown;
  role?: unknown;
  session_id?: unknown;
  kemtit_claim_version?: unknown;
  kemtit_session_state?: unknown;
  amr?: unknown;
  app_metadata?: unknown;
  [key: string]: unknown;
};

const challengeCookieNames: Record<LoginChallengePurpose, string> = {
  login: "kemtit_login_challenge",
  signup: "kemtit_signup_challenge",
  recovery: "kemtit_recovery_challenge",
};
const trustedDeviceCookieName = "kemtit_trusted_device";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashTokenAsBytea(token: string) {
  const hash = createHash("sha256").update(token, "utf8").digest("hex");
  return `\\x${hash}`;
}

/**
 * Read claims only from a token in a successful Auth HTTP response. This is
 * intentionally not used on cookie/session data supplied by a browser.
 */
export function claimsFromTrustedAuthResponse(accessToken: string): TrustedAuthClaims | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const claims: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;
    return claims as TrustedAuthClaims;
  } catch {
    return null;
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function pendingSessionIdFromAuthResponse(accessToken: string, userId: string) {
  const claims = claimsFromTrustedAuthResponse(accessToken);
  if (
    !claims ||
    claims.kemtit_claim_version !== 1 ||
    claims.kemtit_session_state !== "pending" ||
    claims.role !== "kemtit_pending" ||
    claims.sub !== "00000000-0000-0000-0000-000000000000" ||
    typeof claims.session_id !== "string" ||
    !uuidPattern.test(claims.session_id) ||
    !userId
  ) {
    return null;
  }
  return claims.session_id;
}

export function isApprovedAuthResponse(
  accessToken: string,
  userId: string,
  expectedSessionId: string,
) {
  const claims = claimsFromTrustedAuthResponse(accessToken);
  return Boolean(
    claims &&
    claims.kemtit_claim_version === 1 &&
    claims.kemtit_session_state === "approved" &&
    claims.role === "authenticated" &&
    claims.sub === userId &&
    claims.session_id === expectedSessionId,
  );
}

export async function setChallengeCookie(purpose: LoginChallengePurpose, token: string) {
  const cookieStore = await cookies();
  cookieStore.set(challengeCookieNames[purpose], token, cookieOptions(10 * 60));
}

export async function getChallengeCookie(purpose: LoginChallengePurpose) {
  const cookieStore = await cookies();
  return cookieStore.get(challengeCookieNames[purpose])?.value ?? null;
}

export async function clearChallengeCookie(purpose: LoginChallengePurpose) {
  const cookieStore = await cookies();
  cookieStore.set(challengeCookieNames[purpose], "", cookieOptions(0));
}

export async function clearAllChallengeCookies() {
  await Promise.all(
    (Object.keys(challengeCookieNames) as LoginChallengePurpose[]).map(clearChallengeCookie),
  );
}

export async function getTrustedDeviceCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(trustedDeviceCookieName)?.value ?? null;
}

export async function setTrustedDeviceCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(trustedDeviceCookieName, token, cookieOptions(30 * 24 * 60 * 60));
}
