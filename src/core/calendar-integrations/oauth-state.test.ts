import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createCalendarOAuthState, verifyCalendarOAuthState } from "./oauth-state";

describe("calendar OAuth state", () => {
  it("binds random state and PKCE verifier to the initiating user", () => {
    const created = createCalendarOAuthState("user-1");

    expect(created.challenge).toBe(
      createHash("sha256").update(created.verifier).digest("base64url"),
    );
    expect(verifyCalendarOAuthState(created.cookieValue, created.state, "user-1")).toEqual({
      verifier: created.verifier,
    });
  });

  it("rejects a different user, different state, or malformed cookie", () => {
    const created = createCalendarOAuthState("user-1");

    expect(verifyCalendarOAuthState(created.cookieValue, created.state, "user-2")).toBeNull();
    expect(verifyCalendarOAuthState(created.cookieValue, "x".repeat(43), "user-1")).toBeNull();
    expect(verifyCalendarOAuthState("not-base64-json", created.state, "user-1")).toBeNull();
    expect(verifyCalendarOAuthState(created.cookieValue, null, "user-1")).toBeNull();
  });
});
