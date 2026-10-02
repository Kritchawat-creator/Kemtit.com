import "server-only";

import { getTranslations } from "next-intl/server";

import {
  fetchUnprocessedEvents,
  markEventFailed,
  markEventProcessed,
  releaseNotificationSend,
  reserveNotificationSend,
} from "@/core/events/admin";
import { getProfileForNotification } from "@/core/profile/admin";
import { getTaskTitles } from "@/core/tasks/admin";
import { getClientEnv } from "@/lib/env";

import { getNotifier } from "../notifications/line/notifier";
import { processEvents, type ProcessorSummary } from "./processor";

/** wiring จริงของ processor (เรียกจาก /api/cron/process-events) */
export async function runProcessor(): Promise<ProcessorSummary> {
  const t = await getTranslations("line");
  return processEvents({
    fetchBatch: fetchUnprocessedEvents,
    markProcessed: markEventProcessed,
    markFailed: markEventFailed,
    getProfile: getProfileForNotification,
    getTaskTitles,
    reserveSend: reserveNotificationSend,
    releaseSend: releaseNotificationSend,
    notifier: getNotifier(),
    t,
    appUrl: getClientEnv().NEXT_PUBLIC_APP_URL,
  });
}
