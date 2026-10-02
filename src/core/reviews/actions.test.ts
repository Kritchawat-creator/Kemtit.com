import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, revalidatePathMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: createServerSupabaseMock,
}));

import { carryOverReviewTasks } from "./actions";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const taskIds = ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"];

function configureSupabase({
  user = { id: userId },
  rpcData = taskIds.length,
  rpcError = null,
}: {
  user?: { id: string } | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcData, error: rpcError });
  const from = vi.fn();
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc,
    from,
  };
  createServerSupabaseMock.mockResolvedValue(supabase);
  return { from, rpc, supabase };
}

describe("carryOverReviewTasks atomic action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the exact RPC-updated task count", async () => {
    const { from, rpc } = configureSupabase({ rpcData: taskIds.length });

    await expect(carryOverReviewTasks({ taskIds, plannedDate: "2026-10-04" })).resolves.toEqual({
      ok: true,
      data: { count: 2 },
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("carry_over_tasks_with_blocks_atomic", {
      p_task_ids: taskIds,
      p_new_date: "2026-10-04",
    });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/reviews");
  });

  it("fails closed when the RPC count does not match the requested batch", async () => {
    configureSupabase({ rpcData: 1 });

    await expect(
      carryOverReviewTasks({ taskIds, plannedDate: "2026-10-04" }),
    ).resolves.toMatchObject({ ok: false, error: "generic" });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it.each([
    ["deadline_conflict", "deadlineConflict"],
    ["recurring_occurrence_required", "recurringOccurrenceRequired"],
    ["time_block_overlap", "timeBlockConflict"],
    ["time_block_locked", "timeBlockLocked"],
    ["time_block_anchor_missing", "timeBlockAnchorMissing"],
    ["time_block_anchor_mismatch", "timeBlockAnchorMismatch"],
    ["task_not_found", "notFound"],
    ["unexpected database detail", "generic"],
  ])("maps carry-over RPC error %s to safe key %s", async (message, expectedKey) => {
    configureSupabase({ rpcError: { message } });

    await expect(
      carryOverReviewTasks({ taskIds, plannedDate: "2026-10-04" }),
    ).resolves.toMatchObject({ ok: false, error: expectedKey });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid batch before initializing Supabase", async () => {
    const result = await carryOverReviewTasks({ taskIds: [], plannedDate: "2026-10-04" });

    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });

  it("does not call the RPC for an unauthenticated user", async () => {
    const { from, rpc } = configureSupabase({ user: null });

    await expect(
      carryOverReviewTasks({ taskIds, plannedDate: "2026-10-04" }),
    ).resolves.toMatchObject({ ok: false, error: "unauthorized" });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
