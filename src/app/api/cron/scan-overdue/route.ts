import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/http/cron-auth";
import { runScanOverdue } from "@/shared-services/jobs/run";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/** GitHub Actions วันละครั้ง 08:00 Asia/Bangkok → emit task.overdue 1 event/user (Decision 2.2) */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const summary = await runScanOverdue();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cron] scan-overdue failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
