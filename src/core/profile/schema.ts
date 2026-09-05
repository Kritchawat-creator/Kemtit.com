import { z } from "zod";

import type { Database } from "@/types/database";

import { PERSONA_IDS, type PersonaId } from "./personas";

type ProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
/** แถว user_profiles โดย narrow active_persona เป็น PersonaId (DB มี check constraint แต่ type ที่ generate เป็น string) */
export type Profile = Omit<ProfileRow, "active_persona"> & { active_persona: PersonaId | null };
export type ProfileUpdate = Database["public"]["Tables"]["user_profiles"]["Update"];

/** ข้อความ error เป็น key ใน th.json (errors.*) — UI แปลเอง */
export const choosePersonaSchema = z.object({
  persona: z.enum(PERSONA_IDS, { error: "personaInvalid" }),
});
export type ChoosePersonaInput = z.infer<typeof choosePersonaSchema>;

export const updateDisplayNameSchema = z.object({
  displayName: z.string().trim().min(1, { error: "required" }).max(60, { error: "tooLong" }),
});
export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;

export const updateNotifyOverdueSchema = z.object({
  enabled: z.boolean(),
});
