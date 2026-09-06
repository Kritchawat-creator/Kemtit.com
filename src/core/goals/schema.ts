import { z } from "zod";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { PERIOD_TYPES, type PeriodType } from "@/core/domain/periods";
import type { GoalKind } from "@/core/domain/progress";
import { isoDateSchema, taskSpecSchema, type TaskSpec } from "@/core/tasks/schema";
import type { Database } from "@/types/database";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
export type GoalStatus = "active" | "completed" | "archived";

/** แถว goals โดย narrow enum ที่ DB บังคับด้วย check constraint */
export type Goal = Omit<GoalRow, "period_type" | "domain" | "goal_kind" | "status"> & {
  period_type: PeriodType;
  domain: Domain;
  goal_kind: GoalKind;
  status: GoalStatus;
};

export type ParentCandidate = Pick<
  Goal,
  "id" | "title" | "period_type" | "period_start" | "domain"
>;

/** หน่วยของ metric goal เก็บใน persona_data.unit ("THB" = บาท, อื่น ๆ เป็นข้อความอิสระ) */
export function goalUnit(goal: Pick<Goal, "persona_data">): string | null {
  const data = goal.persona_data;
  if (data && typeof data === "object" && !Array.isArray(data) && typeof data.unit === "string")
    return data.unit;
  return null;
}

const titleSchema = z.string().trim().min(1, { error: "required" }).max(120, { error: "tooLong" });

/** ฟอร์มสร้าง/แก้ goal — ข้อความ error เป็น key ใน th.json (errors.*) */
export const goalFormSchema = z
  .object({
    title: titleSchema,
    periodType: z.enum(PERIOD_TYPES),
    periodStart: isoDateSchema,
    domain: z.enum(DOMAINS),
    goalKind: z.enum(["metric", "execution"]),
    targetValue: z.number({ error: "positive" }).positive({ error: "positive" }).optional(),
    unit: z.string().trim().max(20, { error: "tooLong" }).optional(),
    parentId: z.uuid({ error: "invalidParent" }).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.goalKind === "metric" && value.targetValue === undefined) {
      ctx.addIssue({ code: "custom", path: ["targetValue"], message: "required" });
    }
  });
export type GoalFormValues = z.infer<typeof goalFormSchema>;

export const createGoalSchema = goalFormSchema;
export const updateGoalSchema = z.object({ id: z.uuid(), values: goalFormSchema });
export const updateCurrentValueSchema = z.object({
  id: z.uuid(),
  currentValue: z.number({ error: "invalidNumber" }).min(0, { error: "notNegative" }),
});
export const setGoalStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["active", "archived"]),
});

/** spec สำหรับสร้าง cascade ทีเดียว (template ตอน onboarding — Decision 1.4) */
export type GoalSpec = {
  title: string;
  periodType: PeriodType;
  periodStart: string;
  domain: Domain;
  goalKind: GoalKind;
  targetValue?: number;
  unit?: string;
  children?: GoalSpec[];
  tasks?: TaskSpec[];
};

export const goalSpecSchema: z.ZodType<GoalSpec> = z.lazy(() =>
  z.object({
    title: titleSchema,
    periodType: z.enum(PERIOD_TYPES),
    periodStart: isoDateSchema,
    domain: z.enum(DOMAINS),
    goalKind: z.enum(["metric", "execution"]),
    targetValue: z.number().positive().optional(),
    unit: z.string().trim().max(20).optional(),
    children: z.array(goalSpecSchema).max(20).optional(),
    tasks: z.array(taskSpecSchema).max(20).optional(),
  }),
);
