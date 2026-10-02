import { z } from "zod";

import { DOMAINS } from "@/core/domain/domains";
import { isISODate } from "@/lib/date";

export const habitSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(160, { error: "tooLong" }),
  domain: z.enum(DOMAINS).default("health"),
  cadence: z.enum(["daily", "weekly"]).default("daily"),
  targetPerWeek: z.number().int().min(1).max(7).default(7),
  goalId: z.uuid({ error: "invalidGoal" }).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});
export type HabitInput = z.infer<typeof habitSchema>;

export const habitCompletionSchema = z.object({
  habitId: z.uuid(),
  date: z.string().refine(isISODate, { error: "invalidDate" }),
  done: z.boolean(),
});
