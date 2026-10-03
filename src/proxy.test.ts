import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("@/lib/env", () => ({
  getClientEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    NEXT_PUBLIC_APP_URL: "https://kemtit.example",
  }),
}));

import { proxy } from "./proxy";

function configureGetClaims(getClaims: () => unknown) {
  createServerClientMock.mockReturnValue({ auth: { getClaims } });
}

function request(pathname: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`https://kemtit.example${pathname}`, init);
}

describe("proxy auth failure handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects a confirmed signed-out request to login", async () => {
    configureGetClaims(async () => ({
      data: { claims: null },
      error: new AuthSessionMissingError(),
    }));

    const response = await proxy(request("/today"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Ftoday");
  });

  it("allows a confirmed signed-out user to open registration", async () => {
    configureGetClaims(async () => ({
      data: { claims: null },
      error: new AuthSessionMissingError(),
    }));

    const response = await proxy(request("/register"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it.each([
    [
      "returned retryable fetch failure",
      () => async () => ({
        data: { claims: null },
        error: new AuthRetryableFetchError("private fetch detail", 503),
      }),
    ],
    [
      "thrown retryable fetch failure",
      () => async () => {
        throw new AuthRetryableFetchError("private fetch detail", 503);
      },
    ],
    [
      "returned server API failure",
      () => async () => ({
        data: { claims: null },
        error: new AuthApiError("private server detail", 503, "server_error"),
      }),
    ],
    [
      "thrown server API failure",
      () => async () => {
        throw new AuthApiError("private server detail", 503, "server_error");
      },
    ],
  ])("lets protected-page getMe handle a %s", async (_name, makeGetClaims) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    configureGetClaims(makeGetClaims());

    const response = await proxy(request("/today"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(log.mock.calls.flat().join(" ")).not.toContain("private");
  });

  it("does not create a login redirect loop while auth is unavailable", async () => {
    configureGetClaims(async () => ({
      data: { claims: null },
      error: new AuthRetryableFetchError("private fetch detail", 503),
    }));

    const response = await proxy(request("/login"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the normal redirect from login for a validated user", async () => {
    configureGetClaims(async () => ({ data: { claims: { sub: "user-1" } }, error: null }));

    const response = await proxy(request("/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/today");
  });

  it("redirects a validated user away from registration", async () => {
    configureGetClaims(async () => ({ data: { claims: { sub: "user-1" } }, error: null }));

    const response = await proxy(request("/register"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/today");
  });

  it("allows an authenticated registration Server Action to save the verified user's name", async () => {
    configureGetClaims(async () => ({ data: { claims: { sub: "user-1" } }, error: null }));

    const response = await proxy(
      request("/register", { method: "POST", headers: { "Next-Action": "save-profile" } }),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps redirecting an authenticated plain POST from registration", async () => {
    configureGetClaims(async () => ({ data: { claims: { sub: "user-1" } }, error: null }));

    const response = await proxy(request("/register", { method: "POST" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/today");
  });

  it("still gates a signed-out protected Server Action POST", async () => {
    configureGetClaims(async () => ({
      data: { claims: null },
      error: new AuthSessionMissingError(),
    }));

    const response = await proxy(
      request("/today", { method: "POST", headers: { "Next-Action": "protected-action" } }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?next=%2Ftoday");
  });
});
