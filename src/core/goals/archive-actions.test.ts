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

import { restoreGoal, setGoalStatus } from "./actions";

const goalId = "550e8400-e29b-41d4-a716-446655440001";
const userId = "550e8400-e29b-41d4-a716-446655440000";

function configureSupabase({
  user = { id: userId },
  rpcData = goalId,
  rpcError = null,
  updateData = { id: goalId },
}: {
  user?: { id: string } | null;
  rpcData?: unknown;
  rpcError?: { code: string; message: string } | null;
  updateData?: { id: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  const maybeSingle = vi.fn().mockResolvedValue({ data: updateData, error: null });
  const select = vi.fn(() => ({ maybeSingle }));
  const inOrigin = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ in: inOrigin }));
  const update = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ update }));
  createServerSupabaseMock.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
    from,
  });
  return { rpc, from, update, maybeSingle };
}

describe("goal archive actions", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("archives through the owner-scoped atomic RPC", async () => {
    const { rpc, from } = configureSupabase();

    await expect(setGoalStatus({ id: goalId, status: "archived" })).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("archive_goal_atomic", {
      p_goal_id: goalId,
    });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/archive");
  });

  it("restores through the atomic RPC so the database can preserve completed status", async () => {
    const { rpc, from } = configureSupabase();

    await expect(restoreGoal({ id: goalId })).resolves.toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("restore_goal_atomic", {
      p_goal_id: goalId,
    });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/archive");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/goals/${goalId}`);
  });

  it("keeps the active status contract while clearing stale archive metadata", async () => {
    const { rpc, update, maybeSingle } = configureSupabase();

    await expect(setGoalStatus({ id: goalId, status: "active" })).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledExactlyOnceWith({
      status: "active",
      archived_at: null,
      archived_from_status: null,
    });
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  it("maps missing-goal RPC errors and avoids writes for invalid or unauthenticated input", async () => {
    configureSupabase({ rpcError: { code: "P0001", message: "goal_not_found" } });
    await expect(restoreGoal({ id: goalId })).resolves.toMatchObject({
      ok: false,
      error: "notFound",
    });

    vi.clearAllMocks();
    await expect(restoreGoal({ id: "not-a-uuid" })).resolves.toMatchObject({
      ok: false,
      error: "validation",
    });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();

    const { rpc } = configureSupabase({ user: null });
    await expect(restoreGoal({ id: goalId })).resolves.toMatchObject({
      ok: false,
      error: "unauthorized",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
