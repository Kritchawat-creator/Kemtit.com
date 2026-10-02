import { ROLE_CODES, type RoleCode } from "@/core/profile/roles";
import { plannerPeriod, type PlannerView } from "@/core/planning/planner";
import type { ISODate } from "@/lib/date";

export const WORKFLOW_HORIZONS = ["year", "month", "week", "day"] as const;
export type WorkflowHorizon = (typeof WORKFLOW_HORIZONS)[number];

export const WORKFLOW_ROLES = [...ROLE_CODES, "general"] as const;
export type WorkflowRole = (typeof WORKFLOW_ROLES)[number];
export type WorkflowStepKey = string;

const STEP_NUMBERS = ["1", "2", "3"] as const;

export function resolveWorkflowRole(roleCode: unknown): WorkflowRole {
  return typeof roleCode === "string" &&
    (ROLE_CODES as readonly string[]).includes(roleCode)
    ? (roleCode as RoleCode)
    : "general";
}

export function getRoleWorkflow(roleCode: unknown, horizon: WorkflowHorizon) {
  const role = resolveWorkflowRole(roleCode);
  const steps = STEP_NUMBERS.map(
    (number) => ("steps." + role + "." + horizon + "." + number) as WorkflowStepKey,
  );

  return { role, horizon, steps };
}

export type WorkflowNavigationLink = {
  horizon: WorkflowHorizon;
  href: string;
  current: boolean;
};

export function buildWorkflowNavigationLinks(
  currentHorizon: WorkflowHorizon,
  selectedDate: ISODate,
): WorkflowNavigationLink[] {
  return WORKFLOW_HORIZONS.map((horizon) => ({
    horizon,
    href:
      horizon === "day"
        ? currentHorizon === "day"
          ? "/today"
          : "/calendar?view=day&date=" + selectedDate
        : "/plan?view=" + horizon + "&date=" + selectedDate,
    current: horizon === currentHorizon,
  }));
}

export function buildPlannerGoalHref(view: PlannerView, selectedDate: ISODate): string {
  const period = plannerPeriod(view, selectedDate);
  return (
    "/plan?view=" +
    view +
    "&date=" +
    selectedDate +
    "&new=goal&periodType=" +
    view +
    "&periodStart=" +
    period.start
  );
}
