import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;

type TestSessionClaims = {
  role?: unknown;
  sub?: unknown;
  session_id?: unknown;
  kemtit_claim_version?: unknown;
  kemtit_session_state?: unknown;
};

function claimsFromAuthResponse(accessToken: string): TestSessionClaims {
  const payload = accessToken.split(".")[1];
  if (!payload) throw new Error("Auth response did not include a JWT payload");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TestSessionClaims;
}

/**
 * Authenticated fixture for RLS integration tests. Dedicated pending-session
 * tests must sign in directly and deliberately avoid this helper.
 */
export async function signInAndApproveFixtureSession(
  client: DbClient,
  admin: DbClient,
  credentials: { email: string; password: string; userId: string },
) {
  const { data, error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error || !data.user || !data.session) {
    throw error ?? new Error("Fixture password sign-in did not return a session");
  }
  if (data.user.id !== credentials.userId) throw new Error("Fixture sign-in returned another user");

  const pendingClaims = claimsFromAuthResponse(data.session.access_token);
  if (
    pendingClaims.role !== "kemtit_pending" ||
    pendingClaims.sub !== "00000000-0000-0000-0000-000000000000" ||
    pendingClaims.kemtit_claim_version !== 1 ||
    pendingClaims.kemtit_session_state !== "pending" ||
    typeof pendingClaims.session_id !== "string"
  ) {
    throw new Error("Fixture sign-in did not produce a pending session");
  }

  const { data: approved, error: approvalError } = await admin.rpc("approve_login_session", {
    p_user_id: credentials.userId,
    p_session_id: pendingClaims.session_id,
  });
  if (approvalError || !approved) {
    throw approvalError ?? new Error("Fixture session approval failed");
  }

  const { data: refreshed, error: refreshError } = await client.auth.refreshSession({
    refresh_token: data.session.refresh_token,
  });
  if (refreshError || !refreshed.session) {
    throw refreshError ?? new Error("Approved fixture session could not refresh");
  }

  const approvedClaims = claimsFromAuthResponse(refreshed.session.access_token);
  if (
    approvedClaims.role !== "authenticated" ||
    approvedClaims.sub !== credentials.userId ||
    approvedClaims.kemtit_claim_version !== 1 ||
    approvedClaims.kemtit_session_state !== "approved" ||
    approvedClaims.session_id !== pendingClaims.session_id
  ) {
    throw new Error("Fixture refresh did not restore the approved user session");
  }

  return { user: data.user, session: refreshed.session };
}
