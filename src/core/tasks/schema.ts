import { z } from "zod";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { formatRRule, type Recurrence } from "@/core/domain/recurrence";
import { isISODate } from "@/lib/date";
import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type Task = Omit<TaskRow, "domain"> & { domain: Domain };
export type TaskWithGoal = Task & { goal: { id: string; title: string } | null };
export type TaskCompletion = Database["public"]["Tables"]["task_completions"]["Row"];

export const isoDateSchema = z.string().refine(isISODate, { error: "invalidDate" });

/** spec ของ task ที่ template สร้างให้ (ใช้ใน goal cascade) */
export const taskSpecSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  dueDate: isoDateSchema,
  domain: z.enum(DOMAINS),
});
export type TaskSpec = z.infer<typeof taskSpecSchema>;

export const RECURRENCE_OPTIONS = ["none", "daily", "weekly"] as const;
export type RecurrenceOption = (typeof RECURRENCE_OPTIONS)[number];

/** ฟอร์ม task (Design §8.2): ชื่อช่องเดียวก็บันทึกได้ */
export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
    dueDate: isoDateSchema,
    domain: z.enum(DOMAINS),
    recurrence: z.enum(RECURRENCE_OPTIONS),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    goalId: z.uuid({ error: "invalidGoal" }).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.recurrence === "weekly" && !(value.weekdays && value.weekdays.length > 0)) {
      ctx.addIssue({ code: "custom", path: ["weekdays"], message: "pickWeekday" });
    }
  });
export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const updateTaskSchema = z.object({ id: z.uuid(), values: taskFormSchema });
export const toggleTaskSchema = z.object({ id: z.uuid(), date: isoDateSchema, done: z.boolean() });
export const rescheduleTaskSchema = z.object({ id: z.uuid(), dueDate: isoDateSchema });
export const deleteTaskSchema = z.object({ id: z.uuid() });

export function recurrenceRuleFromForm(values: Pick<TaskFormValues, "recurrence" | "weekdays">): string | null {
  const recurrence: Recurrence | null =
    values.recurrence === "daily"
      ? { freq: "DAILY" }
      : values.recurrence === "weekly"
        ? { freq: "WEEKLY", byDay: [...(values.weekdays ?? [])].sort((a, b) => a - b) }
        : null;
  return formatRRule(recurrence);
}
