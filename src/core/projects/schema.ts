import { z } from "zod";

import { DOMAINS } from "@/core/domain/domains";
import { isISODate } from "@/lib/date";

const isoDate = z.string().refine(isISODate, { error: "invalidDate" });

export const projectSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(160, { error: "tooLong" }),
  description: z.string().trim().max(2000, { error: "tooLong" }).nullable().optional(),
  domain: z.enum(DOMAINS).default("work"),
  goalId: z.uuid().nullable().optional(),
  targetDate: isoDate.nullable().optional(),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const updateProjectSchema = z.object({ id: z.uuid(), values: projectSchema });
export const archiveProjectSchema = z.object({ id: z.uuid() });
