import { z } from "zod";

import { isoDateSchema } from "@/core/tasks/schema";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "invalidTime" });

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
    eventDate: isoDateSchema,
    allDay: z.boolean().default(true),
    blocksTime: z.boolean().default(true),
    startTime: timeSchema.nullable().optional(),
    endTime: timeSchema.nullable().optional(),
    notes: z.string().trim().max(4000, { error: "tooLong" }).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.allDay) {
      if (!value.startTime || !value.endTime) {
        ctx.addIssue({ code: "custom", path: ["startTime"], message: "required" });
      } else if (value.endTime <= value.startTime) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "invalidTimeRange" });
      }
    }
  });

export const deleteCalendarEventSchema = z.object({ id: z.uuid() });
export type CalendarEventInput = z.infer<typeof calendarEventSchema>;
