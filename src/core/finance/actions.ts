"use server";

import { revalidatePath } from "next/cache";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  financeBillSchema,
  financeBudgetSchema,
  financeGoalDetailsSchema,
  financeTransactionSchema,
  markBillPaidSchema,
  updateBillAmountSchema,
} from "./schema";

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/insights");
}

export async function saveFinanceGoalDetails(input: unknown): Promise<ActionResult> {
  const parsed = financeGoalDetailsSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data: goal } = await supabase
    .from("goals")
    .select("id, domain, goal_kind")
    .eq("id", parsed.data.goalId)
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .maybeSingle();

  if (!goal || goal.domain !== "finance" || goal.goal_kind !== "metric") {
    return fail("invalidGoal");
  }

  const { error } = await supabase.from("finance_goal_details").upsert(
    {
      goal_id: parsed.data.goalId,
      user_id: user.id,
      finance_type: parsed.data.financeType,
      monthly_target: parsed.data.monthlyTarget ?? null,
    },
    { onConflict: "goal_id" },
  );

  if (error) {
    console.error("[finance] save details failed", { code: error.code });
    return fail("generic");
  }

  revalidateFinance();
  return ok(null);
}

export async function createFinanceTransaction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = financeTransactionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("finance_transactions")
    .insert({
      user_id: user.id,
      transaction_type: parsed.data.transactionType,
      title: parsed.data.title,
      amount: parsed.data.amount,
      occurred_on: parsed.data.occurredOn,
      category: parsed.data.category ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[finance] create transaction failed", { code: error?.code });
    return fail("generic");
  }

  revalidateFinance();
  return ok({ id: data.id });
}

export async function createFinanceBill(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = financeBillSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("finance_bills")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      amount: parsed.data.amount ?? null,
      due_date: parsed.data.dueDate,
      recurrence_rule: parsed.data.recurrence === "none" ? null : parsed.data.recurrence,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[finance] create bill failed", { code: error?.code });
    return fail("generic");
  }

  revalidateFinance();
  return ok({ id: data.id });
}

export async function saveFinanceBudget(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = financeBudgetSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("finance_budgets")
    .upsert(
      {
        user_id: user.id,
        month_start: parsed.data.monthStart,
        amount: parsed.data.amount,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: "user_id,month_start" },
    )
    .select("id")
    .single();

  if (error || !data) {
    console.error("[finance] save budget failed", { code: error?.code });
    return fail("generic");
  }

  revalidateFinance();
  return ok({ id: data.id });
}

export async function updateFinanceBillAmount(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateBillAmountSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("finance_bills")
    .update({ amount: parsed.data.amount })
    .eq("id", parsed.data.billId)
    .eq("status", "due")
    .select("id")
    .maybeSingle();

  if (error) return fail("generic");
  if (!data) return fail("notFound");

  revalidateFinance();
  return ok({ id: data.id });
}

export async function markFinanceBillPaid(
  input: unknown,
): Promise<ActionResult<{ transactionId: string }>> {
  const parsed = markBillPaidSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("mark_finance_bill_paid", {
    p_bill_id: parsed.data.billId,
    p_paid_on: parsed.data.paidOn,
  });

  if (error || !data) {
    console.error("[finance] mark bill paid failed", { code: error?.code });
    return fail(error?.code === "23514" ? "billAmountRequired" : "generic");
  }

  revalidateFinance();
  return ok({ transactionId: data });
}
