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

import { archiveProject, restoreProject } from "./actions";

const projectId = "550e8400-e29b-41d4-a716-446655440001";
const userId = "550e8400-e29b-41d4-a716-446655440000";

function configureSupabase({
  user = { id: userId },
  rpcData = projectId,
  rpcError = null,
}: {
  user?: { id: string } | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  createServerSupabaseMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
  });
  return rpc;
}

describe("project archive actions", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("archives and restores using their authenticated RPCs", async () => {
    const rpc = configureSupabase();
    await expect(archiveProject({ id: projectId })).resolves.toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("archive_project_atomic", {
      p_project_id: projectId,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/archive");

    vi.clearAllMocks();
    const restoreRpc = configureSupabase();
    await expect(restoreProject({ id: projectId })).resolves.toEqual({ ok: true, data: null });
    expect(restoreRpc).toHaveBeenCalledExactlyOnceWith("restore_project_atomic", {
      p_project_id: projectId,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/archive");
  });

  it("returns safe not-found and auth results without dispatching writes", async () => {
    const rpc = configureSupabase({ rpcError: { message: "project_not_found" } });
    await expect(restoreProject({ id: projectId })).resolves.toMatchObject({
      ok: false,
      error: "notFound",
    });
    expect(rpc).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    const unauthenticatedRpc = configureSupabase({ user: null });
    await expect(archiveProject({ id: projectId })).resolves.toMatchObject({
      ok: false,
      error: "unauthorized",
    });
    expect(unauthenticatedRpc).not.toHaveBeenCalled();
  });
});
