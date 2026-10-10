import { z } from "zod";

import { isISODate } from "@/lib/date";

export const dailyPlanSettingsSchema = z.object({
  planDate: z.string().refine(isISODate, { error: "invalidDate" }),
  availableMinutes: z.number().int().min(0).max(1440),
  notes: z.string().trim().max(2000).nullable().optional(),
});
