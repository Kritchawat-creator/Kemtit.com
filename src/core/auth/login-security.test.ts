import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  claimsFromTrustedAuthResponse,
  isApprovedAuthResponse,
  pendingSessionIdFromAuthResponse,
} from "./login-security";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const sessionId = "650e8400-e29b-41d4-a716-446655440000";
const pendingSub = "00000000-0000-0000-0000-000000000000";

function tokenFor(claims: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

function pendingClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: pendingSub,
    role: "kemtit_pending",
    session_id: sessionId,
    kemtit_claim_version: 1,
    kemtit_session_state: "pending",
    ...overrides,
  };
}

describe("trusted Auth response claims", () => {
  it("accepts only a versioned pending session claim from an Auth response", () => {
    expect(pendingSessionIdFromAuthResponse(tokenFor(pendingClaims()), userId)).toBe(sessionId);
    expect(pendingSessionIdFromAuthResponse("not-a-jwt", userId)).toBeNull();
    expect(pendingSessionIdFromAuthResponse(tokenFor(pendingClaims()), "")).toBeNull();
  });

  it.each([
    ["missing claim version", { kemtit_claim_version: undefined }],
    ["wrong claim version", { kemtit_claim_version: 2 }],
    ["wrong session state", { kemtit_session_state: "approved" }],
    ["wrong database role", { role: "authenticated" }],
    ["real user subject", { sub: userId }],
    ["invalid session id", { session_id: "not-a-uuid" }],
  ])("fails closed for %s", (_description, changes) => {
    expect(pendingSessionIdFromAuthResponse(tokenFor(pendingClaims(changes)), userId)).toBeNull();
  });

  it("requires the refreshed token to match the approved user and exact session", () => {
    const approved = tokenFor({
      sub: userId,
      role: "authenticated",
      session_id: sessionId,
      kemtit_claim_version: 1,
      kemtit_session_state: "approved",
    });
    expect(isApprovedAuthResponse(approved, userId, sessionId)).toBe(true);
    expect(isApprovedAuthResponse(approved, userId, "750e8400-e29b-41d4-a716-446655440000")).toBe(
      false,
    );
    expect(
      isApprovedAuthResponse(approved, "850e8400-e29b-41d4-a716-446655440000", sessionId),
    ).toBe(false);
    expect(
      isApprovedAuthResponse(
        tokenFor({
          sub: userId,
          role: "authenticated",
          session_id: sessionId,
          kemtit_claim_version: 1,
          kemtit_session_state: "pending",
        }),
        userId,
        sessionId,
      ),
    ).toBe(false);
  });

  it("returns no claims for malformed Auth responses", () => {
    expect(claimsFromTrustedAuthResponse("bad")).toBeNull();
    expect(claimsFromTrustedAuthResponse("header.bm90IGpzb24.signature")).toBeNull();
  });
});
