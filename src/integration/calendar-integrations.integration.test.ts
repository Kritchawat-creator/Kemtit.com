import { createHash } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database, Json } from "@/types/database";

type DbClient = SupabaseClient<Database>;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function isLocalSupabaseUrl(value: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

const integrationEnabled = process.env.V2_INTEGRATION === "1" && isLocalSupabaseUrl(supabaseUrl);

function serviceClient(): DbClient {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function userClient(): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: crypto.randomUUID() },
  });
}

async function createTestUser(admin: DbClient) {
  const email = `kemtit-calendar-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("calendar integration user was not created");

  const client = userClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw signInError;
  }
  return { client, id: data.user.id };
}

async function persistConnection(
  admin: DbClient,
  userId: string,
  accountId = `account-${crypto.randomUUID()}`,
) {
  const { data, error } = await admin.rpc("persist_external_calendar_connection", {
    p_user_id: userId,
    p_provider: "google",
    p_account_id: accountId,
    p_account_label: "Calendar test account",
    p_calendar_id: "primary",
    p_refresh_token_ciphertext: "fixture:refresh-token-v1",
    p_access_token_ciphertext: "fixture:access-token-v1",
    p_access_token_expires_at: "2030-01-01T00:00:00.000Z",
    p_scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  if (error || !data) throw error ?? new Error("calendar connection was not created");
  return data;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function snapshotEvent(input: {
  externalId: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  blocksTime?: boolean;
  etag?: string | null;
  kind?: "single" | "occurrence" | "series";
  projections: Array<{
    event_date: string;
    title: string;
    all_day: boolean;
    blocks_time: boolean;
    start_time?: string;
    end_time?: string;
  }>;
}) {
  const value = {
    externalId: input.externalId,
    title: input.title,
    start: input.start,
    end: input.end,
    allDay: input.allDay ?? true,
    blocksTime: input.blocksTime ?? false,
    etag: input.etag ?? "etag-v1",
    operationId: null,
    kind: input.kind ?? "single",
  };
  return {
    ...value,
    payloadHash: hash(value),
    projections: input.projections.map((projection) => ({
      ...projection,
      blocks_time: value.blocksTime,
    })),
  };
}

async function claimSync(
  admin: DbClient,
  userId: string,
  connectionId: string,
  leaseId = crypto.randomUUID(),
) {
  const { data, error } = await admin.rpc("claim_external_calendar_sync", {
    p_user_id: userId,
    p_connection_id: connectionId,
    p_lease_id: leaseId,
  });
  if (error) throw error;
  return { leaseId, claimed: data };
}

async function applySnapshot(
  admin: DbClient,
  input: {
    userId: string;
    connectionId: string;
    leaseId: string;
    syncId?: string;
    events: Json;
  },
) {
  return admin.rpc("apply_external_calendar_snapshot", {
    p_user_id: input.userId,
    p_connection_id: input.connectionId,
    p_lease_id: input.leaseId,
    p_sync_id: input.syncId ?? crypto.randomUUID(),
    p_window_start: "2030-01-09T00:00:00.000Z",
    p_window_end: "2030-01-14T00:00:00.000Z",
    p_projection_start: "2030-01-09",
    p_projection_end: "2030-01-14",
    p_events: input.events,
  });
}

describe.skipIf(!integrationEnabled)("two-way calendar persistence on local Supabase", () => {
  it("preserves granted credentials, owns source snapshots, and applies bounded snapshots atomically", async () => {
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = serviceClient();
    let owner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    let otherUser: Awaited<ReturnType<typeof createTestUser>> | null = null;
    try {
      owner = await createTestUser(admin);
      otherUser = await createTestUser(admin);
      const connectionId = await persistConnection(admin, owner.id);

      const { data: initialConnection, error: initialConnectionError } = await admin
        .from("external_calendar_connections")
        .select("id, can_write, granted_scopes")
        .eq("id", connectionId)
        .single();
      expect(initialConnectionError).toBeNull();
      expect(initialConnection).toMatchObject({
        id: connectionId,
        can_write: true,
        granted_scopes: ["https://www.googleapis.com/auth/calendar.events"],
      });

      const { data: reconnectedId, error: reconnectError } = await admin.rpc(
        "persist_external_calendar_connection",
        {
          p_user_id: owner.id,
          p_provider: "google",
          p_account_id: (
            await admin
              .from("external_calendar_connections")
              .select("provider_account_id")
              .eq("id", connectionId)
              .single()
          ).data!.provider_account_id,
          p_account_label: "Calendar test account refreshed",
          p_calendar_id: "primary",
          p_refresh_token_ciphertext: null,
          p_access_token_ciphertext: "fixture:access-token-v2",
          p_access_token_expires_at: "2030-02-01T00:00:00.000Z",
          p_scopes: [],
        },
      );
      expect(reconnectError).toBeNull();
      expect(reconnectedId).toBe(connectionId);

      const { data: credential, error: credentialError } = await admin
        .from("external_calendar_credentials")
        .select("refresh_token_ciphertext, scope")
        .eq("connection_id", connectionId)
        .single();
      expect(credentialError).toBeNull();
      expect(credential).toEqual({
        refresh_token_ciphertext: "fixture:refresh-token-v1",
        scope: "https://www.googleapis.com/auth/calendar.events",
      });

      const unauthorizedClaim = await otherUser.client.rpc("claim_external_calendar_sync", {
        p_user_id: owner.id,
        p_connection_id: connectionId,
        p_lease_id: crypto.randomUUID(),
      });
      expect(unauthorizedClaim.error).not.toBeNull();

      const firstEvent = snapshotEvent({
        externalId: "multi-day-free-event",
        title: "Two day event",
        start: "2030-01-10",
        end: "2030-01-12",
        projections: [
          { event_date: "2030-01-10", title: "Two day event", all_day: true, blocks_time: false },
          { event_date: "2030-01-11", title: "Two day event", all_day: true, blocks_time: false },
        ],
      });
      const firstClaim = await claimSync(admin, owner.id, connectionId);
      expect(firstClaim.claimed).toBe(true);
      const firstApply = await applySnapshot(admin, {
        userId: owner.id,
        connectionId,
        leaseId: firstClaim.leaseId,
        events: [firstEvent],
      });
      expect(firstApply.error).toBeNull();
      expect(firstApply.data).toBe(1);

      const { data: originalSource, error: sourceReadError } = await admin
        .from("external_calendar_event_sources")
        .select("id, revision, title, etag, blocks_time")
        .eq("connection_id", connectionId)
        .eq("external_event_id", "multi-day-free-event")
        .single();
      expect(sourceReadError).toBeNull();
      expect(originalSource).toMatchObject({ title: "Two day event", blocks_time: false });

      const { data: originalProjections, error: projectionReadError } = await admin
        .from("calendar_events")
        .select("event_date, blocks_time, data_origin, external_source_id")
        .eq("external_source_id", originalSource!.id)
        .order("event_date");
      expect(projectionReadError).toBeNull();
      expect(originalProjections).toEqual([
        {
          event_date: "2030-01-10",
          blocks_time: false,
          data_origin: "IMPORT",
          external_source_id: originalSource!.id,
        },
        {
          event_date: "2030-01-11",
          blocks_time: false,
          data_origin: "IMPORT",
          external_source_id: originalSource!.id,
        },
      ]);

      const repeatedClaim = await claimSync(admin, owner.id, connectionId);
      expect(repeatedClaim.claimed).toBe(true);
      const repeatedApply = await applySnapshot(admin, {
        userId: owner.id,
        connectionId,
        leaseId: repeatedClaim.leaseId,
        events: [firstEvent],
      });
      expect(repeatedApply.error).toBeNull();
      const { data: repeatedSource, error: repeatedSourceError } = await admin
        .from("external_calendar_event_sources")
        .select("id, revision")
        .eq("connection_id", connectionId)
        .eq("external_event_id", "multi-day-free-event")
        .single();
      expect(repeatedSourceError).toBeNull();
      expect(repeatedSource).toEqual({
        id: originalSource!.id,
        revision: originalSource!.revision,
      });

      const invalidEvent = {
        ...firstEvent,
        externalId: "invalid-event-after-valid-event",
        start: "2030-01-12",
        end: "2030-01-11",
      };
      const failedClaim = await claimSync(admin, owner.id, connectionId);
      expect(failedClaim.claimed).toBe(true);
      const failedSnapshot = await applySnapshot(admin, {
        userId: owner.id,
        connectionId,
        leaseId: failedClaim.leaseId,
        events: [
          {
            ...firstEvent,
            title: "Must roll back",
            payloadHash: hash({ ...firstEvent, title: "Must roll back" }),
          },
          invalidEvent,
        ],
      });
      expect(failedSnapshot.error?.message).toContain("calendar_snapshot_invalid");

      const nullPayloadClaim = await claimSync(admin, owner.id, connectionId);
      expect(nullPayloadClaim.claimed).toBe(false);
      const { data: stillLeasedConnection, error: leaseReadError } = await admin
        .from("external_calendar_connections")
        .select("sync_lease_id")
        .eq("id", connectionId)
        .single();
      expect(leaseReadError).toBeNull();
      expect(stillLeasedConnection?.sync_lease_id).toBe(failedClaim.leaseId);

      const nullPayloadResult = await applySnapshot(admin, {
        userId: owner.id,
        connectionId,
        leaseId: failedClaim.leaseId,
        events: null,
      });
      expect(nullPayloadResult.error?.message).toContain("calendar_snapshot_invalid");
      const { data: unchangedSource, error: unchangedSourceError } = await admin
        .from("external_calendar_event_sources")
        .select("id, title")
        .eq("connection_id", connectionId)
        .eq("external_event_id", "multi-day-free-event")
        .single();
      expect(unchangedSourceError).toBeNull();
      expect(unchangedSource).toEqual({ id: originalSource!.id, title: "Two day event" });
      const { data: rolledBackNewSource, error: rolledBackNewSourceError } = await admin
        .from("external_calendar_event_sources")
        .select("id")
        .eq("connection_id", connectionId)
        .eq("external_event_id", "invalid-event-after-valid-event")
        .maybeSingle();
      expect(rolledBackNewSourceError).toBeNull();
      expect(rolledBackNewSource).toBeNull();

      const releaseFailedLease = await admin.rpc("finish_external_calendar_sync_error", {
        p_user_id: owner.id,
        p_connection_id: connectionId,
        p_lease_id: failedClaim.leaseId,
        p_error_code: "invalid_response",
      });
      expect(releaseFailedLease.error).toBeNull();
      expect(releaseFailedLease.data).toBe(true);

      const oldClaim = await claimSync(admin, owner.id, connectionId);
      expect(oldClaim.claimed).toBe(true);
      const { error: expireLeaseError } = await admin
        .from("external_calendar_connections")
        .update({ sync_lease_until: "2000-01-01T00:00:00.000Z" })
        .eq("id", connectionId);
      expect(expireLeaseError).toBeNull();
      const newClaim = await claimSync(admin, owner.id, connectionId);
      expect(newClaim.claimed).toBe(true);
      const staleApply = await applySnapshot(admin, {
        userId: owner.id,
        connectionId,
        leaseId: oldClaim.leaseId,
        events: [],
      });
      expect(staleApply.error?.message).toContain("calendar_sync_lease_lost");
      const currentLeaseApply = await applySnapshot(admin, {
        userId: owner.id,
        connectionId,
        leaseId: newClaim.leaseId,
        events: [firstEvent],
      });
      expect(currentLeaseApply.error).toBeNull();
      expect(currentLeaseApply.data).toBe(1);
    } finally {
      if (owner) await admin.auth.admin.deleteUser(owner.id);
      if (otherUser) await admin.auth.admin.deleteUser(otherUser.id);
    }
  });

  it("uses source revisions for operations and disconnects only imported data", async () => {
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = serviceClient();
    let owner: Awaited<ReturnType<typeof createTestUser>> | null = null;
    let otherUser: Awaited<ReturnType<typeof createTestUser>> | null = null;
    try {
      owner = await createTestUser(admin);
      otherUser = await createTestUser(admin);
      const connectionId = await persistConnection(admin, owner.id);
      const event = snapshotEvent({
        externalId: "editable-event",
        title: "Editable event",
        start: "2030-01-10",
        end: "2030-01-11",
        etag: "etag-for-edit",
        projections: [
          { event_date: "2030-01-10", title: "Editable event", all_day: true, blocks_time: false },
        ],
      });
      const sync = await claimSync(admin, owner.id, connectionId);
      expect(sync.claimed).toBe(true);
      const applied = await applySnapshot(admin, {
        userId: owner.id,
        connectionId,
        leaseId: sync.leaseId,
        events: [event],
      });
      expect(applied.error).toBeNull();

      const { data: source, error: sourceError } = await admin
        .from("external_calendar_event_sources")
        .select("id, revision")
        .eq("connection_id", connectionId)
        .eq("external_event_id", "editable-event")
        .single();
      expect(sourceError).toBeNull();
      const staleOperationId = crypto.randomUUID();
      const stalePayload = { patch: { title: "Stale draft" } };
      const staleOperation = await admin.rpc("claim_external_calendar_operation", {
        p_user_id: owner.id,
        p_connection_id: connectionId,
        p_operation_id: staleOperationId,
        p_operation_kind: "update",
        p_source_event_id: source!.id,
        p_expected_revision: crypto.randomUUID(),
        p_request_payload: stalePayload,
        p_payload_hash: hash(stalePayload),
        p_lease_id: crypto.randomUUID(),
      });
      expect(staleOperation.error).toBeNull();
      expect(staleOperation.data).toMatchObject({
        status: "conflict",
        errorCode: "revision_conflict",
      });

      const operationId = crypto.randomUUID();
      const payload = { patch: { title: "Edited title" } };
      const leaseId = crypto.randomUUID();
      const claimedOperation = await admin.rpc("claim_external_calendar_operation", {
        p_user_id: owner.id,
        p_connection_id: connectionId,
        p_operation_id: operationId,
        p_operation_kind: "update",
        p_source_event_id: source!.id,
        p_expected_revision: source!.revision,
        p_request_payload: payload,
        p_payload_hash: hash(payload),
        p_lease_id: leaseId,
      });
      expect(claimedOperation.error).toBeNull();
      expect(claimedOperation.data).toMatchObject({ status: "ready", reconcile: false });

      const markUnknown = await admin.rpc("finish_external_calendar_operation", {
        p_user_id: owner.id,
        p_connection_id: connectionId,
        p_operation_id: operationId,
        p_lease_id: leaseId,
        p_status: "unknown",
        p_error_code: "response_unknown",
        p_provider_event: null,
        p_projection_start: "2030-01-09",
        p_projection_end: "2030-01-14",
      });
      expect(markUnknown.error).toBeNull();
      expect(markUnknown.data).toMatchObject({ status: "unknown" });

      const reconcileLeaseId = crypto.randomUUID();
      const reconciliation = await admin.rpc("claim_external_calendar_operation", {
        p_user_id: owner.id,
        p_connection_id: connectionId,
        p_operation_id: operationId,
        p_operation_kind: "update",
        p_source_event_id: source!.id,
        p_expected_revision: source!.revision,
        p_request_payload: payload,
        p_payload_hash: hash(payload),
        p_lease_id: reconcileLeaseId,
      });
      expect(reconciliation.error).toBeNull();
      expect(reconciliation.data).toMatchObject({ status: "ready", reconcile: true });
      const releaseUnknown = await admin.rpc("finish_external_calendar_operation", {
        p_user_id: owner.id,
        p_connection_id: connectionId,
        p_operation_id: operationId,
        p_lease_id: reconcileLeaseId,
        p_status: "unknown",
        p_error_code: "response_unknown",
        p_provider_event: null,
        p_projection_start: "2030-01-09",
        p_projection_end: "2030-01-14",
      });
      expect(releaseUnknown.error).toBeNull();

      const userEventInsert = await owner.client.from("calendar_events").insert({
        user_id: owner.id,
        title: "Keep local event",
        event_date: "2030-01-10",
        all_day: true,
        data_origin: "USER",
      });
      expect(userEventInsert.error).toBeNull();

      const { data: note, error: noteInsertError } = await owner.client
        .from("notes")
        .insert({ user_id: owner.id, title: "Delete trigger fixture", body: "Disposable" })
        .select("id")
        .single();
      expect(noteInsertError).toBeNull();
      const noteDelete = await owner.client.from("notes").delete().eq("id", note!.id);
      expect(noteDelete.error).toBeNull();
      const { data: noteIdentity, error: noteIdentityError } = await owner.client
        .from("item_registry")
        .select("id")
        .eq("user_id", owner.id)
        .eq("entity_type", "note")
        .eq("entity_id", note!.id);
      expect(noteIdentityError).toBeNull();
      expect(noteIdentity).toEqual([]);

      const { data: transaction, error: transactionInsertError } = await owner.client
        .from("finance_transactions")
        .insert({
          user_id: owner.id,
          transaction_type: "expense",
          title: "Delete trigger fixture",
          amount: 1,
          occurred_on: "2030-01-10",
        })
        .select("id")
        .single();
      expect(transactionInsertError).toBeNull();
      const transactionDelete = await owner.client
        .from("finance_transactions")
        .delete()
        .eq("id", transaction!.id);
      expect(transactionDelete.error).toBeNull();
      const { data: transactionIdentity, error: transactionIdentityError } = await owner.client
        .from("item_registry")
        .select("id")
        .eq("user_id", owner.id)
        .eq("entity_type", "expense")
        .eq("entity_id", transaction!.id);
      expect(transactionIdentityError).toBeNull();
      expect(transactionIdentity).toEqual([]);

      const unauthorizedDisconnect = await otherUser.client.rpc(
        "disconnect_external_calendar_connection",
        {
          p_user_id: owner.id,
          p_connection_id: connectionId,
        },
      );
      expect(unauthorizedDisconnect.error).not.toBeNull();
      const directDelete = await owner.client
        .from("external_calendar_connections")
        .delete()
        .eq("id", connectionId);
      expect(directDelete.error).not.toBeNull();

      const disconnected = await admin.rpc("disconnect_external_calendar_connection", {
        p_user_id: owner.id,
        p_connection_id: connectionId,
      });
      expect(disconnected.error).toBeNull();
      expect(disconnected.data).toBe(true);

      const { data: ownedEvents, error: ownedEventsError } = await owner.client
        .from("calendar_events")
        .select("title, data_origin")
        .eq("user_id", owner.id);
      expect(ownedEventsError).toBeNull();
      expect(ownedEvents).toEqual([{ title: "Keep local event", data_origin: "USER" }]);

      const { data: revokedConnection, error: revokedConnectionError } = await admin
        .from("external_calendar_connections")
        .select("status, can_write")
        .eq("id", connectionId)
        .single();
      expect(revokedConnectionError).toBeNull();
      expect(revokedConnection).toEqual({ status: "revoked", can_write: false });

      const { data: credentials, error: credentialsError } = await admin
        .from("external_calendar_credentials")
        .select("connection_id")
        .eq("connection_id", connectionId);
      expect(credentialsError).toBeNull();
      expect(credentials).toEqual([]);
      const { data: sources, error: sourcesError } = await admin
        .from("external_calendar_event_sources")
        .select("id")
        .eq("connection_id", connectionId);
      expect(sourcesError).toBeNull();
      expect(sources).toEqual([]);
      const { data: operation, error: operationError } = await admin
        .from("external_calendar_operations")
        .select("status, error_code")
        .eq("operation_id", operationId)
        .single();
      expect(operationError).toBeNull();
      expect(operation).toEqual({ status: "unknown", error_code: "response_unknown" });
    } finally {
      if (owner) await admin.auth.admin.deleteUser(owner.id);
      if (otherUser) await admin.auth.admin.deleteUser(otherUser.id);
    }
  });
});
