export const WORK_MODE_IDS = ["seller", "professional"] as const;
export type WorkMode = (typeof WORK_MODE_IDS)[number];

export function isWorkMode(value: unknown): value is WorkMode {
  return typeof value === "string" && (WORK_MODE_IDS as readonly string[]).includes(value);
}

/** Resolve the V2 mode while legacy active_persona is still present. */
export function workModeFromProfile(
  workMode: string | null | undefined,
  activePersona: string | null | undefined,
): WorkMode | null {
  if (isWorkMode(workMode)) return workMode;
  if (activePersona === "seller") return "seller";
  if (activePersona === "office") return "professional";
  return null;
}

/** Keep active_persona usable for legacy screens while V2 owns work_mode. */
export function legacyPersonaForWorkMode(mode: WorkMode): "seller" | "office" {
  return mode === "professional" ? "office" : "seller";
}
