import { z } from "zod";

import { isISODate } from "@/lib/date";

const isoDate = z.string().refine(isISODate, { error: "invalidDate" });
const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  error: "invalidDate",
});

export const taskCardCreateSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  domain: z.enum(["work", "health", "family", "finance", "growth", "relationships"]).default("work"),
  priority: z.enum(["high", "normal", "low"]).default("normal"),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});

const expectedTaskState = z.object({
  id: z.uuid(),
  updatedAt: timestamp,
  groupId: z.uuid().nullable(),
});
const expectedGroupVersion = z.object({ groupId: z.uuid(), version: z.number().int().positive() });

export const mutateTaskCardGroupSchema = z.object({
  operationId: z.uuid(),
  action: z.enum(["create", "add", "remove", "rename", "dissolve"]),
  groupId: z.uuid().nullable(),
  taskIds: z.array(z.uuid()).max(100),
  title: z.string().trim().min(1).max(80).nullable(),
  expectedGroupVersions: z.array(expectedGroupVersion).max(100),
  expectedTaskStates: z.array(expectedTaskState).max(500),
});
export type MutateTaskCardGroupInput = z.infer<typeof mutateTaskCardGroupSchema>;

export const undoTaskCardGroupSchema = z.object({ operationId: z.uuid() });

export const scheduleTaskCardSchema = z
  .object({
    operationId: z.uuid(),
    taskId: z.uuid(),
    taskUpdatedAt: timestamp,
    occurrenceDate: isoDate.nullable(),
    occurrenceUpdatedAt: timestamp.nullable(),
    targetDate: isoDate,
    startAt: timestamp.nullable(),
    endAt: timestamp.nullable(),
    blockId: z.uuid().nullable(),
    blocks: z.array(z.object({
      id: z.uuid(),
      version: z.number().int().positive(),
      startAt: timestamp,
      endAt: timestamp,
    })).max(100),
  })
  .superRefine((value, ctx) => {
    if ((value.startAt === null) !== (value.endAt === null)) {
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "invalidDate" });
    }
    if (value.startAt && value.endAt && Date.parse(value.endAt) <= Date.parse(value.startAt)) {
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "invalidDate" });
    }
    if (new Set(value.blocks.map((block) => block.id)).size !== value.blocks.length) {
      ctx.addIssue({ code: "custom", path: ["blocks"], message: "duplicateTask" });
    }
    if (value.occurrenceDate === null && value.occurrenceUpdatedAt !== null) {
      ctx.addIssue({ code: "custom", path: ["occurrenceUpdatedAt"], message: "invalidDate" });
    }
    if (value.startAt === null && value.blockId !== null) {
      ctx.addIssue({ code: "custom", path: ["blockId"], message: "invalidDate" });
    }
    if (value.startAt !== null && value.blocks.length > 0
      && (!value.blockId || !value.blocks.some((block) => block.id === value.blockId))) {
      ctx.addIssue({ code: "custom", path: ["blockId"], message: "invalidDate" });
    }
    if (value.blocks.length === 0 && value.blockId !== null) {
      ctx.addIssue({ code: "custom", path: ["blockId"], message: "invalidDate" });
    }
    if (value.startAt && value.blocks.some((block) => block.id === value.blockId)) {
      const selected = value.blocks.find((block) => block.id === value.blockId);
      if (selected && (Date.parse(selected.endAt) <= Date.parse(selected.startAt))) {
        ctx.addIssue({ code: "custom", path: ["blocks"], message: "invalidDate" });
      }
    }
  });
export type ScheduleTaskCardInput = z.infer<typeof scheduleTaskCardSchema>;

export const undoTaskCardScheduleSchema = z.object({ operationId: z.uuid() });
export type UndoTaskCardScheduleInput = z.infer<typeof undoTaskCardScheduleSchema>;
