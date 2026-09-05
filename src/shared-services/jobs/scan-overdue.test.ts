import { describe, expect, it, vi } from "vitest";

import { scanOverdue, type ScanDeps } from "./scan-overdue";

describe("scanOverdue", () => {
  it("สร้าง event เฉพาะ user ที่มีงานค้าง และ mark วันที่แจ้ง", async () => {
    const deps: ScanDeps = {
      listCandidates: vi.fn(async () => [
        { id: "a", line_user_id: "Ua" },
        { id: "b", line_user_id: "Ub" },
      ]),
      listOverdueTaskIds: vi.fn(async (userId: string) => (userId === "a" ? ["t1", "t2"] : [])),
      insertOverdueEvent: vi.fn(async () => {}),
      setNotified: vi.fn(async () => {}),
    };
    const summary = await scanOverdue(deps, "2026-09-05");
    expect(summary).toEqual({ candidates: 2, eventsCreated: 1, withoutOverdue: 1 });
    expect(deps.insertOverdueEvent).toHaveBeenCalledWith("a", ["t1", "t2"], "2026-09-05");
    expect(deps.setNotified).toHaveBeenCalledTimes(1);
  });
});
