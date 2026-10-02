import type { CalendarEventValue, CalendarProviderName } from "./provider";
import { providerFailure } from "./provider-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminSupabaseMock: vi.fn(),
  getCalendarProviderMock: vi.fn(),
  decryptSecretMock: vi.fn(),
  encryptSecretMock: vi.fn(),
  getGoogleCalendarEnvMock: vi.fn(),
  getOutlookCalendarEnvMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: mocks.createAdminSupabaseMock }));
vi.mock("@/lib/secret-box.server", () => ({
  decryptSecret: mocks.decryptSecretMock,
  encryptSecret: mocks.encryptSecretMock,
}));
vi.mock("@/lib/env.server", () => ({
  getGoogleCalendarEnv: mocks.getGoogleCalendarEnvMock,
  getOutlookCalendarEnv: mocks.getOutlookCalendarEnvMock,
}));
vi.mock("./providers", () => ({ getCalendarProvider: mocks.getCalendarProviderMock }));

import {
  createExternalCalendarEvent,
  ExternalCalendarServiceError,
  reconcileExternalCalendarOperation,
  syncExternalCalendar,
  updateExternalCalendarEvent,
} from "./service";

type TableRow = Record<string, unknown>;
type RpcArguments = Record<string, unknown>;
type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };
type RpcHandler = (name: string, args: RpcArguments) => Promise<RpcResult>;

const ownerId = "owner-1";
const connectionId = "connection-1";
const operationId = "6b1b027e-cc3d-4f7e-bd7a-71fe61c63122";
const sourceEventId = "4f79a16d-a679-4a42-96f9-fc1bb2f663c9";
const accessExpiresAt = "2099-01-01T00:00:00.000Z";

function makeProvider(provider: CalendarProviderName) {
  return {
    provider,
    buildAuthorizationUrl: vi.fn(() => "https://provider.example/authorize"),
    exchangeCode: vi.fn(),
    refreshTokens: vi.fn().mockResolvedValue({
      accessToken: "refreshed-access-token",
      expiresAt: accessExpiresAt,
      scopes: [],
    }),
    getAccount: vi.fn(),
    listEvents: vi.fn().mockResolvedValue([]),
    getEvent: vi.fn().mockResolvedValue(null),
    createEvent: vi.fn(),
    patchEvent: vi.fn(),
    deleteEvent: vi.fn(),
  };
}

let tables: Record<string, TableRow[]>;
let providers: Record<CalendarProviderName, ReturnType<typeof makeProvider>>;
let rpc: ReturnType<typeof vi.fn>;
let handleRpc: RpcHandler;

function queryFor(table: string) {
  const filters: Array<[string, unknown]> = [];
  const rows = () =>
    (tables[table] ?? []).filter((row) =>
      filters.every(([column, value]) => row[column] === value),
    );
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    },
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
  };
  return query;
}

function connectionRow(provider: CalendarProviderName = "google", canWrite = true): TableRow {
  return {
    id: connectionId,
    user_id: ownerId,
    provider,
    external_calendar_id: "primary",
    account_label: "Calendar account",
    status: "active",
    can_write: canWrite,
  };
}

function credentialRow(overrides: TableRow = {}): TableRow {
  return {
    connection_id: connectionId,
    user_id: ownerId,
    refresh_token_ciphertext: "encrypted:refresh-token",
    access_token_ciphertext: "encrypted:access-token",
    access_token_expires_at: accessExpiresAt,
    scope: "calendar.events",
    ...overrides,
  };
}

function sourceRow(overrides: TableRow = {}): TableRow {
  return {
    id: sourceEventId,
    user_id: ownerId,
    connection_id: connectionId,
    external_event_id: "provider-event-1",
    title: "Imported planning event",
    all_day: false,
    start_date: null,
    end_date: null,
    start_at: "2026-09-27T02:00:00.000Z",
    end_at: "2026-09-27T03:00:00.000Z",
    blocks_time: true,
    event_kind: "single",
    etag: "source-etag-v1",
    revision: "a69c6f51-1a95-465b-9640-994b899ce118",
    ...overrides,
  };
}

