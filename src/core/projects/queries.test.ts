import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { getProjectDetail, listArchivedProjects, listProjects } from "./queries";

type QueryResult = { data: unknown; error: { code: string } | null };
type QueryBuilder = Promise<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  not: (...args: unknown[]) => QueryBuilder;
  or: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  range: (...args: unknown[]) => QueryBuilder;
  maybeSingle: (...args: unknown[]) => QueryBuilder;
};

function makeQuery(result: QueryResult): QueryBuilder {
  const query = Object.assign(Promise.resolve(result), {
    select: () => query,
    in: () => query,
    is: () => query,
    not: () => query,
    or: () => query,
    order: () => query,
    eq: () => query,
    range: () => query,
    maybeSingle: () => query,
  }) as QueryBuilder;
  return query;
}

function configureSupabase(results: Record<string, QueryResult>) {
  createServerSupabaseMock.mockResolvedValue({
    from: (table: string) => makeQuery(results[table] ?? { data: [], error: null }),
  });
}

describe("project queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps successful empty project results distinct from read failures", async () => {
    configureSupabase({ projects: { data: [], error: null } });
    await expect(listProjects()).resolves.toEqual([]);

    configureSupabase({ projects: { data: null, error: { code: "PGRST303" } } });
    await expect(listProjects()).rejects.toMatchObject({
      name: "QueryError",
      message: "queryFailed",
      source: "projects.list",
      code: "PGRST303",
    });
  });

  it("returns a bounded project archive page", async () => {
    const rows = [{ id: "project-1" }, { id: "project-2" }, { id: "project-3" }];
    configureSupabase({ projects: { data: rows, error: null } });

    await expect(listArchivedProjects(1, 2)).resolves.toEqual({
      items: rows.slice(0, 2),
      hasMore: true,
    });
  });

  it("includes legacy archived projects without an archive timestamp", async () => {
    const or = vi.fn(() => query);
    const query = Object.assign(Promise.resolve({ data: [], error: null }), {
      select: () => query,
      in: () => query,
      is: () => query,
      not: () => query,
      order: () => query,
      eq: () => query,
      or,
      range: () => query,
      maybeSingle: () => query,
    }) as QueryBuilder;
    createServerSupabaseMock.mockResolvedValue({ from: () => query });

    await listArchivedProjects();

    expect(or).toHaveBeenCalledExactlyOnceWith("archived_at.not.is.null,status.eq.archived");
  });

  it.each([
    ["projects", "projects.getDetail"],
    ["tasks", "projects.getDetail"],
  ])("throws QueryError when the %s detail read fails", async (table, source) => {
    configureSupabase({
      projects: { data: { id: "project-1" }, error: null },
      tasks: { data: [], error: null },
      [table]: { data: null, error: { code: "PGRST303" } },
    });

    await expect(getProjectDetail("project-1")).rejects.toMatchObject({
      name: "QueryError",
      source,
      code: "PGRST303",
    });
  });

  it("returns null for a successful missing project", async () => {
    configureSupabase({
      projects: { data: null, error: null },
      tasks: { data: [], error: null },
    });

    await expect(getProjectDetail("missing-project")).resolves.toBeNull();
  });
});
