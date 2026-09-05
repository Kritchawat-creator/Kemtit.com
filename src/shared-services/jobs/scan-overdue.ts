import type { ISODate } from "@/lib/date";

/**
 * job สแกนงานเลยกำหนดวันละครั้ง (Decision 2.2, R16): 1 event `task.overdue` ต่อ user ต่อวัน → processor ส่ง LINE
 * idempotent ด้วย user_profiles.last_overdue_notified_on
 */
export const SCAN_BATCH_SIZE = 25;

export type ScanDeps = {
  listCandidates: (today: ISODate, limit: number) => Promise<{ id: string; line_user_id: string }[]>;
  listOverdueTaskIds: (userId: string, today: ISODate) => Promise<string[]>;
  insertOverdueEvent: (userId: string, taskIds: string[], today: ISODate) => Promise<void>;
  setNotified: (userId: string, today: ISODate) => Promise<void>;
};

export type ScanSummary = { candidates: number; eventsCreated: number; withoutOverdue: number };

export async function scanOverdue(deps: ScanDeps, today: ISODate, limit = SCAN_BATCH_SIZE): Promise<ScanSummary> {
  const candidates = await deps.listCandidates(today, limit);
  const summary: ScanSummary = { candidates: candidates.length, eventsCreated: 0, withoutOverdue: 0 };
  for (const user of candidates) {
    const taskIds = await deps.listOverdueTaskIds(user.id, today);
    if (taskIds.length === 0) {
      summary.withoutOverdue += 1;
      continue;
    }
    await deps.insertOverdueEvent(user.id, taskIds, today);
    await deps.setNotified(user.id, today);
    summary.eventsCreated += 1;
  }
  return summary;
}
