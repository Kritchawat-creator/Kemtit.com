import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { getGoalDetail, listGoalsWithProgress } from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  neq: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
};

function makeQuery(result: QueryResult): QueryBuilder {
  const query: QueryBuilder = Object.assign(Promise.resolve(result), {
    select: () => query,
    eq: () => query,
    order: () => query,
    in: () => query,
    neq: () => query,
    is: () => query,
    not: () => query,
  }) as QueryBuilder;
  return query;
}

function configureSupabase(
  results: Record<string, QueryResult>,
  sequences: Record<string, QueryResult[]> = {},
) {
  const callCounts: Record<string, number> = {};
  createServerSupabaseMock.mockResolvedValue({
    from: (table: string) => {
      const callIndex = callCounts[table] ?? 0;
      callCounts[table] = callIndex + 1;
      return makeQuery(
        sequences[table]?.[callIndex] ?? results[table] ?? { data: null, error: null },
      );
    },
  });
}

function success(data: unknown): QueryResult {
  return { data, error: null };
}

function failure(code = "PGRST303"): QueryResult {
  return { data: null, error: { code } };
}

describe("listGoalsWithProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { table: "goals", source: "goals list" },
    { table: "tasks", source: "linked task progress" },
  ])("throws a sanitized QueryError when the $source read fails", async ({ table }) => {
    configureSupabase({
      goals: success([]),
      tasks: success([]),
      [table]: failure(),
    });

    await expect(listGoalsWithProgress()).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source: "goals.listWithProgress",
      code: "PGRST303",
    });
  });

  it("returns a legitimate empty list when both reads succeed with no rows", async () => {
    configureSupabase({ goals: success([]), tasks: success([]) });

    await expect(listGoalsWithProgress()).resolves.toEqual([]);
  });

  it("continues decorating returned goal rows", async () => {
    const goal = {
      id: "goal-1",
      title: "September goal",
      period_type: "month",
      period_start: "2026-09-01",
      parent_id: null,
      domain: "work",
      goal_kind: "execution",
      status: "active",
      target_value: null,
      current_value: 0,
    };
    configureSupabase({ goals: success([goal]), tasks: success([]) });

    await expect(listGoalsWithProgress()).resolves.toEqual([
      expect.objectContaining({
        id: "goal-1",
        title: "September goal",
        progress: expect.objectContaining({ percent: 0, childCount: 0 }),
        period: expect.objectContaining({ start: "2026-09-01" }),
      }),
    ]);
  });

  it("raises a safe query error when loading a goal's linked task rows fails", async () => {
    configureSupabase(
      {
        goals: success([
          {
            id: "goal-1",
            title: "September goal",
            period_type: "month",
            period_start: "2026-09-01",
            parent_id: null,
            domain: "work",
            goal_kind: "execution",
            status: "active",
            target_value: null,
            current_value: 0,
          },
        ]),
        tasks: success([]),
      },
      { tasks: [success([]), failure("PGRST303")] },
    );

    await expect(getGoalDetail("goal-1")).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source: "goals.getDetail",
      code: "PGRST303",
    });
  });
});
