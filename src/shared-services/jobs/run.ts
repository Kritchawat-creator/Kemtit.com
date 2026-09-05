import "server-only";

import { insertEventAsAdmin } from "@/core/events/admin";
import { listOverdueScanCandidates, setOverdueNotified } from "@/core/profile/admin";
import { listOverdueTaskIds } from "@/core/tasks/admin";
import { todayBkk } from "@/lib/date";

import { scanOverdue, type ScanSummary } from "./scan-overdue";

/** wiring จริงของ job (เรียกจาก /api/cron/scan-overdue) */
export async function runScanOverdue(): Promise<ScanSummary & { date: string }> {
  const today = todayBkk();
  const summary = await scanOverdue(
    {
      listCandidates: listOverdueScanCandidates,
      listOverdueTaskIds: (userId, date) => listOverdueTaskIds(userId, date),
      insertOverdueEvent: (userId, taskIds, date) => insertEventAsAdmin(userId, "task.overdue", { taskIds, date }),
      setNotified: setOverdueNotified,
    },
    today,
  );
  return { ...summary, date: today };
}
