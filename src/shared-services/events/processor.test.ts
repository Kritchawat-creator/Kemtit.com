import { describe, expect, it, vi } from "vitest";

import type { DomainEventRow } from "@/core/events/admin";

import { processEvents, type ProcessorDeps } from "./processor";

const event = (over: Partial<DomainEventRow>): DomainEventRow => ({
  id: crypto.randomUUID(),
  user_id: "u1",
  event_type: "goal.completed",
  payload: { goalId: "g1", title: "ยอดขาย กันยายน", periodType: "month" },
  processed_at: null,
  processing_at: null,
  attempts: 0,
  last_error: null,
  created_at: "2026-09-05T00:00:00Z",
  dedupe_key: null,
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
    getProfile: vi.fn(async () => ({
      line_user_id: "Uabc",
      notify_overdue: true,
      notify_daily_brief: true,
      notify_weekly_review: true,
      notify_habits: true,
      notify_investment: true,
    })),
    getTaskTitles: vi.fn(async (_u: string, ids: string[]) => ids.map((id) => `งาน ${id}`)),
    reserveSend: vi.fn(async () => "reservation-1"),
    releaseSend: vi.fn(async () => {}),
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
  it("goal.completed → reserve before push + processed", async () => {
    const source = event({});
    const deps = makeDeps([source]);

    const summary = await processEvents(deps);

    expect(summary).toEqual({ fetched: 1, processed: 1, failed: 0, sent: 1, skipped: 0 });
    expect(deps.reserveSend).toHaveBeenCalledWith(source.id, "u1", "goal.completed", true);
    expect(deps.pushed[0]).toContain("openExternalBrowser=1");
    expect(deps.markProcessed).toHaveBeenCalledWith(source.id);
  });

  it("reservation ซ้ำ → ไม่ push ซ้ำ แต่ปิด source event ได้", async () => {
    const source = event({});
    const deps = makeDeps([source], {
      reserveSend: vi.fn(async () => null),
    });

    const summary = await processEvents(deps);

    expect(summary).toEqual({ fetched: 1, processed: 1, failed: 0, sent: 0, skipped: 1 });
    expect(deps.notifier.push).not.toHaveBeenCalled();
    expect(deps.markProcessed).toHaveBeenCalledWith(source.id);
  });

  it("user ไม่ได้เชื่อม LINE → skipped โดยไม่ reserve และยัง processed", async () => {
    const deps = makeDeps([event({})], {
      getProfile: vi.fn(async () => ({
        line_user_id: null,
        notify_overdue: true,
        notify_daily_brief: true,
        notify_weekly_review: true,
        notify_habits: true,
        notify_investment: true,
      })),
    });

    const summary = await processEvents(deps);

    expect(summary.sent).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.processed).toBe(1);
    expect(deps.reserveSend).not.toHaveBeenCalled();
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
    expect(deps.reserveSend).toHaveBeenCalledWith(overdue.id, "u1", "task.overdue", true);

    const off = makeDeps([overdue], {
      getProfile: vi.fn(async () => ({
        line_user_id: "U1",
        notify_overdue: false,
        notify_daily_brief: true,
        notify_weekly_review: true,
        notify_habits: true,
        notify_investment: true,
      })),
    });
    expect((await processEvents(off)).skipped).toBe(1);
    expect(off.reserveSend).not.toHaveBeenCalled();
  });

  it("รองรับ daily brief แบบ seller/professional และ reminder events ผ่าน pipeline เดียว", async () => {
    const events = [
      event({
        event_type: "daily.plan.ready",
        payload: { date: "2026-09-20" },
      }),
      event({
        event_type: "daily.brief",
        payload: {
          date: "2026-09-20",
          workMode: "seller",
          importantTaskTitles: ["ตอบลูกค้า", "แพ็กสินค้า"],
          revenueRemaining: 12000,
          requiredDailyPace: 4000,
          plannedWorkloadMinutes: null,
          remainingCapacityMinutes: null,
        },
      }),
      event({
        event_type: "daily.brief",
        payload: {
          date: "2026-09-20",
          workMode: "professional",
          importantTaskTitles: ["ปิด API"],
          revenueRemaining: null,
          requiredDailyPace: null,
          plannedWorkloadMinutes: 180,
          remainingCapacityMinutes: 240,
        },
      }),
      event({
        event_type: "weekly.review.ready",
        payload: { weekStart: "2026-09-14" },
      }),
      event({
        event_type: "habit.reminder",
        payload: { habitId: "h1", title: "เดิน 20 นาที", date: "2026-09-20" },
      }),
      event({
        event_type: "investment.reminder",
        payload: {
          goalId: "g1",
          title: "กองทุนระยะยาว",
          monthlyTarget: 5000,
          date: "2026-09-20",
        },
      }),
    ];
    const deps = makeDeps(events);

    const summary = await processEvents(deps);

    expect(summary).toEqual({ fetched: 6, processed: 6, failed: 0, sent: 6, skipped: 0 });
    expect(deps.pushed).toHaveLength(6);
    expect(deps.pushed.join("\n")).toContain("dailyBriefSeller");
    expect(deps.pushed.join("\n")).toContain("dailyBriefProfessional");
    expect(deps.pushed.join("\n")).toContain("investmentReminder");
  });

  it("V2 notification preference ปิด → ไม่ reserve และไม่ push", async () => {
    const daily = event({
      event_type: "daily.brief",
      payload: {
        date: "2026-09-20",
        workMode: "professional",
        importantTaskTitles: ["ปิด API"],
        revenueRemaining: null,
        requiredDailyPace: null,
        plannedWorkloadMinutes: 120,
        remainingCapacityMinutes: 240,
      },
    });
    const deps = makeDeps([daily], {
      getProfile: vi.fn(async () => ({
        line_user_id: "U1",
        notify_overdue: true,
        notify_daily_brief: false,
        notify_weekly_review: false,
        notify_habits: false,
        notify_investment: false,
      })),
    });

    const summary = await processEvents(deps);

    expect(summary).toMatchObject({ processed: 1, skipped: 1, sent: 0 });
    expect(deps.reserveSend).not.toHaveBeenCalled();
    expect(deps.notifier.push).not.toHaveBeenCalled();
  });

  it("ส่งไม่สำเร็จ → release reservation + markFailed attempts+1 ไม่ mark processed", async () => {
    const source = event({ attempts: 2 });
    const deps = makeDeps([source], {
      reserveSend: vi.fn(async () => "reservation-failed"),
      notifier: {
        channel: "line",
        dryRun: false,
        push: vi.fn(async () => ({ ok: false as const, error: "LINE 429" })),
      },
    });

    const summary = await processEvents(deps);

    expect(summary.failed).toBe(1);
    expect(deps.releaseSend).toHaveBeenCalledWith("reservation-failed");
    expect(deps.markFailed).toHaveBeenCalledWith(source.id, 3, "LINE 429");
    expect(deps.markProcessed).not.toHaveBeenCalled();
  });

  it("network outcome ไม่ชัดเจน → เก็บ reservation ไว้เพื่อกัน push ซ้ำ", async () => {
    const source = event({ attempts: 1 });
    const deps = makeDeps([source], {
      reserveSend: vi.fn(async () => "reservation-ambiguous"),
      notifier: {
        channel: "line",
        dryRun: false,
        push: vi.fn(async () => {
          throw new Error("network timeout");
        }),
      },
    });

    const summary = await processEvents(deps);

    expect(summary.failed).toBe(1);
    expect(deps.releaseSend).not.toHaveBeenCalled();
    expect(deps.markFailed).toHaveBeenCalledWith(source.id, 2, "network timeout");
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
    expect(deps.reserveSend).not.toHaveBeenCalled();
  });
});
