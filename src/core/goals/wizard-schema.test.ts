import { describe, expect, it } from "vitest";

import { goalWizardApplySchema, goalWizardSpecSchema } from "./wizard-schema";

const baseSpec = {
  title: "Plan a weekly study session",
  periodType: "month",
  periodStart: "2026-10-01",
  domain: "growth",
  goalKind: "execution",
  tasks: [{ title: "Choose a study topic", dueDate: "2026-10-10", domain: "growth" }],
};

describe("goal wizard schema", () => {
  it("accepts one canonical execution goal with one canonical first task", () => {
    expect(goalWizardSpecSchema.safeParse(baseSpec).success).toBe(true);
  });

  it.each([
    { ...baseSpec, periodStart: "2026-10-02" },
    { ...baseSpec, periodType: "week", periodStart: "2026-10-05" },
    { ...baseSpec, tasks: [] },
    { ...baseSpec, tasks: [...baseSpec.tasks, ...baseSpec.tasks] },
    { ...baseSpec, goalKind: "metric" },
  ])("rejects specs outside the bounded wizard contract", (spec) => {
    expect(goalWizardSpecSchema.safeParse(spec).success).toBe(false);
  });

  it("requires a valid operation ID for the persistent retry key", () => {
    expect(
      goalWizardApplySchema.safeParse({
        requestId: "not-a-uuid",
        spec: baseSpec,
      }).success,
    ).toBe(false);
  });
});
