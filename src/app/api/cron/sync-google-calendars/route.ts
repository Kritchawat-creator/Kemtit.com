import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/http/cron-auth";
import { syncGoogleCalendars } from "@/shared-services/jobs/sync-google-calendars";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeFailureCode(error: unknown): string {
  return error instanceof Error && error.message === "calendarSyncCandidatesFailed"
    ? "candidate_query_failed"
    : "unexpected";
}

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await syncGoogleCalendars());
  } catch (error) {
    console.error("[cron] calendar sync failed", { code: safeFailureCode(error) });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
