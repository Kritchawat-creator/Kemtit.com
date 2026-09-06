import { describe, expect, it, vi } from "vitest";

import type { DomainEventRow } from "@/core/events/admin";

import { processEvents, type ProcessorDeps } from "./processor";

const event = (over: Partial<DomainEventRow>): DomainEventRow => ({
  id: crypto.randomUUID(),
  user_id: "u1",
  event_type: "goal.completed",
  payload: { goalId: "g1", title: "ยอดขาย กันยายน", periodType: "month" },
  processed_at: null,
  attempts: 0,
  last_error: null,
  created_at: "2026-09-05T00:00:00Z",
  ...over,
});

function makeDeps(
  events: DomainEventRow[],
  over: Partial<ProcessorDeps> = {},
): ProcessorDeps & { pushed: string[] } {
  const pushed: string[] = [];
  const t = ((key: string, values?: Record<string, unknown>) =>
    `${key}:${JSON.stringify(values ?? {})}`) as unknown as ProcessorDeps["t"];
  return {
    pushed,
    fetchBatch: vi.fn(async () => events),
    markProcessed: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    getProfile: vi.fn(async () => ({ line_user_id: "Uabc", notify_overdue: true })),
    getTaskTitles: vi.fn(async (_u: string, ids: string[]) => ids.map((id) => `งาน ${id}`)),
    recordSent: vi.fn(async () => {}),
    notifier: {
      channel: "line",
      dryRun: true,
      push: vi.fn(async (_to: string, text: string) => {
        pushed.push(text);
        return { ok: true as const, dryRun: true };
      }),
    },
    t,
    appUrl: "https://kemtit.com",
    ...over,
  };
}

describe("processEvents", () => {
  it("goal.completed → push + recordSent + processed", async () => {
    const deps = makeDeps([event({})]);
    const summary = await processEvents(deps);
    expect(summary).toEqual({ fetched: 1, processed: 1, failed: 0, sent: 1, skipped: 0 });
    expect(deps.pushed[0]).toContain("openExternalBrowser=1");
    expect(deps.recordSent).toHaveBeenCalledWith("u1", "goal.completed", true);
  });

  it("user ไม่ได้เชื่อม LINE → skipped แต่ยัง processed", async () => {
    const deps = makeDeps([event({})], {
      getProfile: vi.fn(async () => ({ line_user_id: null, notify_overdue: true })),
    });
    const summary = await processEvents(deps);
    expect(summary.sent).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.processed).toBe(1);
  });

  it("task.overdue รวมหลายงานในข้อความเดียว และเคารพ notify_overdue", async () => {
    const overdue = event({
      event_type: "task.overdue",
      payload: { taskIds: ["a", "b", "c", "d", "e", "f", "g"], date: "2026-09-05" },
    });
    const deps = makeDeps([overdue]);
    await processEvents(deps);
    expect(deps.pushed).toHaveLength(1);
    expect(deps.pushed[0]).toContain("overdueMore");
    const off = makeDeps([overdue], {
      getProfile: vi.fn(async () => ({ line_user_id: "U1", notify_overdue: false })),
    });
    expect((await processEvents(off)).skipped).toBe(1);
  });

  it("ส่งไม่สำเร็จ → markFailed attempts+1 ไม่ mark processed", async () => {
    const deps = makeDeps([event({ attempts: 2 })], {
      notifier: {
        channel: "line",
        dryRun: false,
        push: vi.fn(async () => ({ ok: false as const, error: "LINE 429" })),
      },
    });
    const summary = await processEvents(deps);
    expect(summary.failed).toBe(1);
    expect(deps.markFailed).toHaveBeenCalledWith(expect.any(String), 3, "LINE 429");
    expect(deps.markProcessed).not.toHaveBeenCalled();
  });

  it("event ที่เป็นแค่ log (task.completed) → processed + skipped", async () => {
    const deps = makeDeps([
      event({
        event_type: "task.completed",
        payload: { taskId: "t", goalId: null, date: "2026-09-05" },
      }),
    ]);
    const summary = await processEvents(deps);
    expect(summary).toMatchObject({ processed: 1, skipped: 1, sent: 0 });
  });
});
