import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerSupabase: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
}));

import { saveDailyPlan } from "./actions";

describe("saveDailyPlan legacy priority contract", () => {
  beforeEach(() => vi.clearAllMocks());

  async function expectRejected(topPriorities: string[]) {
    const result = await saveDailyPlan({
      planDate: "2026-10-09",
      availableMinutes: 360,
      topPriorities,
      notes: "Keep this note",
    });

    expect(result).toEqual({
      ok: false,
      error: "priorityActionRequired",
      fieldErrors: undefined,
    });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();
  }

  it("rejects an empty legacy priority list instead of pretending it cleared the order", async () => {
    await expectRejected([]);
  });

  it("rejects a non-empty legacy priority list and directs callers to the dedicated action", async () => {
    await expectRejected(["00000000-0000-4000-8000-000000000001"]);
  });
});
