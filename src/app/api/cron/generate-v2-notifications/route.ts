import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/http/cron-auth";
import {
  generateV2Notifications,
  type V2NotificationPhase,
} from "@/shared-services/jobs/generate-v2-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function phaseFrom(request: Request): V2NotificationPhase | null {
  const value = new URL(request.url).searchParams.get("phase");
  return value === "morning" || value === "evening" ? value : null;
}

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const phase = phaseFrom(request);
  if (!phase) return NextResponse.json({ error: "invalidPhase" }, { status: 400 });

  const cursor = new URL(request.url).searchParams.get("cursor") || undefined;

  try {
    return NextResponse.json(await generateV2Notifications(phase, undefined, cursor));
  } catch (error) {
    console.error("[cron] generate-v2-notifications failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
