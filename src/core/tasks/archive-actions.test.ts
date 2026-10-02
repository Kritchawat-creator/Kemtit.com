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

import { archiveTask, deleteTask, restoreTask } from "./actions";

const taskId = "550e8400-e29b-41d4-a716-446655440001";
const userId = "550e8400-e29b-41d4-a716-446655440000";

function configureSupabase({
  user = { id: userId },
  rpcData = { goalId: null, cancelledBlocks: 1 },
  rpcError = null,
}: {
  user?: { id: string } | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  const from = vi.fn();
  createServerSupabaseMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
    from,
  });
  return { rpc, from };
}

describe("task archive actions", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("archives through the atomic RPC and supports an unlinked task", async () => {
    const { rpc, from } = configureSupabase();

    await expect(archiveTask({ id: taskId })).resolves.toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("archive_task_atomic", {
      p_task_id: taskId,
    });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/archive");
    expect(revalidatePathMock).toHaveBeenCalledWith("/inbox");
  });

  it("keeps the legacy delete action name as a soft-archive alias", async () => {
    const { rpc } = configureSupabase();

    await expect(deleteTask({ id: taskId })).resolves.toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("archive_task_atomic", {
      p_task_id: taskId,
    });
  });

  it("restores through the atomic RPC without directly reactivating blocks", async () => {
    const { rpc, from } = configureSupabase();

    await expect(restoreTask({ id: taskId })).resolves.toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("restore_task_atomic", {
      p_task_id: taskId,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("maps missing task errors safely and avoids writes for invalid or unauthenticated calls", async () => {
    configureSupabase({ rpcError: { message: "task_not_found" } });
    await expect(archiveTask({ id: taskId })).resolves.toMatchObject({
      ok: false,
      error: "notFound",
    });

    vi.clearAllMocks();
    await expect(archiveTask({ id: "not-a-uuid" })).resolves.toMatchObject({
      ok: false,
      error: "validation",
    });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();

    const { rpc: unauthenticatedRpc } = configureSupabase({ user: null });
    await expect(restoreTask({ id: taskId })).resolves.toMatchObject({
      ok: false,
      error: "unauthorized",
    });
    expect(unauthenticatedRpc).not.toHaveBeenCalled();
  });
});
