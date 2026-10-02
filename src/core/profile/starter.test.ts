import { describe, expect, it } from "vitest";

import { getStarterSuggestions } from "./starter";

describe("getStarterSuggestions", () => {
  it("returns prepared suggestions only and does not manufacture USER records", () => {
    const suggestions = getStarterSuggestions("employee", ["work", "health"]);

    expect(suggestions).toHaveLength(3);
    expect(suggestions.every((item) => item.origin === "SUGGESTED")).toBe(true);
    expect(suggestions.map((item) => item.copyKey)).toEqual([
      "employeeGoal",
      "workPriority",
      "healthRoutine",
    ]);
  });

  it("uses role + focus configuration without duplicate suggestion ids", () => {
    const suggestions = getStarterSuggestions("seller", ["work", "finance", "health"]);
    expect(new Set(suggestions.map((item) => item.id)).size).toBe(suggestions.length);
    expect(suggestions.some((item) => item.copyKey === "sellerGoal")).toBe(true);
    expect(suggestions.some((item) => item.copyKey === "financeBudget")).toBe(true);
  });
});
