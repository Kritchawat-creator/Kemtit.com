import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_COOKIE_LENGTH = 2048;

type OAuthStateCookie = {
  version: 1;
  state: string;
  verifier: string;
  userId: string;
};

export type CalendarOAuthState = {
  state: string;
  verifier: string;
  challenge: string;
  cookieValue: string;
};

/** Creates independent CSRF state and PKCE verifier values bound to the starting user. */
export function createCalendarOAuthState(userId: string): CalendarOAuthState {
  if (typeof userId !== "string" || userId.length === 0 || userId.length > 128) {
    throw new Error("invalidOAuthUser");
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const payload: OAuthStateCookie = { version: 1, state, verifier, userId };

  return {
    state,
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
    cookieValue: Buffer.from(JSON.stringify(payload)).toString("base64url"),
  };
}

/** Returns the PKCE verifier only when the callback matches the browser state and same user. */
export function verifyCalendarOAuthState(
  cookieValue: string | undefined,
  queryState: string | null,
  userId: string,
): { verifier: string } | null {
  if (
    !cookieValue ||
    cookieValue.length > MAX_COOKIE_LENGTH ||
    !queryState ||
    !STATE_PATTERN.test(queryState) ||
    typeof userId !== "string" ||
    userId.length === 0 ||
    userId.length > 128
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cookieValue, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("version" in payload) ||
    payload.version !== 1 ||
    !("state" in payload) ||
    typeof payload.state !== "string" ||
    !STATE_PATTERN.test(payload.state) ||
    !("verifier" in payload) ||
    typeof payload.verifier !== "string" ||
    !STATE_PATTERN.test(payload.verifier) ||
    !("userId" in payload) ||
    payload.userId !== userId
  ) {
    return null;
  }

  const expected = Buffer.from(payload.state);
  const actual = Buffer.from(queryState);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return { verifier: payload.verifier };
}
