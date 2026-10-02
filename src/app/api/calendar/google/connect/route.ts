import type { NextRequest } from "next/server";

import { GET as connectCalendarProvider } from "../../[provider]/connect/route";

export const dynamic = "force-dynamic";

/** Preserve the original Google OAuth URL while sharing the provider-neutral flow. */
export function GET(request: NextRequest) {
  return connectCalendarProvider(request, {
    params: Promise.resolve({ provider: "google" }),
  });
}
