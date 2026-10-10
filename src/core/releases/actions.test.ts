import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, revalidatePathMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { acknowledgeReleaseNote } from "./actions";

const releaseNoteId = "550e8400-e29b-41d4-a716-446655440000";
const readAt = "2026-10-04T10:00:00.000Z";

function configureSupabase({
  user = { id: "550e8400-e29b-41d4-a716-446655440001" },
  data = readAt,
  error = null,
  authError = null,
  authThrows = false,
  rpcThrows = false,
}: {
  user?: { id: string } | null;
  data?: unknown;
  error?: { code?: string; message: string } | null;
  authError?: unknown;
  authThrows?: boolean;
  rpcThrows?: boolean;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const getUser = vi.fn().mockResolvedValue({ data: { user }, error: authError });
  if (authThrows) getUser.mockRejectedValue(new Error("private auth detail"));
  if (rpcThrows) rpc.mockRejectedValue(new Error("private transport detail"));
  createServerSupabaseMock.mockResolvedValue({ auth: { getUser }, rpc });
  return { getUser, rpc };
}

describe("acknowledgeReleaseNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the idempotent routine and returns its stable read time", async () => {
    const { rpc } = configureSupabase();

    await expect(acknowledgeReleaseNote({ releaseNoteId })).resolves.toEqual({
      ok: true,
      data: { releaseNoteId, readAt },
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("acknowledge_release_note", {
      p_release_note_id: releaseNoteId,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/updates");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/updates/${releaseNoteId}`);
  });

  it("maps unpublished or future release rows to a not found result", async () => {
    configureSupabase({ error: { code: "P0002", message: "release_note_unavailable" } });

    await expect(acknowledgeReleaseNote({ releaseNoteId })).resolves.toMatchObject({
      ok: false,
      error: "notFound",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects malformed identifiers before initializing Supabase", async () => {
    await expect(acknowledgeReleaseNote({ releaseNoteId: "draft" })).resolves.toMatchObject({
      ok: false,
      error: "validation",
    });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });

  it("fails closed when auth returns an unexpected error alongside a user", async () => {
    const { rpc } = configureSupabase({ authError: new Error("private auth detail") });

    await expect(acknowledgeReleaseNote({ releaseNoteId })).resolves.toMatchObject({
      ok: false,
      error: "generic",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed on auth outages, malformed data, and transport failures", async () => {
    const authOutage = configureSupabase({ authThrows: true });
    await expect(acknowledgeReleaseNote({ releaseNoteId })).resolves.toMatchObject({
      ok: false,
      error: "generic",
    });
    expect(authOutage.rpc).not.toHaveBeenCalled();

    configureSupabase({ data: null });
    await expect(acknowledgeReleaseNote({ releaseNoteId })).resolves.toMatchObject({
      ok: false,
      error: "generic",
    });

    configureSupabase({ rpcThrows: true });
    await expect(acknowledgeReleaseNote({ releaseNoteId })).resolves.toMatchObject({
      ok: false,
      error: "generic",
    });
  });
});
