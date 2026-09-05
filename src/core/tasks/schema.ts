import { z } from "zod";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { isISODate } from "@/lib/date";
import type { Database } from "@/types/database";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type Task = Omit<TaskRow, "domain"> & { domain: Domain };
export type TaskCompletion = Database["public"]["Tables"]["task_completions"]["Row"];

export const isoDateSchema = z.string().refine(isISODate, { error: "invalidDate" });

/** spec ของ task ที่ template สร้างให้ (ใช้ใน goal cascade) */
export const taskSpecSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  dueDate: isoDateSchema,
  domain: z.enum(DOMAINS),
});
export type TaskSpec = z.infer<typeof taskSpecSchema>;
