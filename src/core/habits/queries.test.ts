import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { getActiveHabits, getHabitWeekStats } from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
};

function makeQuery(result: QueryResult): QueryBuilder {
  const query: QueryBuilder = Object.assign(Promise.resolve(result), {
    select: () => query,
    in: () => query,
    is: () => query,
    order: () => query,
    eq: () => query,
    gte: () => query,
    lte: () => query,
  }) as QueryBuilder;
  return query;
}

function configureSupabase(results: Record<string, QueryResult>) {
  createServerSupabaseMock.mockResolvedValue({
    from: (table: string) => makeQuery(results[table] ?? success([])),
  });
}

function success(data: unknown): QueryResult {
  return { data, error: null };
}

function failure(code = "PGRST303"): QueryResult {
  return { data: null, error: { code } };
}

describe("habit queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    {
      name: "today habit list",
      query: () => getActiveHabits("2026-09-27"),
      source: "habits.getActiveHabits",
      table: "habits",
    },
    {
      name: "today completion list",
      query: () => getActiveHabits("2026-09-27"),
      source: "habits.getActiveHabits",
      table: "habit_completions",
    },
    {
      name: "weekly habit list",
      query: () => getHabitWeekStats("2026-09-21", "2026-09-27"),
      source: "habits.getHabitWeekStats",
      table: "habits",
    },
    {
      name: "weekly completion list",
      query: () => getHabitWeekStats("2026-09-21", "2026-09-27"),
      source: "habits.getHabitWeekStats",
      table: "habit_completions",
    },
  ])("throws a safe QueryError when the $name read fails", async ({ query, source, table }) => {
    configureSupabase({ [table]: failure() });

    await expect(query()).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source,
      code: "PGRST303",
    });
  });

  it("keeps successful empty habit results empty", async () => {
    configureSupabase({ habits: success([]), habit_completions: success([]) });

    await expect(getActiveHabits("2026-09-27")).resolves.toEqual([]);
    await expect(getHabitWeekStats("2026-09-21", "2026-09-27")).resolves.toEqual({
      done: 0,
      target: 0,
      habits: 0,
    });
  });
});
