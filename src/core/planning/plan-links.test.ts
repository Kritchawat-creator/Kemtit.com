import { describe, expect, it } from "vitest";

import {
  buildGoalDetailHref,
  buildPlanContextHref,
  safePlanReturnHref,
  withPlanScope,
} from "./plan-links";

describe("Plan links", () => {
  it("preserves existing query values and sets the selected scope", () => {
    expect(withPlanScope("/plan?view=month&date=2026-10-01&new=goal", "life")).toBe(
      "/plan?view=month&date=2026-10-01&new=goal&scope=life",
    );
  });

  it("replaces a stale scope and preserves a fragment", () => {
    expect(withPlanScope("/calendar?view=day&scope=work#selected", "life")).toBe(
      "/calendar?view=day&scope=life#selected",
    );
  });

  it("can preselect a domain when opening goal creation", () => {
    expect(withPlanScope("/plan?new=goal", "life", "health")).toBe(
      "/plan?new=goal&scope=life&domain=health",
    );
  });

  it("builds a goal link that can return to the selected Plan period and scope", () => {
    const planHref = buildPlanContextHref("week", "2026-10-12", "life");
    const goalHref = buildGoalDetailHref("goal-1", planHref);
    const url = new URL(goalHref, "https://kemtit.local");

    expect(url.pathname).toBe("/goals/goal-1");
    expect(safePlanReturnHref(url.searchParams.get("returnTo"))).toBe(
      "/plan?view=week&date=2026-10-12&scope=life",
    );
  });

  it("rejects an external or malformed Plan return URL", () => {
    expect(
      safePlanReturnHref("https://evil.example/plan?view=week&date=2026-10-12&scope=life"),
    ).toBeNull();
    expect(safePlanReturnHref("/plan?view=week&date=bad&scope=life")).toBeNull();
    expect(safePlanReturnHref("/plan?view=week&view=month&date=2026-10-12&scope=life")).toBeNull();
  });
});
