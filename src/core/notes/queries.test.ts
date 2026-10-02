import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { listArchivedNotes, listNotes } from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => QueryBuilder;
};

function makeQuery(result: QueryResult): QueryBuilder {
  const query = Object.assign(Promise.resolve(result), {
    select: () => query,
    in: () => query,
    is: () => query,
    not: () => query,
    order: () => query,
    limit: () => query,
    eq: () => query,
    range: () => query,
  }) as QueryBuilder;
  return query;
}

function configureSupabase(result: QueryResult) {
  const query = makeQuery(result);
  const supabase = { from: vi.fn(() => query) };
  createServerSupabaseMock.mockResolvedValue(supabase);
  return { query, supabase };
}

describe("note queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps an empty successful notes list distinct from a read failure", async () => {
    configureSupabase({ data: [], error: null });
    await expect(listNotes()).resolves.toEqual([]);

    configureSupabase({ data: null, error: { code: "PGRST303" } });
    await expect(listNotes()).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source: "notes.list",
      code: "PGRST303",
    });
  });

  it("returns a bounded archive page and indicates whether another page exists", async () => {
    const rows = [
      { id: "note-1" },
      { id: "note-2" },
      { id: "note-3" },
    ];
    const { query } = configureSupabase({ data: rows, error: null });
    const range = vi.spyOn(query, "range");

    await expect(listArchivedNotes(2, 2)).resolves.toEqual({
      items: rows.slice(0, 2),
      hasMore: true,
    });
    expect(range).toHaveBeenCalledWith(4, 6);
  });

  it("surfaces archived-note query failures as sanitized errors", async () => {
    configureSupabase({ data: null, error: { code: "42501" } });

    await expect(listArchivedNotes()).rejects.toMatchObject({
      name: "QueryError",
      source: "notes.listArchived",
      code: "42501",
    });
  });
});
