import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));
vi.mock("@/core/photos/queries", () => ({
  withSignedPhotoUrls: vi.fn(async (_supabase: unknown, rows: unknown[]) => rows),
}));

import { getWeekTaskStats } from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  or: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
};

function success(data: unknown): QueryResult {
  return { data, error: null };
}

function failure(code: string): QueryResult {
  return { data: null, error: { code } };
}

function configureSupabase(
  results: Record<string, QueryResult>,
  calls: { table: string; method: string; args: unknown[] }[] = [],
) {
  createServerSupabaseMock.mockResolvedValue({
    from: (table: string) => {
      const query: QueryBuilder = Object.assign(Promise.resolve(results[table] ?? success([])), {
        select: (...args: unknown[]) => {
          calls.push({ table, method: "select", args });
          return query;
        },
        in: (...args: unknown[]) => {
          calls.push({ table, method: "in", args });
          return query;
        },
        is: (...args: unknown[]) => {
          calls.push({ table, method: "is", args });
          return query;
        },
        or: (...args: unknown[]) => {
          calls.push({ table, method: "or", args });
          return query;
        },
        gte: (...args: unknown[]) => {
          calls.push({ table, method: "gte", args });
          return query;
        },
        lte: (...args: unknown[]) => {
          calls.push({ table, method: "lte", args });
          return query;
        },
      }) as QueryBuilder;
      return query;
    },
  });
}

describe("getWeekTaskStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts one-offs and each recurring occurrence once, keeping skipped out of done", async () => {
    const calls: { table: string; method: string; args: unknown[] }[] = [];
    configureSupabase(
      {
        tasks: success([
          {
            id: "one-off",
            title: "One off",
            domain: "work",
            goal_id: null,
            due_date: "2026-09-06",
            planned_date: "2026-09-06",
            recurrence_rule: null,
            completed_at: null,
          },
          {
            id: "legacy-one-off",
            title: "Legacy one off",
            domain: "work",
            goal_id: null,
            due_date: "2026-09-12",
            planned_date: null,
            recurrence_rule: null,
            completed_at: "2026-09-12T02:00:00.000Z",
          },
          {
            id: "daily",
            title: "Daily",
            domain: "work",
            goal_id: null,
            due_date: "2026-09-07",
            planned_date: "2026-09-07",
            recurrence_rule: "FREQ=DAILY",
            completed_at: null,
          },
          {
            id: "moved-in",
            title: "Moved in",
            domain: "work",
            goal_id: null,
            due_date: "2026-08-01",
            planned_date: "2026-08-01",
            recurrence_rule: "FREQ=DAILY",
            completed_at: null,
          },
          {
            id: "moved-out",
            title: "Moved out",
            domain: "work",
            goal_id: null,
            due_date: "2026-09-07",
            planned_date: "2026-09-07",
            recurrence_rule: "FREQ=DAILY",
            completed_at: null,
          },
          {
            id: "weekly",
            title: "Weekly",
            domain: "work",
            goal_id: null,
            due_date: "2026-09-05",
            planned_date: "2026-09-05",
            recurrence_rule: "FREQ=WEEKLY",
            completed_at: null,
          },
          {
            id: "cancelled",
            title: "Cancelled",
            domain: "work",
            goal_id: null,
            due_date: "2026-09-06",
            planned_date: "2026-09-06",
            recurrence_rule: "FREQ=DAILY",
            completed_at: null,
          },
          {
            id: "legacy-completions",
            title: "Legacy completions",
            domain: "work",
            goal_id: null,
            due_date: "2026-09-06",
            planned_date: "2026-09-06",
            recurrence_rule: "FREQ=DAILY",
            completed_at: null,
          },
          {
            id: "starts-after-week",
            title: "Starts after week",
            domain: "work",
            goal_id: null,
            due_date: "2026-09-13",
            planned_date: "2026-09-13",
            recurrence_rule: "FREQ=DAILY",
            completed_at: null,
          },
        ]),
        task_completions: success([
          { task_id: "daily", completed_on: "2026-09-10" },
          { task_id: "legacy-completions", completed_on: "2026-09-11" },
        ]),
        task_occurrences: success([
          {
            id: "daily-complete",
            task_id: "daily",
            occurrence_date: "2026-09-08",
            scheduled_date: "2026-09-08",
            status: "completed",
          },
          {
            id: "daily-skip",
            task_id: "daily",
            occurrence_date: "2026-09-09",
            scheduled_date: "2026-09-09",
            status: "skipped",
          },
          // An explicit planned override supersedes the legacy completed row above.
          {
            id: "daily-reset",
            task_id: "daily",
            occurrence_date: "2026-09-10",
            scheduled_date: "2026-09-10",
            status: "planned",
          },
          // Source is outside the cohort; this occurrence is included on its scheduled day.
          {
            id: "moved-in-row",
            task_id: "moved-in",
            occurrence_date: "2026-08-30",
            scheduled_date: "2026-09-06",
            status: "planned",
          },
          // Source is inside, destination is outside; its natural source slot is suppressed.
          {
            id: "moved-out-row",
            task_id: "moved-out",
            occurrence_date: "2026-09-07",
            scheduled_date: "2026-09-13",
            status: "planned",
          },
          {
            id: "weekly-complete",
            task_id: "weekly",
            occurrence_date: "2026-09-12",
            scheduled_date: "2026-09-12",
            status: "completed",
          },
          {
            id: "cancelled-row",
            task_id: "cancelled",
            occurrence_date: "2026-09-06",
            scheduled_date: "2026-09-06",
            status: "archived",
          },
        ]),
      },
      calls,
    );

    await expect(getWeekTaskStats("2026-09-06")).resolves.toEqual({ done: 4, total: 35 });

    const taskSelect = calls.find((call) => call.table === "tasks" && call.method === "select");
    const taskFilters = calls.filter((call) => call.table === "tasks");
    expect(taskSelect?.args[0]).toContain("planned_date");
    expect(taskSelect?.args[0]).not.toContain("deadline");
    expect(
      taskFilters.some(
        (call) =>
          call.method === "or" && String(call.args[0]).includes("recurrence_rule.not.is.null"),
      ),
    ).toBe(true);
  });

  it("surfaces safe errors from any cohort read", async () => {
    configureSupabase({ task_occurrences: failure("42501") });

    await expect(getWeekTaskStats("2026-09-06")).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source: "tasks.getWeekTaskStats",
      code: "42501",
    });
  });
});
