import { describe, expect, it } from "vitest";

import { legacyPersonaForWorkMode, workModeFromProfile } from "./work-modes";

describe("work mode migration helpers", () => {
  it("prefers the V2 work_mode and falls back to legacy personas", () => {
    expect(workModeFromProfile("professional", "seller")).toBe("professional");
    expect(workModeFromProfile(null, "office")).toBe("professional");
    expect(workModeFromProfile(null, "creator")).toBeNull();
  });

  it("projects V2 modes to legacy active_persona values", () => {
    expect(legacyPersonaForWorkMode("seller")).toBe("seller");
    expect(legacyPersonaForWorkMode("professional")).toBe("office");
  });
});
