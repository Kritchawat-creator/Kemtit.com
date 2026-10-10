import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";
import { signInAndApproveFixtureSession } from "@/integration/support/auth";

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

function createServiceClient(): DbClient {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: "kemtit-feedback-release-service",
    },
  });
}

function createUserClient(): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: `kemtit-feedback-release-user-${crypto.randomUUID()}`,
    },
  });
}

async function createTestIdentity(admin: DbClient) {
  const email = `kemtit-feedback-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("test user was not created");
  return { email, password, id: data.user.id };
}

async function createApprovedIdentity(admin: DbClient) {
  const identity = await createTestIdentity(admin);
  const client = createUserClient();
  try {
    await signInAndApproveFixtureSession(client, admin, {
      email: identity.email,
      password: identity.password,
      userId: identity.id,
    });
  } catch (signInError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(identity.id);
    if (cleanupError) throw cleanupError;
    throw signInError;
  }
  return { ...identity, client };
}

async function createPendingIdentity(admin: DbClient) {
  const identity = await createTestIdentity(admin);
  const client = createUserClient();
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: identity.email,
      password: identity.password,
    });
    if (error || !data.session) {
      throw error ?? new Error("pending test sign-in did not return a session");
    }
  } catch (signInError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(identity.id);
    if (cleanupError) throw cleanupError;
    throw signInError;
  }
  return { ...identity, client };
}

async function insertReleaseNotes(admin: DbClient, prefix: string) {
  const now = Date.now();
  const rows = [
    {
      version: `${prefix}-published`,
      build_id: "feedback-release-test",
      title_th: "รุ่นทดสอบ",
      title_en: "Test release",
      new_items_th: ["ข่าวสารเผยแพร่แล้ว"],
      new_items_en: ["Published release note"],
      improved_items_th: [],
      improved_items_en: [],
      fixed_items_th: [],
      fixed_items_en: [],
      published_at: new Date(now - 60_000).toISOString(),
    },
    {
      version: `${prefix}-draft`,
      build_id: "feedback-release-test",
      title_th: "ฉบับร่าง",
      title_en: "Draft release",
      new_items_th: ["ร่าง"],
      new_items_en: ["Draft"],
      improved_items_th: [],
      improved_items_en: [],
      fixed_items_th: [],
      fixed_items_en: [],
      published_at: null,
    },
    {
      version: `${prefix}-future`,
      build_id: "feedback-release-test",
      title_th: "กำหนดเผยแพร่ภายหลัง",
      title_en: "Future release",
      new_items_th: ["ข่าวสารในอนาคต"],
      new_items_en: ["Future release note"],
      improved_items_th: [],
      improved_items_en: [],
      fixed_items_th: [],
      fixed_items_en: [],
      published_at: new Date(now + 86_400_000).toISOString(),
    },
  ];

  const { data, error } = await admin.from("release_notes").insert(rows).select("id, version");
  if (error || !data) throw error ?? new Error("synthetic release notes were not created");
  return data;
}

describe.skipIf(!integrationEnabled)("feedback and release note database boundary", () => {
  it("enforces approved sessions, account isolation, retry identity, quotas, and release visibility", async () => {
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = createServiceClient();
    const testUserIds: string[] = [];
    const seededReleaseIds: string[] = [];

    try {
      const first = await createApprovedIdentity(admin);
      testUserIds.push(first.id);
      const second = await createApprovedIdentity(admin);
      testUserIds.push(second.id);
      const dailyLimitUser = await createApprovedIdentity(admin);
      testUserIds.push(dailyLimitUser.id);
      const pending = await createPendingIdentity(admin);
      testUserIds.push(pending.id);
      const anonymous = createUserClient();

      const requestId = crypto.randomUUID();
      const sameKeyResponses = await Promise.all([
        first.client.rpc("submit_user_feedback", {
          p_request_id: requestId,
          p_topic_code: "easy_to_use",
        }),
        first.client.rpc("submit_user_feedback", {
          p_request_id: requestId,
          p_topic_code: "easy_to_use",
        }),
      ]);
      expect(sameKeyResponses.map((result) => result.error)).toEqual([null, null]);
      expect(sameKeyResponses.flatMap((result) => result.data ?? []).map((row) => row.was_duplicate).sort()).toEqual([
        false,
        true,
      ]);

      const changedTopic = await first.client.rpc("submit_user_feedback", {
        p_request_id: requestId,
        p_topic_code: "slow",
      });
      expect(changedTopic.error?.message).toContain("feedback_request_conflict");

      const invalidTopic = await first.client.rpc("submit_user_feedback", {
        p_request_id: crypto.randomUUID(),
        p_topic_code: "other",
      });
      expect(invalidTopic.error?.message).toContain("feedback_validation");
      const nullTopic = await first.client.rpc("submit_user_feedback", {
        p_request_id: crypto.randomUUID(),
        p_topic_code: null as unknown as string,
      });
      expect(nullTopic.error?.message).toContain("feedback_validation");

      const { data: firstRows, error: firstRowsError } = await admin
        .from("user_feedback")
        .select("id, request_id, topic_code")
        .eq("user_id", first.id)
        .eq("request_id", requestId);
      expect(firstRowsError).toBeNull();
      expect(firstRows).toHaveLength(1);
      expect(firstRows?.[0]?.topic_code).toBe("easy_to_use");

      const forgedWrite = await first.client.from("user_feedback").insert({
        user_id: second.id,
        request_id: crypto.randomUUID(),
        topic_code: "error",
      });
      expect(forgedWrite.error).not.toBeNull();
      const hiddenFeedback = await second.client
        .from("user_feedback")
        .select("id")
        .eq("user_id", first.id);
      expect(hiddenFeedback.error).not.toBeNull();

      const anonymousWrite = await anonymous.rpc("submit_user_feedback", {
        p_request_id: crypto.randomUUID(),
        p_topic_code: "error",
      });
      expect(anonymousWrite.error).not.toBeNull();
      const pendingWrite = await pending.client.rpc("submit_user_feedback", {
        p_request_id: crypto.randomUUID(),
        p_topic_code: "error",
      });
      expect(pendingWrite.error).not.toBeNull();
      const serviceRoleWrite = await admin.rpc("submit_user_feedback", {
        p_request_id: crypto.randomUUID(),
        p_topic_code: "error",
      });
      expect(serviceRoleWrite.error).not.toBeNull();

      const competingRequests = await Promise.all([
        second.client.rpc("submit_user_feedback", {
          p_request_id: crypto.randomUUID(),
          p_topic_code: "slow",
        }),
        second.client.rpc("submit_user_feedback", {
          p_request_id: crypto.randomUUID(),
          p_topic_code: "error",
        }),
      ]);
      expect(competingRequests.filter((result) => result.error === null)).toHaveLength(1);
      expect(competingRequests.filter((result) => result.error?.message.includes("feedback_rate_limited"))).toHaveLength(1);

      const backdatedAt = new Date(Date.now() - 120_000).toISOString();
      const historicalRequests = Array.from({ length: 9 }, () => ({
        user_id: dailyLimitUser.id,
        request_id: crypto.randomUUID(),
        topic_code: "easy_to_use",
        created_at: backdatedAt,
      }));
      const { error: historyError } = await admin.from("user_feedback").insert(historicalRequests);
      expect(historyError).toBeNull();
      const firstDailyRequestId = crypto.randomUUID();
      const firstDailyRequest = await dailyLimitUser.client.rpc("submit_user_feedback", {
        p_request_id: firstDailyRequestId,
        p_topic_code: "more_features",
      });
      expect(firstDailyRequest.error).toBeNull();
      const { error: backdateInsertedError } = await admin
        .from("user_feedback")
        .update({ created_at: backdatedAt })
        .eq("user_id", dailyLimitUser.id)
        .eq("request_id", firstDailyRequestId);
      expect(backdateInsertedError).toBeNull();
      const dailyLimitResult = await dailyLimitUser.client.rpc("submit_user_feedback", {
        p_request_id: crypto.randomUUID(),
        p_topic_code: "more_features",
      });
      expect(dailyLimitResult.error?.message).toContain("feedback_rate_limited");
      const retryAtDailyLimit = await dailyLimitUser.client.rpc("submit_user_feedback", {
        p_request_id: firstDailyRequestId,
        p_topic_code: "more_features",
      });
      expect(retryAtDailyLimit.error).toBeNull();
      expect(retryAtDailyLimit.data?.[0]?.was_duplicate).toBe(true);

      const releaseRows = await insertReleaseNotes(admin, `feedback-${crypto.randomUUID()}`);
      seededReleaseIds.push(...releaseRows.map((row) => row.id));
      const publishedId = releaseRows.find((row) => row.version.endsWith("-published"))!.id;
      const draftId = releaseRows.find((row) => row.version.endsWith("-draft"))!.id;
      const futureId = releaseRows.find((row) => row.version.endsWith("-future"))!.id;

      const visibleReleases = await first.client
        .from("release_notes")
        .select("id")
        .in("id", [publishedId, draftId, futureId]);
      expect(visibleReleases.error).toBeNull();
      expect(visibleReleases.data?.map((row) => row.id)).toEqual([publishedId]);

      const futureAcknowledgement = await first.client.rpc("acknowledge_release_note", {
        p_release_note_id: futureId,
      });
      expect(futureAcknowledgement.error?.message).toContain("release_note_unavailable");
      const draftAcknowledgement = await first.client.rpc("acknowledge_release_note", {
        p_release_note_id: draftId,
      });
      expect(draftAcknowledgement.error?.message).toContain("release_note_unavailable");
      const pendingAcknowledgement = await pending.client.rpc("acknowledge_release_note", {
        p_release_note_id: publishedId,
      });
      expect(pendingAcknowledgement.error).not.toBeNull();
      const anonymousAcknowledgement = await anonymous.rpc("acknowledge_release_note", {
        p_release_note_id: publishedId,
      });
      expect(anonymousAcknowledgement.error).not.toBeNull();

      const firstAcknowledgement = await first.client.rpc("acknowledge_release_note", {
        p_release_note_id: publishedId,
      });
      const repeatedAcknowledgement = await first.client.rpc("acknowledge_release_note", {
        p_release_note_id: publishedId,
      });
      expect(firstAcknowledgement.error).toBeNull();
      expect(repeatedAcknowledgement.error).toBeNull();
      expect(repeatedAcknowledgement.data).toBe(firstAcknowledgement.data);

      const ownRead = await first.client
        .from("release_note_reads")
        .select("user_id, release_note_id, read_at")
        .eq("release_note_id", publishedId);
      const otherRead = await second.client
        .from("release_note_reads")
        .select("user_id, release_note_id")
        .eq("release_note_id", publishedId);
      expect(ownRead.data).toHaveLength(1);
      expect(ownRead.data?.[0]?.user_id).toBe(first.id);
      expect(otherRead.data).toEqual([]);

      const directReadWrite = await first.client.from("release_note_reads").insert({
        user_id: second.id,
        release_note_id: publishedId,
      });
      expect(directReadWrite.error).not.toBeNull();
      const directPublish = await first.client
        .from("release_notes")
        .update({ published_at: new Date().toISOString() })
        .eq("id", draftId);
      expect(directPublish.error).not.toBeNull();
      const directReleaseInsert = await first.client.from("release_notes").insert({
        version: `forged-${crypto.randomUUID()}`,
        build_id: "forged-build",
        title_th: "ปลอม",
        title_en: "Forged",
        new_items_th: ["รายการ"],
        new_items_en: ["Item"],
      });
      expect(directReleaseInsert.error).not.toBeNull();

      const pendingReleaseRead = await pending.client.from("release_notes").select("id");
      expect(pendingReleaseRead.error).not.toBeNull();
      const anonymousReleaseRead = await anonymous.from("release_notes").select("id");
      expect(anonymousReleaseRead.error).not.toBeNull();
    } finally {
      if (seededReleaseIds.length > 0) {
        const { error: releaseCleanupError } = await admin
          .from("release_notes")
          .delete()
          .in("id", seededReleaseIds);
        expect(releaseCleanupError).toBeNull();
      }
      for (const userId of testUserIds) {
        const { error: userCleanupError } = await admin.auth.admin.deleteUser(userId);
        expect(userCleanupError).toBeNull();
      }
    }
  });
});
