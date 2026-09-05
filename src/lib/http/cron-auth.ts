import "server-only";

import { timingSafeEqual } from "node:crypto";

import { getCronEnv } from "@/lib/env.server";

/** /api/cron/* ต้องมี Authorization: Bearer CRON_SECRET (R7) */
export function isAuthorizedCron(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const { CRON_SECRET } = getCronEnv();
  const a = Buffer.from(token);
  const b = Buffer.from(CRON_SECRET);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
