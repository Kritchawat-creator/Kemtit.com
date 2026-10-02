import type { NextRequest } from "next/server";

import { GET as calendarProviderCallback } from "../../[provider]/callback/route";

export const dynamic = "force-dynamic";

/** Preserve the configured Google redirect URL while sharing the provider callback. */
export function GET(request: NextRequest) {
  return calendarProviderCallback(request, {
    params: Promise.resolve({ provider: "google" }),
  });
}
