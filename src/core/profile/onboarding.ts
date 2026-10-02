import type { FocusAreaId, RoleCode } from "./roles";

/**
 * Minimal profile shape used by auth/onboarding gates.
 * Legacy fields remain available during migration but new onboarding is driven
 * by role_code + focus_areas.
 */
export type ProfileGate = {
  active_persona?: string | null;
  work_mode?: string | null;
  role_code?: RoleCode | string | null;
  focus_areas?: FocusAreaId[] | string[] | null;
  onboarding_completed_at: string | null;
};

export const ROUTES = {
  login: "/login",
  persona: "/onboarding/persona",
  focus: "/onboarding/focus",
  starter: "/onboarding/starter",
  firstGoal: "/onboarding/first-goal",
  dashboard: "/today",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * New onboarding:
 * role → focus areas → starter workspace → Today.
 *
 * Completed legacy users always go straight to Today and are never forced
 * through the redesigned onboarding. active_persona/work_mode stay as
 * compatibility fields for existing app behavior.
 */
export function nextRouteFor(profile: ProfileGate | null | undefined): AppRoute {
  if (!profile) return ROUTES.login;
  if (profile.onboarding_completed_at) return ROUTES.dashboard;
  if (!profile.role_code) return ROUTES.persona;
  if (!profile.focus_areas || profile.focus_areas.length === 0) return ROUTES.focus;
  return ROUTES.starter;
}

/** อนุญาต redirect เฉพาะ path ภายในแอป กัน open redirect */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/api/"))
    return null;
  return path;
}
