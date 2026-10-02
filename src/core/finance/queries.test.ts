import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import {
  getFinanceBudget,
  getFinanceMonthSummary,
  listFinanceBills,
  listFinanceGoalDetails,
  listFinanceTransactions,
} from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
};

function makeQuery(result: QueryResult): QueryBuilder {
  const query: QueryBuilder = Object.assign(Promise.resolve(result), {
    select: () => query,
    order: () => query,
    in: () => query,
    gte: () => query,
    lte: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve(result),
  }) as QueryBuilder;
  return query;
}

function configureSupabase(results: Record<string, QueryResult>) {
  createServerSupabaseMock.mockResolvedValue({
    from: (table: string) => makeQuery(results[table] ?? { data: null, error: null }),
  });
}

function success(data: unknown): QueryResult {
  return { data, error: null };
}

function failure(code = "PGRST303"): QueryResult {
  return { data: null, error: { code } };
}

describe("finance queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: "finance goal details",
      table: "finance_goal_details",
      source: "finance.listGoalDetails",
      read: () => listFinanceGoalDetails(),
    },
    {
      name: "bills",
      table: "finance_bills",
      source: "finance.listBills",
      read: () => listFinanceBills(),
    },
    {
      name: "budget",
      table: "finance_budgets",
      source: "finance.getBudget",
      read: () => getFinanceBudget("2026-09-01"),
    },
    {
      name: "transaction summary",
      table: "finance_transactions",
      source: "finance.listTransactions",
      read: () => getFinanceMonthSummary("2026-09-01", "2026-09-30"),
    },
  ])("throws a sanitized QueryError when the $name read fails", async ({ table, source, read }) => {
    configureSupabase({ [table]: failure() });

    await expect(read()).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source,
      code: "PGRST303",
    });
  });

  it("preserves genuine empty results and an absent budget", async () => {
    configureSupabase({
      finance_goal_details: success([]),
      finance_bills: success([]),
      finance_transactions: success([]),
      finance_budgets: success(null),
    });

    await expect(listFinanceGoalDetails()).resolves.toEqual([]);
    await expect(listFinanceBills()).resolves.toEqual([]);
    await expect(listFinanceTransactions()).resolves.toEqual([]);
    await expect(getFinanceBudget("2026-09-01")).resolves.toBeNull();
    await expect(getFinanceMonthSummary("2026-09-01", "2026-09-30")).resolves.toEqual({
      income: 0,
      expense: 0,
      balance: 0,
      transactions: [],
    });
  });

  it("returns normal transaction totals and rows", async () => {
    const rows = [
      { transaction_type: "income", amount: "250.00" },
      { transaction_type: "expense", amount: "42.50" },
    ];
    configureSupabase({ finance_transactions: success(rows) });

    await expect(getFinanceMonthSummary("2026-09-01", "2026-09-30")).resolves.toEqual({
      income: 250,
      expense: 42.5,
      balance: 207.5,
      transactions: rows,
    });
  });

  it("returns normal bill, goal detail, and budget data", async () => {
    const details = [{ goal_id: "goal-1", goal_type: "saving" }];
    const bills = [{ id: "bill-1", title: "Electricity" }];
    const budget = { month_start: "2026-09-01", amount: 2000 };
    configureSupabase({
      finance_goal_details: success(details),
      finance_bills: success(bills),
      finance_budgets: success(budget),
    });

    await expect(listFinanceGoalDetails()).resolves.toEqual(details);
    await expect(listFinanceBills()).resolves.toEqual(bills);
    await expect(getFinanceBudget("2026-09-01")).resolves.toEqual(budget);
  });
});
