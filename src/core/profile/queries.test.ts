import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, signPhotoUrlsMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  signPhotoUrlsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));
vi.mock("@/core/photos/queries", () => ({
  signPhotoUrls: signPhotoUrlsMock,
}));

import { getMe } from "./queries";

function configureSupabase(getUser: () => unknown, profile: Record<string, unknown> | null = null) {
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  createServerSupabaseMock.mockResolvedValue({
    auth: { getUser },
    from: vi.fn(() => profileQuery),
  });
}

describe("getMe auth verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signPhotoUrlsMock.mockResolvedValue(new Map());
  });

  it("returns null when there is no authenticated user", async () => {
    configureSupabase(async () => ({ data: { user: null }, error: null }));

    await expect(getMe()).resolves.toBeNull();
  });

  it("returns null for a confirmed missing or invalid session", async () => {
    for (const error of [
      new AuthSessionMissingError(),
      new AuthApiError("invalid session", 401, "bad_jwt"),
    ]) {
      configureSupabase(async () => ({ data: { user: null }, error }));
      await expect(getMe()).resolves.toBeNull();
    }
  });

  it("returns the profile after successful server-side auth verification", async () => {
    const profile = { id: "user-1", avatar_path: null };
    configureSupabase(
      async () => ({ data: { user: { id: "user-1", email: "user@example.com" } }, error: null }),
      profile,
    );

    await expect(getMe()).resolves.toMatchObject({
      userId: "user-1",
      email: "user@example.com",
      profile,
    });
  });

  it.each([
    ["retryable fetch failure", () => new AuthRetryableFetchError("private fetch detail", 503)],
    ["server API failure", () => new AuthApiError("private server detail", 503, "server_error")],
  ])("does not treat a returned %s as sign-out", async (_name, makeError) => {
    const error = makeError();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    configureSupabase(async () => ({ data: { user: null }, error }));

    await expect(getMe()).rejects.toMatchObject({ message: "authUnavailable" });
    expect(log).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("private"));
  });

  it.each([
    ["retryable fetch failure", () => new AuthRetryableFetchError("private fetch detail", 503)],
    ["server API failure", () => new AuthApiError("private server detail", 503, "server_error")],
  ])("does not treat a thrown %s as sign-out", async (_name, makeError) => {
    const error = makeError();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    configureSupabase(async () => {
      throw error;
    });

    await expect(getMe()).rejects.toMatchObject({ message: "authUnavailable" });
    expect(log).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining("private"));
  });
});
