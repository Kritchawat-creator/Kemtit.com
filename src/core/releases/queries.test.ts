import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { QueryError } from "@/core/shared/query-error";

import {
  getPublishedReleaseNote,
  hasUnreadPublishedReleaseNote,
  listPublishedReleaseNotes,
} from "./queries";

const releaseNoteId = "550e8400-e29b-41d4-a716-446655440000";
const userId = "550e8400-e29b-41d4-a716-446655440001";

function releaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: releaseNoteId,
    version: "1.2.3",
    build_id: "abcdef0",
    title_th: "รุ่นใหม่",
    title_en: "New release",
    new_items_th: ["เพิ่มการส่งความคิดเห็น"],
    new_items_en: ["Added feedback submission"],
    improved_items_th: [],
    improved_items_en: [],
    fixed_items_th: ["แก้ไขข้อผิดพลาด"],
    fixed_items_en: ["Fixed a defect"],
    published_at: "2026-10-04T09:00:00.000Z",
    created_at: "2026-10-04T08:00:00.000Z",
    ...overrides,
  };
}

function queryResult(data: unknown, error: { code?: string; message: string } | null = null) {
  const result = { data, error };
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "not", "order", "limit"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue(result);
  query.then = (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query;
}

function configureSupabase({
  user = { id: userId },
  fromResults = {} as Record<string, unknown[]>,
  authError = null,
}: {
  user?: { id: string } | null;
  fromResults?: Record<string, unknown[]>;
  authError?: unknown;
} = {}) {
  const results = Object.fromEntries(
    Object.entries(fromResults).map(([table, queue]) => [table, [...queue]]),
  );
  const from = vi.fn((table: string) => {
    const result = results[table]?.shift();
    return (result ?? queryResult([])) as never;
  });
  createServerSupabaseMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }) },
    from,
  });
  return { from };
}

describe("release note queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only published rows returned by the database and joins account read state", async () => {
    const draftId = "550e8400-e29b-41d4-a716-446655440002";
    configureSupabase({
      fromResults: {
        release_notes: [queryResult([
          releaseRow(),
          releaseRow({ id: draftId, published_at: null }),
        ])],
        release_note_reads: [queryResult([{ release_note_id: releaseNoteId }])],
      },
    });

    await expect(listPublishedReleaseNotes()).resolves.toEqual([
      {
        id: releaseNoteId,
        version: "1.2.3",
        buildId: "abcdef0",
        publishedAt: "2026-10-04T09:00:00.000Z",
        title: { th: "รุ่นใหม่", en: "New release" },
        isRead: true,
      },
    ]);
  });

  it("does not initialize Supabase for an invalid release identifier", async () => {
    await expect(getPublishedReleaseNote("invalid")).resolves.toBeNull();
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });

  it("fails closed on malformed published bilingual content", async () => {
    configureSupabase({
      fromResults: {
        release_notes: [queryResult(releaseRow({ improved_items_th: ["มีการปรับปรุง"] }))],
        release_note_reads: [queryResult([])],
      },
    });

    await expect(getPublishedReleaseNote(releaseNoteId)).rejects.toBeInstanceOf(QueryError);
  });

  it("checks only the latest due note and its account read marker for the app-shell badge", async () => {
    const { from } = configureSupabase({
      fromResults: {
        release_notes: [queryResult({ id: releaseNoteId })],
        release_note_reads: [queryResult(null)],
      },
    });

    await expect(hasUnreadPublishedReleaseNote()).resolves.toBe(true);
    expect(from).toHaveBeenNthCalledWith(1, "release_notes");
    expect(from).toHaveBeenNthCalledWith(2, "release_note_reads");
  });

  it("returns no release rows for an unauthenticated session", async () => {
    const { from } = configureSupabase({ user: null });

    await expect(listPublishedReleaseNotes()).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});
