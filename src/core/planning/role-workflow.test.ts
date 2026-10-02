import { describe, expect, it } from "vitest";

import englishMessages from "@/messages/en.json";
import thaiMessages from "@/messages/th.json";
import { ROLE_CODES } from "@/core/profile/roles";
import { plannerPeriod } from "./planner";
import {
  buildPlannerGoalHref,
  buildWorkflowNavigationLinks,
  getRoleWorkflow,
  resolveWorkflowRole,
  WORKFLOW_HORIZONS,
} from "./role-workflow";

function readMessagePath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

describe("role workflow configuration", () => {
  it.each(ROLE_CODES.flatMap((role) =>
    WORKFLOW_HORIZONS.map((horizon) => [role, horizon] as const),
  ))("provides three localized, ordered steps for %s at %s horizon", (role, horizon) => {
    const workflow = getRoleWorkflow(role, horizon);

    expect(workflow).toMatchObject({ role, horizon });
    expect(workflow.steps).toEqual([
      "steps." + role + "." + horizon + ".1",
      "steps." + role + "." + horizon + ".2",
      "steps." + role + "." + horizon + ".3",
    ]);
    for (const key of workflow.steps) {
      expect(readMessagePath(thaiMessages.workflowGuide, key)).toEqual(expect.any(String));
      expect(readMessagePath(englishMessages.workflowGuide, key)).toEqual(expect.any(String));
    }
  });

  it.each([null, undefined, "office", "unknown", 4])(
    "uses general guidance for an unknown or absent role: %s",
    (roleCode) => {
      expect(resolveWorkflowRole(roleCode)).toBe("general");
      expect(getRoleWorkflow(roleCode, "month").steps).toEqual([
        "steps.general.month.1",
        "steps.general.month.2",
        "steps.general.month.3",
      ]);
    },
  );
});

describe("workflow navigation and contextual goal links", () => {
  const selectedDate = "2026-10-02";

  it.each(WORKFLOW_HORIZONS)(
    "keeps %s selected and preserves the selected date across horizon links",
    (currentHorizon) => {
      const links = buildWorkflowNavigationLinks(currentHorizon, selectedDate);

      expect(links.map((link) => link.horizon)).toEqual(WORKFLOW_HORIZONS);
      expect(links.filter((link) => link.current).map((link) => link.horizon)).toEqual([
        currentHorizon,
      ]);
      for (const horizon of WORKFLOW_HORIZONS) {
        const link = links.find((candidate) => candidate.horizon === horizon);
        expect(link).toBeDefined();
        if (!link) continue;
        if (horizon === "day" && currentHorizon === "day") {
          expect(link.href).toBe("/today");
        } else if (horizon === "day") {
          expect(link.href).toBe("/calendar?view=day&date=" + selectedDate);
        } else {
          expect(link.href).toBe("/plan?view=" + horizon + "&date=" + selectedDate);
        }
      }
    },
  );

  it.each(["year", "month", "week"] as const)(
    "seeds a new %s goal with the selected date and matching period",
    (view) => {
      const href = new URL(buildPlannerGoalHref(view, selectedDate), "https://kemtit.test");
      const period = plannerPeriod(view, selectedDate);

      expect(href.pathname).toBe("/plan");
      expect(href.searchParams.get("view")).toBe(view);
      expect(href.searchParams.get("date")).toBe(selectedDate);
      expect(href.searchParams.get("new")).toBe("goal");
      expect(href.searchParams.get("periodType")).toBe(view);
      expect(href.searchParams.get("periodStart")).toBe(period.start);
    },
  );
});
