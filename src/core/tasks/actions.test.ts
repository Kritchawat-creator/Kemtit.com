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

import { rescheduleTask, updateTask } from "./actions";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const taskId = "550e8400-e29b-41d4-a716-446655440001";

function configureSupabase({
  user = { id: userId },
  rpcData = null,
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

describe("rescheduleTask atomic action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches one RPC and succeeds when the task has no linked goal", async () => {
    const { rpc } = configureSupabase({ rpcData: null });

    await expect(rescheduleTask({ id: taskId, dueDate: "2026-09-28" })).resolves.toEqual({
      ok: true,
      data: null,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("reschedule_task_atomic", {
      p_task_id: taskId,
      p_new_date: "2026-09-28",
    });
  });

  it.each([
    ["time_block_overlap", "timeBlockConflict"],
    ["time_block_locked", "timeBlockLocked"],
    ["time_block_anchor_mismatch", "timeBlockAnchorMismatch"],
    ["time_block_anchor_missing", "timeBlockAnchorMissing"],
    ["recurring_occurrence_required", "recurringOccurrenceRequired"],
    ["task_not_found", "notFound"],
    ["unexpected database detail", "generic"],
  ])("maps RPC error %s to safe key %s", async (message, expectedKey) => {
    configureSupabase({ rpcError: { message } });

    await expect(rescheduleTask({ id: taskId, dueDate: "2026-09-28" })).resolves.toMatchObject({
      ok: false,
      error: expectedKey,
    });
  });

  it("does not initialize Supabase or write for invalid input", async () => {
    const result = await rescheduleTask({ id: "not-a-uuid", dueDate: "2026-09-28" });

    expect(result).toMatchObject({ ok: false, error: "validation" });
    expect(createServerSupabaseMock).not.toHaveBeenCalled();
  });

  it("does not call the RPC for an unauthenticated user", async () => {
    const { rpc } = configureSupabase({ user: null });

    await expect(rescheduleTask({ id: taskId, dueDate: "2026-09-28" })).resolves.toMatchObject({
      ok: false,
      error: "unauthorized",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("updateTask atomic action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends TaskForm fields and explicit planned-date/deadline update flags through the RPC", async () => {
    const { from, rpc } = configureSupabase({ rpcData: null });
    const values = {
      title: "Prepare September report",
      dueDate: "2026-09-27",
      plannedDate: "2026-09-28",
      deadline: "2026-09-30",
      domain: "work",
      recurrence: "weekly",
      weekdays: [1, 3],
      goalId: null,
      projectId: null,
      priority: "high",
      estimatedMinutes: 45,
      notes: "Send it after review",
    };

    await expect(updateTask({ id: taskId, values })).resolves.toEqual({
      ok: true,
      data: { id: taskId },
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("update_task_with_blocks_atomic", {
      p_task_id: taskId,
      p_title: "Prepare September report",
      p_due_date: "2026-09-27",
      p_planned_date: "2026-09-28",
      p_update_planned_date: true,
      p_deadline: "2026-09-30",
      p_update_deadline: true,
      p_domain: "work",
      p_recurrence_rule: "FREQ=WEEKLY;BYDAY=MO,WE",
      p_goal_id: null,
      p_project_id: null,
      p_priority: "high",
      p_estimated_minutes: 45,
      p_notes: "Send it after review",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps omitted optional planned date and deadline unchanged", async () => {
    const { rpc } = configureSupabase();

    await updateTask({
      id: taskId,
      values: {
        title: "Keep optional dates",
        dueDate: "2026-09-27",
        domain: "work",
        recurrence: "none",
      },
    });

    expect(rpc).toHaveBeenCalledExactlyOnceWith(
      "update_task_with_blocks_atomic",
      expect.objectContaining({
        p_planned_date: null,
        p_update_planned_date: false,
        p_deadline: null,
        p_update_deadline: false,
      }),
    );
  });

  it("does not write when the caller is unauthenticated", async () => {
    const { from, rpc } = configureSupabase({ user: null });

    await expect(
      updateTask({
        id: taskId,
        values: {
          title: "No unauthenticated update",
          dueDate: "2026-09-27",
          domain: "work",
          recurrence: "none",
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: "unauthorized" });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
});
