import { z } from "zod";

import { isISODate } from "@/lib/date";

export const weeklyReviewSchema = z.object({
  weekStart: z.string().refine(isISODate, { error: "invalidDate" }),
  wins: z.string().trim().max(4000).nullable().optional(),
  blockers: z.string().trim().max(4000).nullable().optional(),
  nextFocus: z.string().trim().max(4000).nullable().optional(),
});
export type WeeklyReviewInput = z.infer<typeof weeklyReviewSchema>;

export const carryOverTasksSchema = z.object({
  taskIds: z.array(z.uuid()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, {
    error: "invalidDate",
  }),
  plannedDate: z.string().refine(isISODate, { error: "invalidDate" }),
});
