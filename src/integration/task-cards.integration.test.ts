import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { signInAndApproveFixtureSession } from "@/integration/support/auth";
import { PHOTO_BUCKET } from "@/lib/supabase/storage";
import type { Database, Json } from "@/types/database";

type DbClient = SupabaseClient<Database>;
const integrationEnabled = process.env.V2_INTEGRATION === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ONE_PIXEL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
]);

function serviceClient(): DbClient {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function userClient(storageKey = crypto.randomUUID()): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey },
  });
}

async function createUser(admin: DbClient) {
  const email = `kemtit-task-card-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Could not create task-card integration user");
  return { id: data.user.id, email, password };
}

async function createTask(admin: DbClient, userId: string, title: string) {
  const { data, error } = await admin
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      domain: "work",
      status: "planned",
      priority: "normal",
      planned_date: "2030-04-01",
      due_date: "2030-04-01",
    })
    .select("id,updated_at")
    .single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();
  return data!;
}

function assertLocalConfiguration() {
  expect(supabaseUrl).not.toBe("");
  expect(anonKey).not.toBe("");
  expect(serviceRoleKey).not.toBe("");
  const host = new URL(supabaseUrl).hostname;
  expect(["127.0.0.1", "localhost", "[::1]"], "integration writes must target local Supabase").toContain(host);
}

async function sha256(bytes: Uint8Array) {
  const content = new Uint8Array(bytes.byteLength);
  content.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", content.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe.skipIf(!integrationEnabled)("task cards, groups, and ordered photos on local Supabase", () => {
  it("keeps group membership one-level, versioned, replayable, owner-scoped, and safely undoable", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];
    const taskIds: string[] = [];

    try {
      const owner = await createUser(admin);
      const other = await createUser(admin);
      userIds.push(owner.id, other.id);
      const client = userClient();
      const otherClient = userClient();
      await signInAndApproveFixtureSession(client, admin, {
        email: owner.email, password: owner.password, userId: owner.id,
      });
      await signInAndApproveFixtureSession(otherClient, admin, {
        email: other.email, password: other.password, userId: other.id,
      });

      const first = await createTask(admin, owner.id, "Group member one");
      const second = await createTask(admin, owner.id, "Group member two");
      const third = await createTask(admin, owner.id, "Group member three");
      taskIds.push(first.id, second.id, third.id);

      const createRequest = {
        p_operation_id: crypto.randomUUID(),
        p_action: "create",
        p_group_id: null,
        p_task_ids: [first.id, second.id],
        p_title: "First set",
        p_expected_group_versions: [] as Json,
        p_expected_task_states: [
          { id: first.id, updatedAt: first.updated_at, groupId: null },
          { id: second.id, updatedAt: second.updated_at, groupId: null },
        ] as Json,
      };
      const created = await client.rpc("mutate_task_card_group_atomic", createRequest);
      expect(created.error).toBeNull();
      expect(created.data).toMatchObject({ operationId: createRequest.p_operation_id, action: "create", canUndo: true });
      const replay = await client.rpc("mutate_task_card_group_atomic", createRequest);
      expect(replay.error).toBeNull();
      expect(replay.data).toEqual(created.data);
      const groupId = (created.data as { groupId: string }).groupId;

      const initialGroup = await client.from("task_groups").select("version").eq("id", groupId).single();
      expect(initialGroup.error).toBeNull();
      const renameRequest = {
        p_operation_id: crypto.randomUUID(),
        p_action: "rename",
        p_group_id: groupId,
        p_task_ids: [],
        p_title: "Renamed set",
        p_expected_group_versions: [{ groupId, version: initialGroup.data!.version }] as Json,
        p_expected_task_states: [] as Json,
      };
      const renamed = await client.rpc("mutate_task_card_group_atomic", renameRequest);
      expect(renamed.error).toBeNull();
      expect(renamed.data).toMatchObject({ groupId, action: "rename", canUndo: true });

      const directMembershipChange = await client
        .from("tasks")
        .update({ task_group_id: groupId, task_group_position: 3 })
        .eq("id", third.id);
      expect(directMembershipChange.error).not.toBeNull();

      const hiddenGroup = await otherClient.from("task_groups").select("id").eq("id", groupId).maybeSingle();
      expect(hiddenGroup.error).toBeNull();
      expect(hiddenGroup.data).toBeNull();
      const foreignMutation = await otherClient.rpc("mutate_task_card_group_atomic", {
        p_operation_id: crypto.randomUUID(),
        p_action: "rename",
        p_group_id: groupId,
        p_task_ids: [],
        p_title: "Stolen title",
        p_expected_group_versions: [],
        p_expected_task_states: [],
      });
      expect(foreignMutation.error?.message).toContain("group_not_found");

      const group = await client.from("task_groups").select("version").eq("id", groupId).single();
      expect(group.error).toBeNull();
      const members = await client.from("tasks").select("id,updated_at,task_group_id").eq("task_group_id", groupId);
      expect(members.error).toBeNull();
      const addRequest = {
        p_operation_id: crypto.randomUUID(),
        p_action: "add",
        p_group_id: groupId,
        p_task_ids: [third.id],
        p_title: null,
        p_expected_group_versions: [{ groupId, version: group.data!.version }] as Json,
        p_expected_task_states: [
          ...(members.data ?? []).map((task) => ({ id: task.id, updatedAt: task.updated_at, groupId: task.task_group_id })),
          { id: third.id, updatedAt: third.updated_at, groupId: null },
        ] as Json,
      };
      const added = await client.rpc("mutate_task_card_group_atomic", addRequest);
      expect(added.error).toBeNull();

      const staleUndo = await client.rpc("undo_task_card_group_atomic", {
        p_operation_id: renameRequest.p_operation_id,
      });
      expect(staleUndo.error?.message).toContain("undo_conflict");
      const stillGrouped = await client.from("tasks").select("task_group_id").eq("id", third.id).single();
      expect(stillGrouped.data?.task_group_id).toBe(groupId);

      const undoAdd = await client.rpc("undo_task_card_group_atomic", {
        p_operation_id: addRequest.p_operation_id,
      });
      expect(undoAdd.error).toBeNull();
      expect(undoAdd.data).toMatchObject({ undone: true, canUndo: false });
      const repeatedUndo = await client.rpc("undo_task_card_group_atomic", {
        p_operation_id: addRequest.p_operation_id,
      });
      expect(repeatedUndo.error).toBeNull();
      expect(repeatedUndo.data).toMatchObject({ undone: true, canUndo: false });

      const unauthorized = userClient();
      const anonymousMutation = await unauthorized.rpc("mutate_task_card_group_atomic", createRequest);
      expect(anonymousMutation.error).not.toBeNull();

      const titleUpdate = await client.from("task_groups").update({ title: "Direct edit" }).eq("id", groupId);
      expect(titleUpdate.error).not.toBeNull();
    } finally {
      if (taskIds.length) await admin.from("tasks").delete().in("id", taskIds);
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("retains a source group after members move out and deletes it only when empty", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];
    const taskIds: string[] = [];

    try {
      const owner = await createUser(admin);
      userIds.push(owner.id);
      const client = userClient();
      await signInAndApproveFixtureSession(client, admin, {
        email: owner.email,
        password: owner.password,
        userId: owner.id,
      });

      const tasks = await Promise.all([
        createTask(admin, owner.id, "Singleton source one"),
        createTask(admin, owner.id, "Singleton source two"),
        createTask(admin, owner.id, "Singleton target one"),
        createTask(admin, owner.id, "Singleton target two"),
      ]);
      taskIds.push(...tasks.map((task) => task.id));

      async function createGroup(
        title: string,
        members: Array<{ id: string; updated_at: string }>,
      ) {
        const created = await client.rpc("mutate_task_card_group_atomic", {
          p_operation_id: crypto.randomUUID(),
          p_action: "create",
          p_group_id: null,
          p_task_ids: members.map((task) => task.id),
          p_title: title,
          p_expected_group_versions: [] as Json,
          p_expected_task_states: members.map((task) => ({
            id: task.id,
            updatedAt: task.updated_at,
            groupId: null,
          })) as Json,
        });
        expect(created.error).toBeNull();
        return (created.data as { groupId: string }).groupId;
      }

      const sourceGroupId = await createGroup("Source group", tasks.slice(0, 2));
      const targetGroupId = await createGroup("Target group", tasks.slice(2));

      async function groupVersions(groupIds: string[]) {
        const result = await client.from("task_groups").select("id,version").in("id", groupIds);
        expect(result.error).toBeNull();
        return (result.data ?? []).map((group) => ({ groupId: group.id, version: group.version })) as Json;
      }

      async function taskStates(ids: string[]) {
        const result = await client.from("tasks").select("id,updated_at,task_group_id").in("id", ids);
        expect(result.error).toBeNull();
        return (result.data ?? []).map((task) => ({
          id: task.id,
          updatedAt: task.updated_at,
          groupId: task.task_group_id,
        })) as Json;
      }

      const transfer = await client.rpc("mutate_task_card_group_atomic", {
        p_operation_id: crypto.randomUUID(),
        p_action: "add",
        p_group_id: targetGroupId,
        p_task_ids: [tasks[1]!.id],
        p_title: null,
        p_expected_group_versions: await groupVersions([sourceGroupId, targetGroupId]),
        p_expected_task_states: await taskStates(tasks.map((task) => task.id)),
      });
      expect(transfer.error).toBeNull();
      const singletonSource = await client
        .from("task_groups")
        .select("id")
        .eq("id", sourceGroupId)
        .maybeSingle();
      expect(singletonSource.error).toBeNull();
      expect(singletonSource.data?.id).toBe(sourceGroupId);
      const singletonMembers = await client
        .from("tasks")
        .select("id")
        .eq("task_group_id", sourceGroupId);
      expect(singletonMembers.data).toEqual([{ id: tasks[0]!.id }]);

      const undoTransfer = await client.rpc("undo_task_card_group_atomic", {
        p_operation_id: (transfer.data as { operationId: string }).operationId,
      });
      expect(undoTransfer.error).toBeNull();
      expect(undoTransfer.data).toMatchObject({ undone: true });

      const removeAll = await client.rpc("mutate_task_card_group_atomic", {
        p_operation_id: crypto.randomUUID(),
        p_action: "remove",
        p_group_id: sourceGroupId,
        p_task_ids: [tasks[0]!.id, tasks[1]!.id],
        p_title: null,
        p_expected_group_versions: await groupVersions([sourceGroupId]),
        p_expected_task_states: await taskStates([tasks[0]!.id, tasks[1]!.id]),
      });
      expect(removeAll.error).toBeNull();
      const emptyGroup = await client.from("task_groups").select("id").eq("id", sourceGroupId).maybeSingle();
      expect(emptyGroup.error).toBeNull();
      expect(emptyGroup.data).toBeNull();

      const undoRemove = await client.rpc("undo_task_card_group_atomic", {
        p_operation_id: (removeAll.data as { operationId: string }).operationId,
      });
      expect(undoRemove.error).toBeNull();
      const restoredGroup = await client.from("task_groups").select("id").eq("id", sourceGroupId).maybeSingle();
      expect(restoredGroup.data?.id).toBe(sourceGroupId);
      const restoredMembers = await client
        .from("tasks")
        .select("id")
        .eq("task_group_id", sourceGroupId)
        .order("task_group_position");
      expect(restoredMembers.data?.map((task) => task.id)).toEqual([tasks[0]!.id, tasks[1]!.id]);
    } finally {
      if (taskIds.length) await admin.from("tasks").delete().in("id", taskIds);
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });

  it("reserves photos in selection order, resolves legacy attaches, and releases failed slots safely", async () => {
    assertLocalConfiguration();
    const admin = serviceClient();
    const userIds: string[] = [];
    const taskIds: string[] = [];
    const uploadedPaths: string[] = [];

    try {
      const owner = await createUser(admin);
      const other = await createUser(admin);
      userIds.push(owner.id, other.id);
      const client = userClient();
      const otherClient = userClient();
      const anonymous = userClient();
      await signInAndApproveFixtureSession(client, admin, {
        email: owner.email, password: owner.password, userId: owner.id,
      });
      await signInAndApproveFixtureSession(otherClient, admin, {
        email: other.email, password: other.password, userId: other.id,
      });
      const task = await createTask(admin, owner.id, "Ordered photo task");
      taskIds.push(task.id);

      async function reserve(operationId: string, mimeType = "image/png") {
        const { data, error } = await client.rpc("reserve_task_card_photo_atomic", {
          p_task_id: task.id,
          p_operation_id: operationId,
          p_mime_type: mimeType,
          p_content_sha256: await sha256(ONE_PIXEL_PNG),
        });
        expect(error).toBeNull();
        return data as { path: string; sort_order: number; status: string };
      }

      async function upload(path: string, contentType = "image/png", body: Uint8Array = ONE_PIXEL_PNG) {
        uploadedPaths.push(path);
        const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, body, { contentType, upsert: false });
        expect(error).toBeNull();
      }

      async function attach(operationId: string, path: string) {
        return client.rpc("attach_task_card_photo_reservation_atomic", {
          p_task_id: task.id, p_operation_id: operationId, p_path: path,
        });
      }

      const firstOperation = crypto.randomUUID();
      const secondOperation = crypto.randomUUID();
      const firstReservation = await reserve(firstOperation);
      const secondReservation = await reserve(secondOperation);
      expect(firstReservation.sort_order).toBe(0);
      expect(secondReservation.sort_order).toBe(1);

      // Attach the second selection first to prove network completion does not choose the cover.
      await upload(secondReservation.path);
      const secondAttach = await attach(secondOperation, secondReservation.path);
      expect(secondAttach.error).toBeNull();
      await upload(firstReservation.path);
      const firstAttach = await attach(firstOperation, firstReservation.path);
      expect(firstAttach.error).toBeNull();
      const secondReplay = await attach(secondOperation, secondReservation.path);
      expect(secondReplay.data).toBe(secondAttach.data);

      const ordered = await client.from("task_photos").select("id,path,sort_order").eq("task_id", task.id).order("sort_order");
      expect(ordered.error).toBeNull();
      expect(ordered.data?.map((photo) => photo.path)).toEqual([firstReservation.path, secondReservation.path]);

      const duplicateOrder = await client.rpc("set_task_photo_order_atomic", {
        p_task_id: task.id,
        p_photo_ids: [firstAttach.data!, firstAttach.data!],
      });
      expect(duplicateOrder.error?.message).toContain("photo_order_conflict");
      const reversed = await client.rpc("set_task_photo_order_atomic", {
        p_task_id: task.id,
        p_photo_ids: [secondAttach.data!, firstAttach.data!],
      });
      expect(reversed.error).toBeNull();

      const legacyOperation = crypto.randomUUID();
      const legacyReservation = await reserve(legacyOperation);
      await upload(legacyReservation.path);
      const legacyAttach = await client.rpc("attach_task_photo_atomic", {
        p_task_id: task.id,
        p_path: legacyReservation.path,
      });
      expect(legacyAttach.error).toBeNull();
      const legacyRow = await client.from("task_photos").select("sort_order").eq("id", legacyAttach.data!).single();
      expect(legacyRow.data?.sort_order).toBe(2);
      const reservationState = await client
        .from("task_photo_reservations")
        .select("status,photo_id")
        .eq("task_id", task.id)
        .eq("operation_id", legacyOperation)
        .single();
      expect(reservationState.data).toMatchObject({ status: "attached", photo_id: legacyAttach.data });

      const cancelledOperation = crypto.randomUUID();
      const cancelledReservation = await reserve(cancelledOperation);
      const cancelled = await client.rpc("cancel_task_card_photo_reservation_atomic", {
        p_task_id: task.id, p_operation_id: cancelledOperation,
      });
      expect(cancelled.error).toBeNull();
      expect(cancelled.data).toMatchObject({ status: "cancelled", photoId: null });
      const cancelReplay = await client.rpc("cancel_task_card_photo_reservation_atomic", {
        p_task_id: task.id, p_operation_id: cancelledOperation,
      });
      expect(cancelReplay.error).toBeNull();
      expect(cancelReplay.data).toEqual(cancelled.data);
      const afterCancel = await reserve(crypto.randomUUID());
      expect(afterCancel.sort_order).toBe(3);

      const otherTask = await createTask(admin, other.id, "Other owner photo task");
      taskIds.push(otherTask.id);
      const foreignAttach = await client.rpc("attach_task_photo_atomic", {
        p_task_id: otherTask.id, p_path: `${owner.id}/${otherTask.id}/${crypto.randomUUID()}.png`,
      });
      expect(foreignAttach.error?.message).toContain("task_not_found");

      const directReservationWrite = await client.from("task_photo_reservations").update({ status: "cancelled" }).eq("task_id", task.id);
      expect(directReservationWrite.error).not.toBeNull();
      const directPhotoInsert = await client.from("task_photos").insert({
        task_id: task.id, user_id: owner.id, path: `${owner.id}/${task.id}/${crypto.randomUUID()}.png`, sort_order: 4,
      });
      expect(directPhotoInsert.error).not.toBeNull();

      const deniedReserve = await anonymous.rpc("reserve_task_card_photo_atomic", {
        p_task_id: task.id,
        p_operation_id: crypto.randomUUID(),
        p_mime_type: "image/png",
        p_content_sha256: await sha256(ONE_PIXEL_PNG),
      });
      expect(deniedReserve.error).not.toBeNull();

      // Wrong Storage metadata must not strand a reservation or cause the function to delete bytes.
      const invalidObjectOperation = crypto.randomUUID();
      const invalidObject = await reserve(invalidObjectOperation, "image/jpeg");
      await upload(invalidObject.path, "image/png");
      const invalidCancel = await client.rpc("cancel_task_card_photo_reservation_atomic", {
        p_task_id: task.id, p_operation_id: invalidObjectOperation,
      });
      expect(invalidCancel.error).toBeNull();
      expect(invalidCancel.data).toMatchObject({ status: "cancelled" });
      const invalidObjectStillPrivate = await admin.storage.from(PHOTO_BUCKET).list(`${owner.id}/${task.id}`);
      expect(invalidObjectStillPrivate.error).toBeNull();
      expect(invalidObjectStillPrivate.data?.some((object) => object.name === invalidObject.path.split("/").at(-1))).toBe(true);
    } finally {
      if (uploadedPaths.length) await admin.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
      if (taskIds.length) await admin.from("tasks").delete().in("id", taskIds);
      for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
    }
  });
});
