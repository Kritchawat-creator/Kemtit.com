import type { Scope } from "@/core/profile/scope";
import { isScope } from "@/core/profile/scope";
import type { Domain } from "@/core/domain/domains";
import { PLANNER_VIEWS, type PlannerView } from "@/core/planning/planner";
import type { ISODate } from "@/lib/date";
import { isISODate } from "@/lib/date";

/** Keep the selected planning scope when a link moves between Plan surfaces. */
export function withPlanScope(href: string, scope: Scope, domain?: Domain): string {
  const url = new URL(href, "https://kemtit.local");
  url.searchParams.set("scope", scope);
  if (domain) url.searchParams.set("domain", domain);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildPlanContextHref(view: PlannerView, date: ISODate, scope: Scope): string {
  return withPlanScope(`/plan?view=${view}&date=${date}`, scope);
}

export function buildGoalDetailHref(goalId: string, returnTo: string): string {
  const params = new URLSearchParams({ returnTo });
  return `/goals/${encodeURIComponent(goalId)}?${params.toString()}`;
}

/** Accept only a local Plan URL with a valid view, date and scope. */
export function safePlanReturnHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;

  try {
    const url = new URL(value, "https://kemtit.local");
    if (url.origin !== "https://kemtit.local" || url.pathname !== "/plan") return null;

    const viewValues = url.searchParams.getAll("view");
    const dateValues = url.searchParams.getAll("date");
    const scopeValues = url.searchParams.getAll("scope");
    const view = viewValues[0];
    const date = dateValues[0];
    const scope = scopeValues[0];
    if (
      viewValues.length !== 1 ||
      !PLANNER_VIEWS.includes(view as PlannerView) ||
      dateValues.length !== 1 ||
      !isISODate(date) ||
      scopeValues.length !== 1 ||
      !isScope(scope)
    ) {
      return null;
    }

    return buildPlanContextHref(view as PlannerView, date, scope);
  } catch {
    return null;
  }
}
