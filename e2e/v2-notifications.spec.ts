import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../src/types/database";

import { onboardNewUser } from "./helpers";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("local Supabase admin env is required");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test("V2 LINE producer → opt-in source event is idempotent", async ({ page }) => {
  const email = await onboardNewUser(page, "v2-line-producer");
  const admin = adminClient();

  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  expect(usersError).toBeNull();
  const user = usersPage?.users.find((candidate) => candidate.email === email);
  expect(user).toBeTruthy();
  if (!user) throw new Error("E2E user was not found through the admin API");

  const userId = user.id;
  const { error: profileError } = await admin
    .from("user_profiles")
    .update({
      line_user_id: `U-e2e-${userId}`,
      line_linked_at: new Date().toISOString(),
      notify_daily_brief: true,
    })
    .eq("id", userId);
  expect(profileError).toBeNull();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET is required for producer E2E");

  const callProducer = () =>
    page.request.post("/api/cron/generate-v2-notifications?phase=morning", {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

  const first = await callProducer();
  expect(first.ok()).toBe(true);
  const firstJson = (await first.json()) as {
    eventsCreated: number;
    duplicatesSkipped: number;
  };
  expect(firstJson.eventsCreated).toBeGreaterThanOrEqual(1);

  const second = await callProducer();
  expect(second.ok()).toBe(true);
  const secondJson = (await second.json()) as {
    eventsCreated: number;
    duplicatesSkipped: number;
  };
  expect(secondJson.duplicatesSkipped).toBeGreaterThanOrEqual(1);

  const { data: briefs, error: briefsError } = await admin
    .from("domain_events")
    .select("id, dedupe_key")
    .eq("user_id", userId)
    .eq("event_type", "daily.brief");

  expect(briefsError).toBeNull();
  expect(briefs).toHaveLength(1);
  expect(briefs?.[0]?.dedupe_key).toMatch(/^daily\.brief:/);
});
