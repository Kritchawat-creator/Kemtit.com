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

  it("excludes habits started after the week and prorates a partial Bangkok start week", async () => {
    configureSupabase({
      habits: success([
        { id: "before", target_per_week: 3, created_at: "2026-09-20T04:00:00.000Z" },
        // 28 Sep 00:00 Bangkok: six eligible dates remain in the selected week.
        { id: "during", target_per_week: 3, created_at: "2026-09-27T17:00:00.000Z" },
        // 4 Oct 01:00 Bangkok: this habit had not started during the selected week.
        { id: "after", target_per_week: 7, created_at: "2026-10-03T18:00:00.000Z" },
      ]),
      habit_completions: success([
        { habit_id: "before", completed_on: "2026-09-27" },
        { habit_id: "during", completed_on: "2026-09-27" },
        { habit_id: "during", completed_on: "2026-09-28" },
        { habit_id: "after", completed_on: "2026-10-03" },
      ]),
    });

    await expect(getHabitWeekStats("2026-09-27", "2026-10-03")).resolves.toEqual({
      done: 2,
      target: 6,
      habits: 2,
    });
  });

  it("does not count completions before a habit's effective Bangkok start date", async () => {
    configureSupabase({
      habits: success([{ id: "new", target_per_week: 7, created_at: "2026-09-29T17:00:00.000Z" }]),
      habit_completions: success([
        { habit_id: "new", completed_on: "2026-09-29" },
        { habit_id: "new", completed_on: "2026-09-30" },
      ]),
    });

    await expect(getHabitWeekStats("2026-09-27", "2026-10-03")).resolves.toEqual({
      done: 1,
      target: 4,
      habits: 1,
    });
  });
});
