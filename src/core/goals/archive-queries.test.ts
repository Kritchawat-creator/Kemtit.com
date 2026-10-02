import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { listArchivedGoals } from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => QueryBuilder;
};

function configureSupabase(result: QueryResult) {
  const query = Object.assign(Promise.resolve(result), {
    select: () => query,
    in: () => query,
    eq: () => query,
    order: () => query,
    range: () => query,
  }) as QueryBuilder;
  createServerSupabaseMock.mockResolvedValue({ from: () => query });
}

describe("listArchivedGoals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns one bounded page and indicates whether more archived goals exist", async () => {
    const rows = [{ id: "goal-1" }, { id: "goal-2" }, { id: "goal-3" }];
    configureSupabase({ data: rows, error: null });

    await expect(listArchivedGoals(1, 2)).resolves.toEqual({
      items: rows.slice(0, 2),
      hasMore: true,
    });
  });

  it("throws a sanitized QueryError when archived goal loading fails", async () => {
    configureSupabase({ data: null, error: { code: "42501" } });

    await expect(listArchivedGoals()).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source: "goals.listArchived",
      code: "42501",
    });
  });
});
