import { z } from "zod";

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "invalidTime" });

export const planningPreferencesSchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  workingWindows: z.array(z.object({ start: clockTime, end: clockTime })).min(1).max(7),
  breakWindows: z.array(z.object({ start: clockTime, end: clockTime })).max(14),
});

export type PlanningPreferences = z.infer<typeof planningPreferencesSchema>;

export const DEFAULT_PLANNING_PREFERENCES: PlanningPreferences = {
  timezone: "Asia/Bangkok",
  workingWindows: [{ start: "09:00", end: "17:00" }],
  breakWindows: [],
};

export function parsePlanningPreferences(value: unknown): PlanningPreferences {
  const result = planningPreferencesSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_PLANNING_PREFERENCES;
}
