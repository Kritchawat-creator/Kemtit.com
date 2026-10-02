import { z } from "zod";

import { isISODate } from "@/lib/date";

const isoDate = z.string().refine(isISODate, { error: "invalidDate" });
const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  error: "invalidDate",
});

export const dailyPlanSchema = z.object({
  planDate: isoDate,
  availableMinutes: z.number().int().min(0).max(1440),
  topPriorities: z.array(z.uuid()).max(3),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type DailyPlanInput = z.infer<typeof dailyPlanSchema>;

const timeBlockFields = z.object({
  taskId: z.uuid().nullable().optional(),
  taskOccurrenceDate: isoDate.nullable().optional(),
  taskScheduledDate: isoDate.nullable().optional(),
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  startAt: timestamp,
  endAt: timestamp,
  source: z.enum(["manual", "kemtit"]).default("manual"),
});

export const timeBlockSchema = timeBlockFields
  .refine((value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
    path: ["endAt"],
    error: "invalidDate",
  });
export type TimeBlockInput = z.infer<typeof timeBlockSchema>;

export const updateTimeBlockSchema = timeBlockFields
  .pick({ title: true, startAt: true, endAt: true })
  .extend({ id: z.uuid(), expectedVersion: z.number().int().positive() })
  .refine((value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
    path: ["endAt"],
    error: "invalidDate",
  });
export type UpdateTimeBlockInput = z.infer<typeof updateTimeBlockSchema>;

export const setTimeBlockStatusSchema = z.object({
  id: z.uuid(),
  expectedVersion: z.number().int().positive(),
  status: z.enum(["active", "cancelled"]),
});

const rescueProposalItemSchema = z.object({
  taskId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  action: z.enum(["keep", "move", "unplaced", "at_risk"]),
  reason: z.string().trim().min(1).max(80),
  targetDate: isoDate,
  startAt: timestamp.nullable(),
  endAt: timestamp.nullable(),
  blockId: z.uuid().nullable(),
  expectedBlockVersion: z.number().int().positive().nullable(),
  expectedTaskUpdatedAt: timestamp,
});

export const applyRescueSchema = z.object({
  operationId: z.uuid(),
  targetDate: isoDate,
  proposalVersion: z.string().trim().min(1).max(80),
  items: z
    .array(rescueProposalItemSchema)
    .min(1)
    .max(100)
    .refine((items) => new Set(items.map((item) => item.taskId)).size === items.length, {
      error: "duplicateTask",
    }),
});
export type ApplyRescueInput = z.infer<typeof applyRescueSchema>;

export const undoRescueSchema = z.object({ operationId: z.uuid() });
