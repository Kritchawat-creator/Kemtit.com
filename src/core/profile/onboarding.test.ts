import { describe, expect, it } from "vitest";

import { nextRouteFor, safeInternalPath } from "./onboarding";

describe("nextRouteFor", () => {
  it("ไม่มี profile → login", () => {
    expect(nextRouteFor(null)).toBe("/login");
  });

  it("ผู้ใช้ใหม่ยังไม่เลือก role → role selection", () => {
    expect(
      nextRouteFor({
        role_code: null,
        focus_areas: [],
        onboarding_completed_at: null,
      }),
    ).toBe("/onboarding/persona");
  });

  it("เลือก role แล้วแต่ยังไม่เลือก focus → focus selection", () => {
    expect(
      nextRouteFor({
        role_code: "seller",
        focus_areas: [],
        onboarding_completed_at: null,
      }),
    ).toBe("/onboarding/focus");
  });

  it("เลือก role + focus แล้ว → Starter Workspace", () => {
    expect(
      nextRouteFor({
        role_code: "seller",
        focus_areas: ["work", "finance"],
        onboarding_completed_at: null,
      }),
    ).toBe("/onboarding/starter");
  });

  it("onboarding จบแล้ว → Today แม้เป็น legacy profile", () => {
    expect(
      nextRouteFor({
        active_persona: "seller",
        role_code: null,
        focus_areas: [],
        onboarding_completed_at: "2026-09-05T00:00:00Z",
      }),
    ).toBe("/today");
  });
});

describe("safeInternalPath", () => {
  it("รับเฉพาะ path ภายใน", () => {
    expect(safeInternalPath("/goals/1")).toBe("/goals/1");
    expect(safeInternalPath("https://evil.example")).toBeNull();
    expect(safeInternalPath("//evil.example")).toBeNull();
    expect(safeInternalPath("/api/cron/x")).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
  });
});
