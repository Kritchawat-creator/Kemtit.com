import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  revalidatePath: vi.fn(),
  authGetUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { setDailyPriorityOrder, undoDailyPriorityOrder } from "./priority-actions";

describe("daily priority actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authGetUser.mockResolvedValue({ data: { user: { id: "user-id" } } });
    mocks.rpc.mockResolvedValue({
      data: {
        status: "applied",
        operationId: "00000000-0000-4000-8000-000000000001",
        priorityTaskIds: ["00000000-0000-4000-8000-000000000002"],
        version: 3,
      },
      error: null,
    });
    mocks.createServerSupabase.mockResolvedValue({
      auth: { getUser: mocks.authGetUser },
      rpc: mocks.rpc,
    });
  });

  it("surfaces conflicts even when the conflict response has no order fields", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        status: "conflict",
        reason: "stale_task",
        operationId: "00000000-0000-4000-8000-000000000001",
      },
      error: null,
    });

    const result = await setDailyPriorityOrder({
      operationId: "00000000-0000-4000-8000-000000000001",
      planDate: "2026-10-09",
      priorityTaskIds: ["00000000-0000-4000-8000-000000000002"],
      expectedVersion: 2,
    });

    expect(result).toEqual({ ok: false, error: "priorityConflict", fieldErrors: undefined });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the state reached when an idempotent apply was already undone", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        status: "applied",
        operationId: "00000000-0000-4000-8000-000000000001",
        priorityTaskIds: [],
        version: 4,
        undone: true,
      },
      error: null,
    });

    const result = await setDailyPriorityOrder({
      operationId: "00000000-0000-4000-8000-000000000001",
      planDate: "2026-10-09",
      priorityTaskIds: ["00000000-0000-4000-8000-000000000002"],
      expectedVersion: 2,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        operationId: "00000000-0000-4000-8000-000000000001",
        priorityTaskIds: [],
        version: 4,
        undone: true,
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/today");
  });

  it("surfaces an idempotent Undo response with the restored order", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        status: "applied",
        operationId: "00000000-0000-4000-8000-000000000001",
        priorityTaskIds: ["00000000-0000-4000-8000-000000000003"],
        version: 4,
        undone: true,
      },
      error: null,
    });

    const result = await undoDailyPriorityOrder({
      operationId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        priorityTaskIds: ["00000000-0000-4000-8000-000000000003"],
        version: 4,
        undone: true,
      },
    });
  });
});
