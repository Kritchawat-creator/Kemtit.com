import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database, Json } from "@/types/database";
import { signInAndApproveFixtureSession } from "@/integration/support/auth";

type DbClient = SupabaseClient<Database>;
const integrationEnabled = process.env.V2_INTEGRATION === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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

async function createApprovedUser(admin: DbClient) {
  const email = `kemtit-goal-wizard-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("integration user was not created");
  const client = userClient();
  try {
    await signInAndApproveFixtureSession(client, admin, {
      email,
      password,
      userId: data.user.id,
    });
  } catch (signInError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw signInError;
  }
  return { client, id: data.user.id };
}

describe.skipIf(!integrationEnabled)("goal wizard idempotency", () => {
  it("replays concurrent retries once and scopes request IDs to the authenticated user", async () => {
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = serviceClient();
    const users: Awaited<ReturnType<typeof createApprovedUser>>[] = [];
    try {
      users.push(await createApprovedUser(admin));
      users.push(await createApprovedUser(admin));
      const [owner, otherOwner] = users;
      const requestId = crypto.randomUUID();
      const goalTitle = "Wizard idempotency integration goal";
      const spec = {
        title: goalTitle,
        periodType: "month",
        periodStart: "2030-04-01",
        domain: "growth",
        goalKind: "execution",
        tasks: [
          {
            title: "Wizard idempotency first step",
            dueDate: "2030-04-08",
            domain: "growth",
          },
        ],
      } satisfies Json;

      const concurrent = await Promise.all([
        owner.client.rpc("create_goal_wizard", { p_request_id: requestId, p_spec: spec }),
        owner.client.rpc("create_goal_wizard", { p_request_id: requestId, p_spec: spec }),
      ]);
      expect(concurrent.map((result) => result.error)).toEqual([null, null]);
      expect(concurrent[0].data).toEqual(concurrent[1].data);
      const firstResult = concurrent[0].data?.[0];
      expect(firstResult?.goal_id).toBeTruthy();
      expect(firstResult?.task_ids).toHaveLength(1);

      const anonymousClient = userClient();
      const anonymousCall = await anonymousClient.rpc("create_goal_wizard", {
        p_request_id: crypto.randomUUID(),
        p_spec: spec,
      });
      expect(anonymousCall.error).not.toBeNull();

      const { data: ownerSession } = await owner.client.auth.getSession();
      expect(ownerSession.session).not.toBeNull();
      const forgedLedgerWrite = await fetch(`${supabaseUrl}/rest/v1/goal_wizard_operations`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${ownerSession.session!.access_token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: owner.id,
          request_id: crypto.randomUUID(),
          request_spec: spec,
          goal_id: firstResult!.goal_id,
          task_ids: firstResult!.task_ids,
        }),
      });
      expect(forgedLedgerWrite.ok).toBe(false);

      const retry = await owner.client.rpc("create_goal_wizard", {
        p_request_id: requestId,
        p_spec: spec,
      });
      expect(retry.error).toBeNull();
      expect(retry.data).toEqual(concurrent[0].data);

      const changedSpec = {
        ...spec,
        title: "Different details using the same request ID",
      } satisfies Json;
      const conflict = await owner.client.rpc("create_goal_wizard", {
        p_request_id: requestId,
        p_spec: changedSpec,
      });
      expect(conflict.error?.message).toContain("goal_wizard_idempotency_conflict");

      const separateOwnerOperation = await otherOwner.client.rpc("create_goal_wizard", {
        p_request_id: requestId,
        p_spec: spec,
      });
      expect(separateOwnerOperation.error).toBeNull();
      expect(separateOwnerOperation.data?.[0]?.goal_id).not.toBe(firstResult?.goal_id);

      const { data: visibleForeignGoal, error: visibilityError } = await otherOwner.client
        .from("goals")
        .select("id")
        .eq("id", firstResult!.goal_id);
      expect(visibilityError).toBeNull();
      expect(visibleForeignGoal).toEqual([]);

      const { data: goals, error: goalsError } = await admin
        .from("goals")
        .select("id, data_origin")
        .eq("user_id", owner.id)
        .eq("title", goalTitle);
      expect(goalsError).toBeNull();
      expect(goals).toHaveLength(1);
      expect(goals?.[0].data_origin).toBe("USER");

      const { data: tasks, error: tasksError } = await admin
        .from("tasks")
        .select("id, data_origin, goal_id")
        .eq("user_id", owner.id)
        .eq("goal_id", firstResult!.goal_id);
      expect(tasksError).toBeNull();
      expect(tasks).toHaveLength(1);
      expect(tasks?.[0].id).toBe(firstResult?.task_ids[0]);
      expect(tasks?.[0].data_origin).toBe("USER");

      const invalidAnchor = await owner.client.rpc("create_goal_wizard", {
        p_request_id: crypto.randomUUID(),
        p_spec: { ...spec, periodStart: "2030-04-02" } satisfies Json,
      });
      expect(invalidAnchor.error).not.toBeNull();
      const { data: invalidGoals, error: invalidGoalsError } = await admin
        .from("goals")
        .select("id")
        .eq("user_id", owner.id)
        .eq("title", goalTitle);
      expect(invalidGoalsError).toBeNull();
      expect(invalidGoals).toHaveLength(1);
    } finally {
      await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)));
    }
  });
});