function operationRow(args: RpcArguments, status: string): TableRow {
  return {
    operation_id: args.p_operation_id,
    user_id: args.p_user_id,
    connection_id: args.p_connection_id,
    source_event_id: args.p_source_event_id,
    operation_kind: args.p_operation_kind,
    request_payload: args.p_request_payload,
    payload_hash: args.p_payload_hash,
    status,
    error_code: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  tables = {
    external_calendar_connections: [connectionRow()],
    external_calendar_credentials: [credentialRow()],
    external_calendar_event_sources: [],
    external_calendar_operations: [],
    calendar_events: [],
  };
  providers = { google: makeProvider("google"), outlook: makeProvider("outlook") };
  mocks.getCalendarProviderMock.mockImplementation(
    (provider: CalendarProviderName) => providers[provider],
  );
  mocks.decryptSecretMock.mockImplementation((value: string) => value.replace("encrypted:", ""));
  mocks.encryptSecretMock.mockImplementation((value: string) => `encrypted:${value}`);
  mocks.getGoogleCalendarEnvMock.mockReturnValue({
    tokenEncryptionKey: "calendar-test-encryption-key",
  });
  mocks.getOutlookCalendarEnvMock.mockReturnValue({
    tokenEncryptionKey: "calendar-test-encryption-key",
  });

  handleRpc = async (name, args) => {
    if (name === "claim_external_calendar_sync") return { data: true, error: null };
    if (name === "update_external_calendar_tokens") return { data: true, error: null };
    if (name === "apply_external_calendar_snapshot") {
      return { data: Array.isArray(args.p_events) ? args.p_events.length : 0, error: null };
    }
    if (name === "finish_external_calendar_sync_error") return { data: true, error: null };
    if (name === "claim_external_calendar_operation") {
      const operationIdValue = args.p_operation_id;
      const existing = tables.external_calendar_operations.find(
        (row) => row.operation_id === operationIdValue,
      );
      if (existing) {
        return {
          data: {
            status: "ready",
            reconcile: existing.status === "unknown" || existing.status === "pending",
            calendarId: "primary",
            externalEventId: "provider-event-1",
            etag: "source-etag-v1",
          },
          error: null,
        };
      }
      tables.external_calendar_operations.push(operationRow(args, "pending"));
      return {
        data: {
          status: "ready",
          reconcile: false,
          calendarId: "primary",
          externalEventId: "provider-event-1",
          etag: "source-etag-v1",
        },
        error: null,
      };
    }
    if (name === "finish_external_calendar_operation") {
      const operation = tables.external_calendar_operations.find(
        (row) => row.operation_id === args.p_operation_id,
      );
      if (operation) {
        operation.status = args.p_status;
        operation.error_code = args.p_error_code;
      }
      return {
        data: {
          status: args.p_status,
          operationId: args.p_operation_id,
          ...(args.p_source_event_id ? { sourceEventId: args.p_source_event_id } : {}),
        },
        error: null,
      };
    }
    throw new Error(`unexpected RPC ${name}`);
  };

  rpc = vi.fn((name: string, args: RpcArguments) => handleRpc(name, args));
  mocks.createAdminSupabaseMock.mockReturnValue({
    from: (table: string) => queryFor(table),
    rpc,
  });
});

