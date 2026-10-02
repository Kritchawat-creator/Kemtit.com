import { z } from "zod";

export const EXTERNAL_CALENDAR_PROVIDERS = ["google", "outlook"] as const;
export type ExternalCalendarProvider = (typeof EXTERNAL_CALENDAR_PROVIDERS)[number];

const eventValueFields = {
  title: z.string().max(200).refine((title) => title.trim().length > 0, "required"),
  start: z.string().min(1).max(64),
  end: z.string().min(1).max(64),
  allDay: z.boolean(),
  blocksTime: z.boolean(),
};

export const calendarEventValueSchema = z.object(eventValueFields).strict();
export const createExternalCalendarEventSchema = z
  .object({
    connectionId: z.uuid(),
    operationId: z.uuid(),
    value: calendarEventValueSchema,
  })
  .strict();

export const updateExternalCalendarEventSchema = z
  .object({
    connectionId: z.uuid(),
    operationId: z.uuid(),
    sourceEventId: z.uuid(),
    expectedRevision: z.uuid(),
    patch: z
      .object({
        title: eventValueFields.title.optional(),
        start: eventValueFields.start.optional(),
        end: eventValueFields.end.optional(),
        allDay: eventValueFields.allDay.optional(),
        blocksTime: eventValueFields.blocksTime.optional(),
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, "required"),
  })
  .strict();

export const deleteExternalCalendarEventSchema = z
  .object({
    connectionId: z.uuid(),
    operationId: z.uuid(),
    sourceEventId: z.uuid(),
    expectedRevision: z.uuid(),
  })
  .strict();

export const externalCalendarOperationSchema = z
  .object({ connectionId: z.uuid(), operationId: z.uuid() })
  .strict();

export const externalCalendarEventReferenceSchema = z
  .object({ connectionId: z.uuid(), sourceEventId: z.uuid() })
  .strict();

export type ExternalCalendarConnection = {
  id: string;
  provider: ExternalCalendarProvider;
  accountLabel: string | null;
  status: "active" | "revoked" | "error";
  syncStatus: "idle" | "syncing" | "ok" | "error";
  canWrite: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type ExternalCalendarOperationStatus = "queued" | "pending" | "succeeded" | "conflict" | "unknown" | "failed";

export type ExternalCalendarOperationSummary = {
  operationId: string;
  connectionId: string;
  sourceEventId: string | null;
  kind: "create" | "update" | "delete";
  status: ExternalCalendarOperationStatus;
  errorCode: string | null;
  updatedAt: string;
};

export type ExternalEventIdentity = {
  provider: ExternalCalendarProvider;
  externalCalendarId: string;
  externalEventId: string;
  localEventId: string;
  externalEtag: string | null;
};

/**
 * Provider adapters live outside calendar core. Core owns CalendarEvent;
 * adapters translate provider payloads into explicit import/sync commands.
 */
export interface ExternalCalendarAdapter {
  readonly provider: ExternalCalendarProvider;
  pullChanges(connectionId: string): Promise<void>;
  pushEvent(connectionId: string, localEventId: string): Promise<void>;
  deleteExternalProjection(connectionId: string, localEventId: string): Promise<void>;
}
