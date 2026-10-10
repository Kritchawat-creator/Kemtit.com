import { z } from "zod";

import { isISODate } from "@/lib/date";

export const dailyPriorityOrderSchema = z.object({
  operationId: z.uuid(),
  planDate: z.string().refine(isISODate, { error: "invalidDate" }),
  priorityTaskIds: z
    .array(z.uuid())
    .max(3)
    .refine((ids) => new Set(ids).size === ids.length, { error: "duplicateTask" }),
  expectedVersion: z.number().int().min(0),
});

export const undoDailyPriorityOrderSchema = z.object({ operationId: z.uuid() });

export type DailyPriorityOrderInput = z.infer<typeof dailyPriorityOrderSchema>;
