import { describe, expect, it } from "vitest";

import { nextRouteFor, safeInternalPath } from "./onboarding";

describe("nextRouteFor", () => {
  it("ไม่มี profile → login", () => {
    expect(nextRouteFor(null)).toBe("/login");
  });
  it("ยังไม่เลือก persona → หน้าเลือก persona", () => {
    expect(nextRouteFor({ active_persona: null, onboarding_completed_at: null })).toBe("/onboarding/persona");
  });
  it("เลือก persona แล้วแต่ยังไม่มี goal แรก → first-goal", () => {
    expect(nextRouteFor({ active_persona: "seller", onboarding_completed_at: null })).toBe(
      "/onboarding/first-goal",
    );
  });
  it("onboarding จบ → dashboard", () => {
    expect(nextRouteFor({ active_persona: "seller", onboarding_completed_at: "2026-09-05T00:00:00Z" })).toBe(
      "/dashboard",
    );
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
