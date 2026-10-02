import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import {
  getEntryStreak,
  listEntries,
  listEntryGoalOptions,
  listGoalEntries,
  sumEntriesBetween,
} from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null; count?: number | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  ilike: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => QueryBuilder;
};

function makeQuery(result: QueryResult): QueryBuilder {
  const query: QueryBuilder = Object.assign(Promise.resolve(result), {
    select: () => query,
    order: () => query,
    in: () => query,
    gte: () => query,
    lte: () => query,
    eq: () => query,
    ilike: () => query,
    range: () => query,
  }) as QueryBuilder;
  return query;
}

function configureSupabase(results: Record<string, QueryResult>) {
  createServerSupabaseMock.mockResolvedValue({
    from: (table: string) => makeQuery(results[table] ?? success([])),
  });
}

function success(data: unknown, count?: number): QueryResult {
  return { data, count, error: null };
}

function failure(code = "PGRST303"): QueryResult {
  return { data: null, error: { code } };
}

describe("entry queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: "goal entries",
      table: "goal_entries",
      source: "entries.listGoalEntries",
      read: () => listGoalEntries("goal-1"),
    },
    {
      name: "entry list",
      table: "goal_entries",
      source: "entries.listEntries",
      read: () => listEntries(),
    },
    {
      name: "goal options",
      table: "goals",
      source: "entries.listEntryGoalOptions",
      read: () => listEntryGoalOptions(),
    },
    {
      name: "entry streak",
      table: "goal_entries",
      source: "entries.getEntryStreak",
      read: () => getEntryStreak("2026-09-27"),
    },
    {
      name: "entry sum",
      table: "goal_entries",
      source: "entries.sumEntriesBetween",
      read: () => sumEntriesBetween("2026-09-01", "2026-09-30"),
    },
  ])("throws a safe QueryError when the $name read fails", async ({ table, source, read }) => {
    configureSupabase({ [table]: failure() });

    await expect(read()).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source,
      code: "PGRST303",
    });
  });

  it("keeps legitimate empty lists and zero summaries empty", async () => {
    configureSupabase({ goal_entries: success([]), goals: success([]) });

    await expect(listGoalEntries("goal-1")).resolves.toEqual([]);
    await expect(listEntries()).resolves.toEqual({ rows: [], total: 0 });
    await expect(listEntryGoalOptions()).resolves.toEqual([]);
    await expect(getEntryStreak("2026-09-27")).resolves.toBe(0);
    await expect(sumEntriesBetween("2026-09-01", "2026-09-30")).resolves.toBe(0);
  });

  it("preserves returned rows and the database count", async () => {
    const rows = [{ id: "entry-1", amount: 12 }];
    configureSupabase({ goal_entries: success(rows, 1) });

    await expect(listEntries()).resolves.toEqual({ rows, total: 1 });
  });
});
