import { z } from "zod";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { formatRRule, type Recurrence } from "@/core/domain/recurrence";
import { isISODate } from "@/lib/date";
import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export const TASK_STATUSES = ["inbox", "planned", "completed", "archived"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["high", "normal", "low"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Task = Omit<
  TaskRow,
  | "domain"
  | "archived_at"
  | "archived_from_status"
  | "status"
  | "priority"
  | "notes"
  | "deleted_at"
  | "estimated_minutes"
  | "project_id"
  | "planned_date"
  | "deadline"
> & {
  domain: Domain;
  status?: TaskStatus;
  priority?: TaskPriority;
  notes?: string | null;
  deleted_at?: string | null;
  estimated_minutes?: number | null;
  project_id?: string | null;
  planned_date?: string | null;
  deadline?: string | null;
  /** Transitional Phase 0 field; optional keeps existing story/test fixtures compatible. */
  archived_at?: string | null;
  /** Status before a new archive; null remains valid for legacy archived tasks. */
  archived_from_status?: string | null;
};
/** รูปแนบงาน (task_photos) — url = signed URL ที่ลงชื่อฝั่ง server (null = โหลดไม่ได้/flag ปิด) */
export type TaskPhoto = { id: string; path: string; url: string | null };
export type TaskWithGoal = Task & {
  goal: { id: string; title: string } | null;
  /** ไม่บังคับ (query เก่า/fixture ใน story ไม่มี) — undefined ถือว่าไม่มีรูป */
  photos?: TaskPhoto[];
};
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
    plannedDate: isoDateSchema.nullable().optional(),
    deadline: isoDateSchema.nullable().optional(),
    domain: z.enum(DOMAINS),
    recurrence: z.enum(RECURRENCE_OPTIONS),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    goalId: z.uuid({ error: "invalidGoal" }).nullable().optional(),
    projectId: z.uuid({ error: "invalidProject" }).nullable().optional(),
    priority: z.enum(TASK_PRIORITIES).default("normal"),
    estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    notes: z.string().trim().max(2000, { error: "tooLong" }).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.plannedDate && value.deadline && value.deadline < value.plannedDate) {
      ctx.addIssue({ code: "custom", path: ["deadline"], message: "invalidDate" });
    }
    if (value.recurrence === "weekly" && !(value.weekdays && value.weekdays.length > 0)) {
      ctx.addIssue({ code: "custom", path: ["weekdays"], message: "pickWeekday" });
    }
  });
export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const inboxTaskSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  domain: z.enum(DOMAINS).default("work"),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  notes: z.string().trim().max(2000, { error: "tooLong" }).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
});
export type InboxTaskValues = z.infer<typeof inboxTaskSchema>;

export const updateTaskSchema = z.object({ id: z.uuid(), values: taskFormSchema });
export const toggleTaskSchema = z.object({ id: z.uuid(), date: isoDateSchema, done: z.boolean() });
export const rescheduleTaskSchema = z.object({ id: z.uuid(), dueDate: isoDateSchema });
export const toggleTaskOccurrenceSchema = z.object({
  id: z.uuid(),
  occurrenceDate: isoDateSchema,
  date: isoDateSchema,
  done: z.boolean(),
});
export const rescheduleTaskOccurrenceSchema = z.object({
  id: z.uuid(),
  occurrenceDate: isoDateSchema,
  newDate: isoDateSchema,
});
export const skipTaskOccurrenceSchema = z.object({
  id: z.uuid(),
  occurrenceDate: isoDateSchema,
  date: isoDateSchema,
});
export const archiveTaskSchema = z.object({ id: z.uuid() });
/** Compatibility alias for callers that still refer to this soft archive as delete. */
export const deleteTaskSchema = archiveTaskSchema;
export const planInboxTaskSchema = z.object({ id: z.uuid(), dueDate: isoDateSchema });

export const subtaskTitleSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
});
export const addSubtaskSchema = z.object({ taskId: z.uuid(), title: subtaskTitleSchema.shape.title });
export const listSubtasksSchema = z.object({ taskId: z.uuid() });
export const updateSubtaskSchema = z.object({ id: z.uuid(), title: subtaskTitleSchema.shape.title });
export const deleteSubtaskSchema = z.object({ id: z.uuid() });
export const toggleSubtaskSchema = z.object({ id: z.uuid(), done: z.boolean() });
export const reorderSubtasksSchema = z.object({ taskId: z.uuid(), ids: z.array(z.uuid()).max(100) });

export function recurrenceRuleFromForm(
  values: Pick<TaskFormValues, "recurrence" | "weekdays">,
): string | null {
  const recurrence: Recurrence | null =
    values.recurrence === "daily"
      ? { freq: "DAILY" }
      : values.recurrence === "weekly"
        ? { freq: "WEEKLY", byDay: [...(values.weekdays ?? [])].sort((a, b) => a - b) }
        : null;
  return formatRRule(recurrence);
}
