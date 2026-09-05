import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/http/cron-auth";
import { runProcessor } from "@/shared-services/events/run";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Netlify function limit (R4)

/** GitHub Actions ทุก 5 นาที (Decision 2.3) → ประมวลผล domain_events batch ≤ 20 */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const summary = await runProcessor();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[cron] process-events failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
