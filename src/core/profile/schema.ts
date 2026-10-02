import { z } from "zod";

import type { Database } from "@/types/database";

import { PERSONA_IDS, type PersonaId } from "./personas";
import { FOCUS_AREA_IDS, ROLE_CODES, type FocusAreaId, type RoleCode } from "./roles";
import { SCOPE_IDS, type Scope } from "./scope";
import { WORK_MODE_IDS, type WorkMode } from "./work-modes";

type ProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
/**
 * Profile keeps legacy persona/work_mode compatibility while the UX redesign
 * reads role_code + focus_areas for onboarding and personalization.
 */
export type Profile = Omit<
  ProfileRow,
  "active_persona" | "work_mode" | "default_scope" | "role_code" | "focus_areas"
> & {
  active_persona: PersonaId | null;
  work_mode: WorkMode | null;
  default_scope: Scope;
  role_code: RoleCode | null;
  focus_areas: FocusAreaId[];
};
export type ProfileUpdate = Database["public"]["Tables"]["user_profiles"]["Update"];

/** ข้อความ error เป็น key ใน th.json (errors.*) — UI แปลเอง */
export const choosePersonaSchema = z.object({
  persona: z.enum(PERSONA_IDS, { error: "personaInvalid" }),
});
export type ChoosePersonaInput = z.infer<typeof choosePersonaSchema>;

export const chooseRoleSchema = z.object({
  role: z.enum(ROLE_CODES, { error: "roleInvalid" }),
});
export type ChooseRoleInput = z.infer<typeof chooseRoleSchema>;

export const updateFocusAreasSchema = z.object({
  focusAreas: z
    .array(z.enum(FOCUS_AREA_IDS, { error: "focusAreaInvalid" }))
    .min(1, { error: "focusAreaRequired" })
    .max(FOCUS_AREA_IDS.length)
    .refine((areas) => new Set(areas).size === areas.length, { error: "focusAreaInvalid" }),
});
export type UpdateFocusAreasInput = z.infer<typeof updateFocusAreasSchema>;

export const updatePlanningContextSchema = z.object({
  role: z.enum(ROLE_CODES, { error: "roleInvalid" }),
  focusAreas: updateFocusAreasSchema.shape.focusAreas,
  scope: z.enum(SCOPE_IDS, { error: "scopeInvalid" }),
});
export type UpdatePlanningContextInput = z.infer<typeof updatePlanningContextSchema>;

export const updateDisplayNameSchema = z.object({
  displayName: z.string().trim().min(1, { error: "required" }).max(60, { error: "tooLong" }),
});
export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;

export const updateNotifyOverdueSchema = z.object({
  enabled: z.boolean(),
});

export const NOTIFICATION_PREFERENCE_KEYS = [
  "overdue",
  "dailyBrief",
  "weeklyReview",
  "habits",
  "investment",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

export const updateNotificationPreferenceSchema = z.object({
  key: z.enum(NOTIFICATION_PREFERENCE_KEYS),
  enabled: z.boolean(),
});

export const updateWorkModeSchema = z.object({
  workMode: z.enum(WORK_MODE_IDS, { error: "workModeInvalid" }),
});
export type UpdateWorkModeInput = z.infer<typeof updateWorkModeSchema>;

export const updateScopeSchema = z.object({
  scope: z.enum(SCOPE_IDS, { error: "scopeInvalid" }),
});
export type UpdateScopeInput = z.infer<typeof updateScopeSchema>;
