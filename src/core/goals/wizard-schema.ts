import { z } from "zod";

import { DOMAINS } from "@/core/domain/domains";
import { PERIOD_TYPES, normalizePeriodStart } from "@/core/domain/periods";
import { isoDateSchema, taskSpecSchema } from "@/core/tasks/schema";

const titleSchema = z.string().trim().min(1, { error: "required" }).max(120, { error: "tooLong" });

/** The guided flow creates one execution goal and exactly one canonical first-step task. */
export const goalWizardSpecSchema = z
  .object({
    title: titleSchema,
    periodType: z.enum(PERIOD_TYPES),
    periodStart: isoDateSchema,
    domain: z.enum(DOMAINS),
    goalKind: z.literal("execution"),
    tasks: z.array(taskSpecSchema).length(1),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (normalizePeriodStart(spec.periodType, spec.periodStart) !== spec.periodStart) {
      ctx.addIssue({ code: "custom", path: ["periodStart"], message: "invalidDate" });
    }
  });

export const goalWizardApplySchema = z
  .object({
    requestId: z.uuid({ error: "invalidParent" }),
    spec: goalWizardSpecSchema,
  })
  .strict();

export type GoalWizardSpec = z.infer<typeof goalWizardSpecSchema>;
export type GoalWizardApplyInput = z.infer<typeof goalWizardApplySchema>;
