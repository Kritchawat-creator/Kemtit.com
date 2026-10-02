import { z } from "zod";

import { DOMAINS } from "@/core/domain/domains";
import { isISODate } from "@/lib/date";

const isoDateSchema = z.string().refine(isISODate, { error: "invalidDate" });

export const noteSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  body: z.string().trim().max(10000, { error: "tooLong" }).nullable().optional(),
  noteDate: isoDateSchema.optional(),
});

export const updateNoteSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  body: z.string().trim().max(10000, { error: "tooLong" }).nullable().optional(),
});

export const archiveNoteSchema = z.object({ id: z.uuid() });

export const convertNoteToTaskSchema = z.object({
  id: z.uuid(),
  domain: z.enum(DOMAINS).default("work"),
});

export type NoteInput = z.infer<typeof noteSchema>;
