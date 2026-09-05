import { z } from "zod";

import { isoDateSchema } from "@/core/tasks/schema";

/** schema ของฟอร์มเป้าแรก — แยกจาก actions.ts เพราะไฟล์ "use server" export ได้เฉพาะ async function */
export const firstGoalSchema = z.object({
  targetValue: z.number({ error: "positive" }).positive({ error: "positive" }),
  monthStart: isoDateSchema,
});
export type FirstGoalInput = z.infer<typeof firstGoalSchema>;
