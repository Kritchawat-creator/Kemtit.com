import { z } from "zod";

import { isoDateSchema } from "@/core/tasks/schema";

export const firstGoalSchema = z
  .object({
    workMode: z.enum(["seller", "professional"]),
    monthStart: isoDateSchema,
    targetValue: z.number({ error: "positive" }).positive({ error: "positive" }).optional(),
    title: z.string().trim().max(120, { error: "tooLong" }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.workMode === "seller" && value.targetValue === undefined) {
      ctx.addIssue({ code: "custom", path: ["targetValue"], message: "required" });
    }
    if (value.workMode === "professional" && !value.title?.trim()) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "required" });
    }
  });

export type FirstGoalInput = z.infer<typeof firstGoalSchema>;
