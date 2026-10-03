import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { verifyOtp } from "./actions";

const userId = "550e8400-e29b-41d4-a716-446655440000";

function configureSupabase(profile: Record<string, unknown> | null) {
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);

  const verifyOtpMock = vi.fn().mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  const supabase = {
    auth: { verifyOtp: verifyOtpMock },
    from: vi.fn().mockReturnValue(profileQuery),
  };
  createServerSupabaseMock.mockResolvedValue(supabase);
  return { profileQuery, verifyOtpMock, supabase };
}

describe("verifyOtp onboarding result", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not treat a completed member as new when they requested an onboarding URL", async () => {
    const { profileQuery } = configureSupabase({
      onboarding_completed_at: "2026-09-25T12:00:00.000Z",
    });

    await expect(
      verifyOtp({
        email: "member@example.com",
        token: "123456",
        next: "/onboarding/persona",
      }),
    ).resolves.toEqual({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: false },
    });
    expect(profileQuery.select).toHaveBeenCalledWith(
      "active_persona, work_mode, role_code, focus_areas, onboarding_completed_at",
    );
  });

  it("marks a new member for onboarding even when their requested next route is Today", async () => {
    configureSupabase({
      onboarding_completed_at: null,
      role_code: null,
      focus_areas: [],
    });

    await expect(
      verifyOtp({ email: "new-member@example.com", token: "123456", next: "/today" }),
    ).resolves.toEqual({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: true },
    });
  });
});
