import "server-only";

import { ExternalCalendarServiceError, syncExternalCalendar } from "@/core/calendar-integrations/service";
import { listActiveExternalCalendarConnections } from "@/core/calendar-integrations/admin";

const BATCH_LIMIT = 1;

export type GoogleCalendarSyncSummary = {
  connections: number;
  succeeded: number;
  failed: number;
  changes: number;
};

function safeErrorCode(error: unknown): string {
  return error instanceof ExternalCalendarServiceError ? error.code : "unexpected";
}

/** Sync at most one fair-scheduled Google or Outlook link per invocation. */
export async function syncExternalCalendars(): Promise<GoogleCalendarSyncSummary> {
  const connections = await listActiveExternalCalendarConnections(BATCH_LIMIT);
  const summary: GoogleCalendarSyncSummary = {
    connections: connections.length,
    succeeded: 0,
    failed: 0,
    changes: 0,
  };

  for (const connection of connections) {
    try {
      summary.changes += await syncExternalCalendar(connection.user_id, connection.id);
      summary.succeeded += 1;
    } catch (error) {
      console.error("[calendar-integrations] scheduled sync failed", {
        provider: connection.provider,
        connectionId: connection.id,
        code: safeErrorCode(error),
      });
      summary.failed += 1;
    }
  }

  return summary;
}

/** Legacy export retained for the `/api/cron/sync-google-calendars` compatibility route. */
export async function syncGoogleCalendars(): Promise<GoogleCalendarSyncSummary> {
  return syncExternalCalendars();
}
