import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { listArchivedTasks } from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  or: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => QueryBuilder;
};

function makeQuery(result: QueryResult): QueryBuilder {
  const query = Object.assign(Promise.resolve(result), {
    select: () => query,
    in: () => query,
    is: () => query,
    not: () => query,
    or: () => query,
    order: () => query,
    range: () => query,
  }) as QueryBuilder;
  return query;
}

function configureSupabase(result: QueryResult) {
  createServerSupabaseMock.mockResolvedValue({ from: () => makeQuery(result) });
}

describe("listArchivedTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns only the requested page and reports additional rows", async () => {
    const rows = [{ id: "task-1" }, { id: "task-2" }, { id: "task-3" }];
    configureSupabase({ data: rows, error: null });

    await expect(listArchivedTasks(1, 2)).resolves.toEqual({
      items: rows.slice(0, 2),
      hasMore: true,
    });
  });

  it("includes legacy archived tasks without an archive timestamp", async () => {
    const or = vi.fn(() => query);
    const query = Object.assign(Promise.resolve({ data: [], error: null }), {
      select: () => query,
      in: () => query,
      is: () => query,
      not: () => query,
      or,
      order: () => query,
      range: () => query,
    }) as QueryBuilder;
    createServerSupabaseMock.mockResolvedValue({ from: () => query });

    await listArchivedTasks();

    expect(or).toHaveBeenCalledExactlyOnceWith("archived_at.not.is.null,status.eq.archived");
  });

  it("throws a sanitized QueryError when archived task loading fails", async () => {
    configureSupabase({ data: null, error: { code: "42501" } });

    await expect(listArchivedTasks()).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source: "tasks.listArchived",
      code: "42501",
    });
  });
});
