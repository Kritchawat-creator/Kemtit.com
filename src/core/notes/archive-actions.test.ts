import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, revalidatePathMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { restoreNote } from "./actions";

const noteId = "550e8400-e29b-41d4-a716-446655440001";
const userId = "550e8400-e29b-41d4-a716-446655440000";

function configureSupabase({
  user = { id: userId },
  result = { data: { id: noteId }, error: null },
}: {
  user?: { id: string } | null;
  result?: { data: { id: string } | null; error: { code: string } | null };
} = {}) {
  const filters: Array<[string, unknown]> = [];
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    }),
    not: vi.fn((column: string, value: unknown) => {
      filters.push([`not:${column}`, value]);
      return query;
    }),
    select: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => query),
  };
  createServerSupabaseMock.mockResolvedValue(supabase);
  return { filters, query, supabase };
}

describe("restoreNote", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("restores only the authenticated user's archived note", async () => {
    const { filters, query } = configureSupabase();

    await expect(restoreNote({ id: noteId })).resolves.toEqual({ ok: true, data: null });
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ archived_at: null });
    expect(filters).toEqual([
      ["id", noteId],
      ["user_id", userId],
      ["not:archived_at", "is"],
    ]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/archive");
  });

  it("does not write for invalid, unauthenticated, or missing notes", async () => {
    await expect(restoreNote({ id: "invalid" })).resolves.toMatchObject({
      ok: false,
      error: "validation",
    });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();

    const unauthenticated = configureSupabase({ user: null });
    await expect(restoreNote({ id: noteId })).resolves.toMatchObject({
      ok: false,
      error: "unauthorized",
    });
    expect(unauthenticated.supabase.from).not.toHaveBeenCalled();

    configureSupabase({ result: { data: null, error: null } });
    await expect(restoreNote({ id: noteId })).resolves.toMatchObject({
      ok: false,
      error: "notFound",
    });
  });
});
