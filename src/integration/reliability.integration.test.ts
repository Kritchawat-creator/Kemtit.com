import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;
type DomainEvent = Database["public"]["Tables"]["domain_events"]["Row"];

const integrationEnabled = process.env.V2_INTEGRATION === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function createServiceClient(): DbClient {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: "kemtit-v2-integration-service",
    },
  });
}

function createUserClient(): DbClient {
  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: `kemtit-v2-integration-user-${crypto.randomUUID()}`,
    },
  });
}

async function createTestUser(admin: DbClient) {
  const email = `kemtit-v2-${crypto.randomUUID()}@example.test`;
  const password = `Kemtit-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("test user was not created");

  const client = createUserClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { client, id: data.user.id };
}

async function insertSourceEvent(admin: DbClient, userId: string) {
  const { data, error } = await admin
    .from("domain_events")
    .insert({
      user_id: userId,
      event_type: "task.overdue",
      payload: { taskIds: [], date: "2030-01-01" },
      created_at: "1970-01-01T00:00:00.000Z",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("source event was not created");
  return data.id;
}

async function claimEvents(admin: DbClient): Promise<DomainEvent[]> {
  const { data, error } = await admin.rpc("claim_domain_events", {
    p_limit: 1,
    p_max_attempts: 5,
  });
  expect(error).toBeNull();
  return (data ?? []) as DomainEvent[];
}

async function reserveNotification(admin: DbClient, userId: string, sourceEventId: string) {
  return admin
    .from("domain_events")
    .insert({
      user_id: userId,
      event_type: "notification.sent",
      processed_at: new Date().toISOString(),
      payload: {
        channel: "line",
        kind: "task.overdue",
        dryRun: false,
        sourceEventId,
      },
    })
    .select("id")
    .single();
}

async function updateFailedClaim(admin: DbClient, eventId: string, attempts: number) {
  const { error } = await admin
    .from("domain_events")
    .update({
      attempts,
      processing_at: null,
      last_error: "simulated provider failure",
    })
    .eq("id", eventId);
  expect(error).toBeNull();
}

describe.skipIf(!integrationEnabled)("V2 local Supabase reliability", () => {
  it("serializes claims, completes goals once, blocks time overlaps, and preserves notification idempotency", async () => {
    expect(supabaseUrl).not.toBe("");
    expect(anonKey).not.toBe("");
    expect(serviceRoleKey).not.toBe("");

    const admin = createServiceClient();
    const user = await createTestUser(admin);

    try {
      const claimedSourceId = await insertSourceEvent(admin, user.id);
      const [firstClaim, secondClaim] = await Promise.all([claimEvents(admin), claimEvents(admin)]);
      const claimed = [...firstClaim, ...secondClaim].filter(
        (event) => event.id === claimedSourceId,
      );
      expect(claimed).toHaveLength(1);

      for (const goalKind of ["metric", "execution"] as const) {
        const { data: goal, error: goalError } = await user.client
          .from("goals")
          .insert({
            user_id: user.id,
            title: `Concurrent ${goalKind} goal`,
            period_type: "month",
            period_start: "2030-01-01",
            domain: "work",
            goal_kind: goalKind,
            target_value: goalKind === "metric" ? 100 : null,
          })
          .select("id")
          .single();
        expect(goalError).toBeNull();
        expect(goal).not.toBeNull();

        const [completionA, completionB] = await Promise.all([
          user.client.rpc("complete_goal_once", { p_goal_id: goal!.id }),
          user.client.rpc("complete_goal_once", { p_goal_id: goal!.id }),
        ]);
        expect(completionA.error).toBeNull();
        expect(completionB.error).toBeNull();
        expect([completionA.data, completionB.data].sort()).toEqual([false, true]);

        const { data: completionEvents, error: completionEventError } = await admin
          .from("domain_events")
          .select("id, payload")
          .eq("user_id", user.id)
          .eq("event_type", "goal.completed");
        expect(completionEventError).toBeNull();
        expect(
          completionEvents?.filter(
            (event) => (event.payload as { goalId?: string }).goalId === goal!.id,
          ),
        ).toHaveLength(1);
      }

      const startAt = "2030-02-01T09:00:00.000Z";
      const endAt = "2030-02-01T10:00:00.000Z";
      const overlapStart = "2030-02-01T09:30:00.000Z";
      const overlapEnd = "2030-02-01T10:30:00.000Z";
      const [blockA, blockB] = await Promise.all([
        user.client.rpc("create_time_block_atomic", {
          p_title: "Concurrent block A",
          p_start_at: startAt,
          p_end_at: endAt,
          p_source: "manual",
        }),
        user.client.rpc("create_time_block_atomic", {
          p_title: "Concurrent block B",
          p_start_at: overlapStart,
          p_end_at: overlapEnd,
          p_source: "manual",
        }),
      ]);
      expect(blockA.error).toBeNull();
      expect(blockB.error).toBeNull();
      expect([blockA.data, blockB.data].filter(Boolean)).toHaveLength(1);

      const { data: blocks, error: blocksError } = await admin
        .from("time_blocks")
        .select("id")
        .eq("user_id", user.id);
      expect(blocksError).toBeNull();
      expect(blocks).toHaveLength(1);

      const cancelledStart = "2030-02-01T11:00:00.000Z";
      const cancelledEnd = "2030-02-01T11:30:00.000Z";
      const blockToCancel = await user.client.rpc("create_time_block_atomic", {
        p_title: "Cancelled block",
        p_start_at: cancelledStart,
        p_end_at: cancelledEnd,
        p_source: "manual",
      });
      expect(blockToCancel.error).toBeNull();
      expect(blockToCancel.data).not.toBeNull();

      const cancelled = await user.client.rpc("set_time_block_status_atomic", {
        p_id: blockToCancel.data!,
        p_expected_version: 1,
        p_status: "cancelled",
      });
      expect(cancelled.error).toBeNull();
      expect(cancelled.data).toBe(blockToCancel.data);

      const replacement = await user.client.rpc("create_time_block_atomic", {
        p_title: "Replacement for cancelled block",
        p_start_at: cancelledStart,
        p_end_at: cancelledEnd,
        p_source: "manual",
      });
      expect(replacement.error).toBeNull();
      expect(replacement.data).not.toBeNull();

      const preparedStart = "2030-02-01T12:00:00.000Z";
      const preparedEnd = "2030-02-01T12:30:00.000Z";
      const { data: preparedBlock, error: preparedBlockError } = await user.client
        .from("time_blocks")
        .insert({
          user_id: user.id,
          title: "Prepared block",
          start_at: preparedStart,
          end_at: preparedEnd,
        })
        .select("id")
        .single();
      expect(preparedBlockError).toBeNull();
      expect(preparedBlock).not.toBeNull();
      const { error: preparedOriginError } = await admin
        .from("time_blocks")
        .update({ data_origin: "SYSTEM" })
        .eq("id", preparedBlock!.id);
      expect(preparedOriginError).toBeNull();

      const createdBesidePrepared = await user.client.rpc("create_time_block_atomic", {
        p_title: "Created beside prepared block",
        p_start_at: preparedStart,
        p_end_at: preparedEnd,
        p_source: "manual",
      });
      expect(createdBesidePrepared.error).toBeNull();
      expect(createdBesidePrepared.data).not.toBeNull();

      const cancelledBesidePrepared = await user.client.rpc("set_time_block_status_atomic", {
        p_id: createdBesidePrepared.data!,
        p_expected_version: 1,
        p_status: "cancelled",
      });
      expect(cancelledBesidePrepared.error).toBeNull();
      expect(cancelledBesidePrepared.data).toBe(createdBesidePrepared.data);

      const updateSourceStart = "2030-02-01T10:30:00.000Z";
      const updateSourceEnd = "2030-02-01T11:00:00.000Z";
      const updateSource = await user.client.rpc("create_time_block_atomic", {
        p_title: "Block moved beside prepared block",
        p_start_at: updateSourceStart,
        p_end_at: updateSourceEnd,
        p_source: "manual",
      });
      expect(updateSource.error).toBeNull();
      expect(updateSource.data).not.toBeNull();

      const movedBesidePrepared = await user.client.rpc("update_time_block_atomic", {
        p_id: updateSource.data!,
        p_title: "Block moved beside prepared block",
        p_start_at: preparedStart,
        p_end_at: preparedEnd,
        p_expected_version: 1,
      });
      expect(movedBesidePrepared.error).toBeNull();
      expect(movedBesidePrepared.data).toBe(updateSource.data);

      const cancelledForReactivation = await user.client.rpc("set_time_block_status_atomic", {
        p_id: updateSource.data!,
        p_expected_version: 2,
        p_status: "cancelled",
      });
      expect(cancelledForReactivation.error).toBeNull();
      expect(cancelledForReactivation.data).toBe(updateSource.data);

      const reactivatedBesidePrepared = await user.client.rpc("set_time_block_status_atomic", {
        p_id: updateSource.data!,
        p_expected_version: 3,
        p_status: "active",
      });
      expect(reactivatedBesidePrepared.error).toBeNull();
      expect(reactivatedBesidePrepared.data).toBe(updateSource.data);

      const activeConflict = await user.client.rpc("create_time_block_atomic", {
        p_title: "Overlaps active user block",
        p_start_at: "2030-02-01T12:15:00.000Z",
        p_end_at: "2030-02-01T12:45:00.000Z",
        p_source: "manual",
      });
      expect(activeConflict.error).toBeNull();
      expect(activeConflict.data).toBeNull();

      const { data: recurringTask, error: recurringTaskError } = await user.client
        .from("tasks")
        .insert({
          user_id: user.id,
          title: "Occurrence transition task",
          due_date: "2030-03-01",
          domain: "work",
          recurrence_rule: "FREQ=DAILY",
          status: "planned",
          priority: "normal",
        })
        .select("id, recurrence_rule")
        .single();
      expect(recurringTaskError).toBeNull();
      expect(recurringTask).not.toBeNull();

      const { error: historyError } = await user.client.from("task_completions").insert({
        task_id: recurringTask!.id,
        user_id: user.id,
        completed_on: "2030-03-01",
      });
      expect(historyError).toBeNull();

      const { data: rescheduledOccurrence, error: rescheduleError } = await user.client.rpc(
        "reschedule_task_occurrence_atomic",
        {
          p_task_id: recurringTask!.id,
          p_occurrence_date: "2030-03-02",
          p_new_occurrence_date: "2030-03-04",
        },
      );
      expect(rescheduleError).toBeNull();
      expect(rescheduledOccurrence).not.toBeNull();

      const { error: naturalOccurrenceError } = await user.client
        .from("task_occurrences")
        .insert({
          task_id: recurringTask!.id,
          user_id: user.id,
          occurrence_date: "2030-03-04",
          scheduled_date: "2030-03-04",
          status: "planned",
        });
      expect(naturalOccurrenceError).toBeNull();

      const { data: occurrenceRows, error: occurrenceError } = await admin
        .from("task_occurrences")
        .select("occurrence_date, scheduled_date, status")
        .eq("task_id", recurringTask!.id)
        .eq("scheduled_date", "2030-03-04")
        .order("occurrence_date");
      expect(occurrenceError).toBeNull();
      expect(occurrenceRows).toEqual([
        {
          occurrence_date: "2030-03-02",
          scheduled_date: "2030-03-04",
          status: "planned",
        },
        {
          occurrence_date: "2030-03-04",
          scheduled_date: "2030-03-04",
          status: "planned",
        },
      ]);

      const { data: unchangedTask, error: unchangedTaskError } = await admin
        .from("tasks")
        .select("recurrence_rule")
        .eq("id", recurringTask!.id)
        .single();
      expect(unchangedTaskError).toBeNull();
      expect(unchangedTask?.recurrence_rule).toBe("FREQ=DAILY");

      const { data: preservedHistory, error: preservedHistoryError } = await admin
        .from("task_completions")
        .select("completed_on")
        .eq("task_id", recurringTask!.id);
      expect(preservedHistoryError).toBeNull();
      expect(preservedHistory).toEqual([{ completed_on: "2030-03-01" }]);

      const { error: completedOccurrenceError } = await user.client
        .from("task_occurrences")
        .upsert(
          {
            task_id: recurringTask!.id,
            user_id: user.id,
            occurrence_date: "2030-03-05",
            scheduled_date: "2030-03-05",
            status: "completed",
            completed_at: "2030-03-05T02:00:00.000Z",
            skipped_at: null,
          },
          { onConflict: "task_id,occurrence_date" },
        );
      expect(completedOccurrenceError).toBeNull();

      const { error: skippedOccurrenceError } = await user.client
        .from("task_occurrences")
        .upsert(
          {
            task_id: recurringTask!.id,
            user_id: user.id,
            occurrence_date: "2030-03-06",
            scheduled_date: "2030-03-06",
            status: "skipped",
            completed_at: null,
            skipped_at: "2030-03-06T02:00:00.000Z",
          },
          { onConflict: "task_id,occurrence_date" },
        );
      expect(skippedOccurrenceError).toBeNull();

      const explicitFailureSourceId = await insertSourceEvent(admin, user.id);
      expect((await claimEvents(admin)).map((event) => event.id)).toContain(
        explicitFailureSourceId,
      );
      const { data: failedReservation, error: failedReservationError } = await reserveNotification(
        admin,
        user.id,
        explicitFailureSourceId,
      );
      expect(failedReservationError).toBeNull();
      expect(failedReservation).not.toBeNull();

      const { error: releaseError } = await admin
        .from("domain_events")
        .delete()
        .eq("id", failedReservation!.id);
      expect(releaseError).toBeNull();
      await updateFailedClaim(admin, explicitFailureSourceId, 1);
      expect((await claimEvents(admin)).map((event) => event.id)).toContain(
        explicitFailureSourceId,
      );
      const { data: retriedReservation, error: retriedReservationError } =
        await reserveNotification(admin, user.id, explicitFailureSourceId);
      expect(retriedReservationError).toBeNull();
      expect(retriedReservation).not.toBeNull();

      const ambiguousSourceId = await insertSourceEvent(admin, user.id);
      expect((await claimEvents(admin)).map((event) => event.id)).toContain(ambiguousSourceId);
      const { data: ambiguousReservation, error: ambiguousReservationError } =
        await reserveNotification(admin, user.id, ambiguousSourceId);
      expect(ambiguousReservationError).toBeNull();
      expect(ambiguousReservation).not.toBeNull();
      await updateFailedClaim(admin, ambiguousSourceId, 1);

      expect((await claimEvents(admin)).map((event) => event.id)).toContain(ambiguousSourceId);
      const { data: duplicateReservation, error: duplicateReservationError } =
        await reserveNotification(admin, user.id, ambiguousSourceId);
      expect(duplicateReservation).toBeNull();
      expect(duplicateReservationError?.code).toBe("23505");

      const producerKey = `weekly.review.ready:${user.id}:2030-03-03`;
      const firstProduced = await admin.from("domain_events").insert({
        user_id: user.id,
        event_type: "weekly.review.ready",
        payload: { weekStart: "2030-03-03" },
        dedupe_key: producerKey,
      });
      expect(firstProduced.error).toBeNull();
      const duplicateProduced = await admin.from("domain_events").insert({
        user_id: user.id,
        event_type: "weekly.review.ready",
        payload: { weekStart: "2030-03-03" },
        dedupe_key: producerKey,
      });
      expect(duplicateProduced.error?.code).toBe("23505");

      const { data: reservations, error: reservationsError } = await admin
        .from("domain_events")
        .select("id, payload")
        .eq("user_id", user.id)
        .eq("event_type", "notification.sent");
      expect(reservationsError).toBeNull();
      expect(
        reservations?.filter((event) => {
          const payload = event.payload as { sourceEventId?: string };
          return payload.sourceEventId === ambiguousSourceId;
        }),
      ).toHaveLength(1);
    } finally {
      await admin.from("domain_events").delete().eq("user_id", user.id);
      await admin.from("time_blocks").delete().eq("user_id", user.id);
      await admin.auth.admin.deleteUser(user.id);
    }
  });
});
