import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { PHOTO_BUCKET } from "@/lib/supabase/storage";
import type { Database } from "@/types/database";

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

function userClient(): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, storageKey: crypto.randomUUID() },
  });
}

async function createUser(admin: DbClient) {
  const email = `kemtit-photo-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error("Could not create photo integration user");
  return { id: data.user.id, email, password };
}

describe.skipIf(!integrationEnabled)("atomic task photo attachment on local Supabase", () => {
  it("checks object ownership, task state, replay, direct inserts, and concurrent limits", async () => {
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");
    const supabaseHost = new URL(supabaseUrl).hostname;
    expect(
      ["127.0.0.1", "localhost", "[::1]"],
      "integration writes must target local Supabase",
    ).toContain(supabaseHost);
    const admin = serviceClient();
    const userIds: string[] = [];
    const taskIds: string[] = [];
    const uploadedPaths: string[] = [];

    try {
      const owner = await createUser(admin);
      userIds.push(owner.id);
      const other = await createUser(admin);
      userIds.push(other.id);

      const client = userClient();
      const { error: signInError } = await client.auth.signInWithPassword({
        email: owner.email,
        password: owner.password,
      });
      expect(signInError).toBeNull();

      async function createTask(userId: string, title: string) {
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
          .select("id")
          .single();
        expect(error).toBeNull();
        expect(data).not.toBeNull();
        taskIds.push(data!.id);
        return data!.id;
      }

      async function uploadForTask(taskId: string) {
        const path = `${owner.id}/${taskId}/${crypto.randomUUID()}.png`;
        uploadedPaths.push(path);
        const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, ONE_PIXEL_PNG, {
          contentType: "image/png",
          upsert: false,
        });
        expect(error).toBeNull();
        return path;
      }

      async function attach(taskId: string, path: string) {
        return client.rpc("attach_task_photo_atomic", { p_task_id: taskId, p_path: path });
      }

      const ownTaskId = await createTask(owner.id, "Photo integration active task");
      const firstPath = await uploadForTask(ownTaskId);

      const directInsert = await client.from("task_photos").insert({
        task_id: ownTaskId,
        user_id: owner.id,
        path: firstPath,
      });
      expect(directInsert.error).not.toBeNull();

      const firstAttach = await attach(ownTaskId, firstPath);
      expect(firstAttach.error).toBeNull();
      expect(firstAttach.data).toEqual(expect.any(String));
      const replay = await attach(ownTaskId, firstPath);
      expect(replay.error).toBeNull();
      expect(replay.data).toBe(firstAttach.data);

      const { data: replayRows, error: replayRowsError } = await admin
        .from("task_photos")
        .select("id")
        .eq("task_id", ownTaskId);
      expect(replayRowsError).toBeNull();
      expect(replayRows).toHaveLength(1);

      const missingObjectPath = `${owner.id}/${ownTaskId}/${crypto.randomUUID()}.png`;
      const missingObject = await attach(ownTaskId, missingObjectPath);
      expect(missingObject.error?.message).toContain("photo_object_missing");

      const otherTaskId = await createTask(other.id, "Photo integration other-user task");
      const forgedPath = await uploadForTask(otherTaskId);
      const forgedAttach = await attach(otherTaskId, forgedPath);
      expect(forgedAttach.error?.message).toContain("task_not_found");

      const archivedTaskId = await createTask(owner.id, "Photo integration archived task");
      const { error: archiveError } = await admin
        .from("tasks")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("id", archivedTaskId);
      expect(archiveError).toBeNull();
      const archivedPath = await uploadForTask(archivedTaskId);
      const archivedAttach = await attach(archivedTaskId, archivedPath);
      expect(archivedAttach.error?.message).toContain("task_not_found");

      const capacityTaskId = await createTask(owner.id, "Photo integration capacity task");
      const candidatePaths = await Promise.all(
        Array.from({ length: 7 }, () => uploadForTask(capacityTaskId)),
      );
      const attempts = await Promise.all(
        candidatePaths.map((path) => attach(capacityTaskId, path)),
      );
      expect(attempts.filter((attempt) => !attempt.error)).toHaveLength(5);
      expect(
        attempts.filter((attempt) => attempt.error?.message.includes("photo_limit")),
      ).toHaveLength(2);

      const { data: capacityRows, error: capacityRowsError } = await admin
        .from("task_photos")
        .select("id")
        .eq("task_id", capacityTaskId);
      expect(capacityRowsError).toBeNull();
      expect(capacityRows).toHaveLength(5);
    } finally {
      if (uploadedPaths.length > 0) {
        await admin.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
      }
      if (taskIds.length > 0) {
        await admin.from("tasks").delete().in("id", taskIds);
      }
      for (const userId of userIds) {
        await admin.auth.admin.deleteUser(userId);
      }
    }
  });
});
