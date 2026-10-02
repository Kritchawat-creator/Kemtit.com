import {
  isAuthApiError,
  isAuthError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";

const INVALID_SESSION_CODES = new Set([
  "bad_jwt",
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "user_not_found",
]);

/** True only when Supabase has confirmed that the current session is absent or invalid. */
export function isUnauthenticatedAuthError(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  if (!isAuthApiError(error)) return false;
  return error.status === 401 || (error.code != null && INVALID_SESSION_CODES.has(error.code));
}

/** Safe context for auth failure logs; never includes a message, token, or payload. */
export function authFailureContext(error: unknown): { code: string; status?: number } {
  if (!isAuthError(error)) return { code: "unknown" };
  return {
    code: error.code ?? "unknown",
    ...(typeof error.status === "number" ? { status: error.status } : {}),
  };
}