describe("calendar integration service orchestration", () => {
  it("denies a connection lookup for a different owner before claiming a sync lease", async () => {
    await expect(syncExternalCalendar("another-user", connectionId)).rejects.toMatchObject({
      code: "notFound",
    });

    expect(rpc).not.toHaveBeenCalledWith("claim_external_calendar_sync", expect.anything());
    expect(providers.google.listEvents).not.toHaveBeenCalled();
    expect(providers.outlook.listEvents).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and dispatches only through the connection's provider", async () => {
    tables.external_calendar_connections = [connectionRow("outlook")];
    tables.external_calendar_credentials = [
      credentialRow({ access_token_expires_at: "2000-01-01T00:00:00.000Z" }),
    ];
    providers.outlook.listEvents.mockResolvedValue([]);

    await expect(syncExternalCalendar(ownerId, connectionId)).resolves.toBe(0);

    expect(providers.outlook.refreshTokens).toHaveBeenCalledWith(
      "refresh-token",
      expect.any(AbortSignal),
    );
    expect(providers.outlook.listEvents).toHaveBeenCalledWith(
      "refreshed-access-token",
      "primary",
      expect.objectContaining({
        start: expect.stringMatching(/Z$/),
        end: expect.stringMatching(/Z$/),
      }),
      expect.any(AbortSignal),
    );
    expect(providers.google.refreshTokens).not.toHaveBeenCalled();
    expect(providers.google.listEvents).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "update_external_calendar_tokens",
      expect.objectContaining({
        p_refresh_token_ciphertext: null,
        p_scopes: [],
        p_access_token_ciphertext: "encrypted:refreshed-access-token",
      }),
    );
  });

  it("keeps a queued operation undispatched until it can claim provider work", async () => {
    handleRpc = async (name) =>
      name === "claim_external_calendar_operation"
        ? { data: { status: "queued" }, error: null }
        : { data: true, error: null };

    await expect(
      createExternalCalendarEvent({
        userId: ownerId,
        connectionId,
        operationId,
        value: {
          title: "Queued event",
          start: "2026-09-27T09:00:00+07:00",
          end: "2026-09-27T10:00:00+07:00",
          allDay: false,
          blocksTime: true,
        },
      }),
    ).resolves.toMatchObject({ status: "queued", operationId });

    expect(providers.google.createEvent).not.toHaveBeenCalled();
    expect(providers.outlook.createEvent).not.toHaveBeenCalled();
    expect(tables.external_calendar_credentials).toHaveLength(1);
  });

  it("reconciles an ambiguous create by readback without replaying the provider write", async () => {
    providers.google.createEvent.mockRejectedValue(new Error("transport closed after dispatch"));
    providers.google.listEvents.mockResolvedValue([]);
    const input = {
      userId: ownerId,
      connectionId,
      operationId,
      value: {
        title: "Ambiguous create",
        start: "2026-09-27T09:00:00+07:00",
        end: "2026-09-27T10:00:00+07:00",
        allDay: false,
        blocksTime: true,
      },
    } satisfies {
      userId: string;
      connectionId: string;
      operationId: string;
      value: CalendarEventValue;
    };

    await expect(createExternalCalendarEvent(input)).rejects.toBeInstanceOf(
      ExternalCalendarServiceError,
    );
    await expect(
      reconcileExternalCalendarOperation({ userId: ownerId, connectionId, operationId }),
    ).resolves.toMatchObject({ status: "unknown", operationId });

    expect(providers.google.createEvent).toHaveBeenCalledOnce();
    expect(providers.google.listEvents).toHaveBeenCalledOnce();
    expect(tables.external_calendar_operations[0]?.status).toBe("unknown");
  });

  it("uses the expected ETag and time dirty group, preserving a long canonical title on conflict", async () => {
    const longTitle = `Imported ${"source title ".repeat(22)}`;
    tables.external_calendar_event_sources = [sourceRow({ title: longTitle })];
    providers.google.patchEvent.mockRejectedValue(
      providerFailure("google", "conflict", { status: 412, writeOutcome: "rejected" }),
    );

    await expect(
      updateExternalCalendarEvent({
        userId: ownerId,
        connectionId,
        operationId,
        sourceEventId,
        expectedRevision: "a69c6f51-1a95-465b-9640-994b899ce118",
        patch: {
          start: "2026-09-27T03:30:00+07:00",
          end: "2026-09-27T04:15:00+07:00",
        },
      }),
    ).rejects.toMatchObject({ code: "externalCalendarConflict" });

    expect(rpc).toHaveBeenCalledWith(
      "claim_external_calendar_operation",
      expect.objectContaining({
        p_expected_revision: "a69c6f51-1a95-465b-9640-994b899ce118",
      }),
    );
    expect(providers.google.patchEvent).toHaveBeenCalledWith(
      "access-token",
      "primary",
      "provider-event-1",
      "source-etag-v1",
      expect.objectContaining({ title: longTitle }),
      ["time"],
      expect.any(AbortSignal),
    );
    expect(tables.external_calendar_operations[0]?.status).toBe("conflict");
  });

  it("does not apply a partial provider snapshot when a later event is invalid", async () => {
    const existingSource = { id: "retained-source", title: "Existing provider event" };
    const existingProjection = { id: "retained-projection", title: "Existing projection" };
    tables.external_calendar_event_sources = [existingSource];
    tables.calendar_events = [existingProjection];
    providers.google.listEvents.mockResolvedValue([
      {
        externalId: "valid-first",
        title: "Valid event",
        start: "2030-01-10",
        end: "2030-01-11",
        allDay: true,
        blocksTime: true,
        etag: "etag-1",
        operationId: null,
        kind: "single",
      },
      {
        externalId: "invalid-second",
        title: "Invalid event",
        start: "2030-01-11",
        end: "2030-01-10",
        allDay: true,
        blocksTime: true,
        etag: "etag-2",
        operationId: null,
        kind: "single",
      },
    ]);

    await expect(syncExternalCalendar(ownerId, connectionId)).rejects.toMatchObject({
      code: "calendarSyncFailed",
    });

    expect(rpc).not.toHaveBeenCalledWith("apply_external_calendar_snapshot", expect.anything());
    expect(tables.external_calendar_event_sources).toEqual([existingSource]);
    expect(tables.calendar_events).toEqual([existingProjection]);
    expect(rpc).toHaveBeenCalledWith(
      "finish_external_calendar_sync_error",
      expect.objectContaining({ p_connection_id: connectionId, p_error_code: "request_failed" }),
    );
  });
});
