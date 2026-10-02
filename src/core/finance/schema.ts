import { z } from "zod";

import { isoDateSchema } from "@/core/tasks/schema";

export const FINANCE_GOAL_TYPES = ["saving", "investment", "debt"] as const;
export type FinanceGoalType = (typeof FINANCE_GOAL_TYPES)[number];

export const FINANCE_TRANSACTION_TYPES = ["expense", "income"] as const;
export type FinanceTransactionType = (typeof FINANCE_TRANSACTION_TYPES)[number];

export const financeGoalDetailsSchema = z.object({
  goalId: z.uuid({ error: "invalidGoal" }),
  financeType: z.enum(FINANCE_GOAL_TYPES),
  monthlyTarget: z.number().positive().nullable().optional(),
});

export const financeTransactionSchema = z.object({
  transactionType: z.enum(FINANCE_TRANSACTION_TYPES),
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  amount: z.number({ error: "positive" }).positive({ error: "positive" }),
  occurredOn: isoDateSchema,
  category: z.string().trim().max(80, { error: "tooLong" }).nullable().optional(),
  notes: z.string().trim().max(4000, { error: "tooLong" }).nullable().optional(),
});

export const financeBillSchema = z.object({
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
  amount: z.number().min(0, { error: "notNegative" }).nullable().optional(),
  dueDate: isoDateSchema,
  recurrence: z.enum(["none", "monthly"]).default("none"),
  notes: z.string().trim().max(4000, { error: "tooLong" }).nullable().optional(),
});

export const financeBudgetSchema = z.object({
  monthStart: isoDateSchema,
  amount: z.number({ error: "positive" }).positive({ error: "positive" }),
  notes: z.string().trim().max(2000, { error: "tooLong" }).nullable().optional(),
});

export const updateBillAmountSchema = z.object({
  billId: z.uuid(),
  amount: z.number({ error: "positive" }).positive({ error: "positive" }),
});

export const markBillPaidSchema = z.object({
  billId: z.uuid(),
  paidOn: isoDateSchema,
});

export type FinanceGoalDetailsInput = z.infer<typeof financeGoalDetailsSchema>;
export type FinanceTransactionInput = z.infer<typeof financeTransactionSchema>;
export type FinanceBillInput = z.infer<typeof financeBillSchema>;
export type FinanceBudgetInput = z.infer<typeof financeBudgetSchema>;
