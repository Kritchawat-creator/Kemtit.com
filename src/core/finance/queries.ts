import "server-only";

import { COUNTED_DATA_ORIGINS } from "@/core/shared/data-origin";
import { QueryError } from "@/core/shared/query-error";
import { createServerSupabase } from "@/lib/supabase/server";

export async function listFinanceGoalDetails() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("finance_goal_details")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[finance] list details failed", { code: error.code });
    throw new QueryError("finance.listGoalDetails", error.code);
  }
  return data ?? [];
}

export async function listFinanceBills(from?: string, to?: string) {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("finance_bills")
    .select("*")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .order("due_date", { ascending: true });

  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);

  const { data, error } = await query;
  if (error) {
    console.error("[finance] list bills failed", { code: error.code });
    throw new QueryError("finance.listBills", error.code);
  }
  return data ?? [];
}

export async function listFinanceTransactions(from?: string, to?: string) {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("finance_transactions")
    .select("*")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (from) query = query.gte("occurred_on", from);
  if (to) query = query.lte("occurred_on", to);

  const { data, error } = await query;
  if (error) {
    console.error("[finance] list transactions failed", { code: error.code });
    throw new QueryError("finance.listTransactions", error.code);
  }
  return data ?? [];
}

export async function getFinanceBudget(monthStart: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("finance_budgets")
    .select("*")
    .in("data_origin", [...COUNTED_DATA_ORIGINS])
    .eq("month_start", monthStart)
    .maybeSingle();

  if (error) {
    console.error("[finance] budget failed", { code: error.code });
    throw new QueryError("finance.getBudget", error.code);
  }
  return data ?? null;
}

export async function getFinanceMonthSummary(from: string, to: string) {
  const rows = await listFinanceTransactions(from, to);
  const income = rows
    .filter((row) => row.transaction_type === "income")
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const expense = rows
    .filter((row) => row.transaction_type === "expense")
    .reduce((sum, row) => sum + Number(row.amount), 0);

  return {
    income,
    expense,
    balance: income - expense,
    transactions: rows,
  };
}
