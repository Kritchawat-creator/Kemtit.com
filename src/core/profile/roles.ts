import type { Domain } from "@/core/domain/domains";
import type { WorkMode } from "./work-modes";

export const ROLE_CODES = ["employee", "seller", "student", "freelancer"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const FOCUS_AREA_IDS = ["work", "daily_life", "finance", "health", "study"] as const;
export type FocusAreaId = (typeof FOCUS_AREA_IDS)[number];

export function workModeForRole(role: RoleCode): WorkMode | null {
  if (role === "seller") return "seller";
  if (role === "employee" || role === "freelancer") return "professional";
  return null;
}

export function legacyPersonaForRole(
  role: RoleCode,
): "seller" | "office" | "student" | "creator" {
  if (role === "seller") return "seller";
  if (role === "employee") return "office";
  if (role === "student") return "student";
  return "creator";
}

/**
 * Focus Areas are onboarding/personalization concepts, not a replacement for
 * the existing domain enum. This compatibility mapping keeps current records
 * valid while a future area layer can evolve independently.
 */
export function domainForFocusArea(area: FocusAreaId): Domain {
  if (area === "work") return "work";
  if (area === "finance") return "finance";
  if (area === "health") return "health";
  if (area === "study") return "growth";
  return "family";
}
