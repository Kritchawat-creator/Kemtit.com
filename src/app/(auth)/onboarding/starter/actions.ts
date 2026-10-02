"use server";

import { z } from "zod";

import { createGoal } from "@/core/goals/actions";
import { createHabit } from "@/core/habits/actions";
import { completeOnboarding } from "@/core/profile/actions";
import { getMe } from "@/core/profile/queries";
import { findStarterSuggestion } from "@/core/profile/starter";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createTask } from "@/core/tasks/actions";
import { startOfMonthISO, todayBkk } from "@/lib/date";
import { createServerSupabase } from "@/lib/supabase/server";

const decisionSchema = z.object({
  suggestionId: z.string().min(1).max(160),
});

const acceptSchema = decisionSchema.extend({
  title: z.string().trim().min(1, { error: "required" }).max(200, { error: "tooLong" }),
});

type AcceptedDecision = {
  status: string;
  accepted_entity_type: string | null;
  accepted_entity_id: string | null;
};

function acceptedResult(
  decision: AcceptedDecision | null,
): ActionResult<{ entityType: string; entityId: string }> | null {
  if (
    decision?.status === "accepted" &&
    decision.accepted_entity_type &&
    decision.accepted_entity_id
  ) {
    return ok({
      entityType: decision.accepted_entity_type,
      entityId: decision.accepted_entity_id,
    });
  }
  return null;
}

export async function acceptStarterSuggestion(
  input: unknown,
): Promise<ActionResult<{ entityType: string; entityId: string }>> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const me = await getMe();
  if (!me || !me.profile.role_code) return fail("unauthorized");

  const suggestion = findStarterSuggestion(
    me.profile.role_code,
    me.profile.focus_areas,
    parsed.data.suggestionId,
  );
  if (!suggestion) return fail("notFound");

  const supabase = await createServerSupabase();
  const { data: existing, error: readError } = await supabase
    .from("suggestion_decisions")
    .select("status, accepted_entity_type, accepted_entity_id")
    .eq("suggestion_id", suggestion.id)
    .maybeSingle();

  if (readError) return fail("generic");

  const alreadyAccepted = acceptedResult(existing);
  if (alreadyAccepted) return alreadyAccepted;

  // A prior request may have created the typed entity but failed before the
  // final status transition. Finish that transition instead of creating again.
  if (
    existing?.status === "pending" &&
    existing.accepted_entity_type &&
    existing.accepted_entity_id
  ) {
    const { data: finalized, error: finalizeExistingError } = await supabase
      .from("suggestion_decisions")
      .update({ status: "accepted" })
      .eq("suggestion_id", suggestion.id)
      .eq("status", "pending")
      .eq("accepted_entity_id", existing.accepted_entity_id)
      .select("status, accepted_entity_type, accepted_entity_id")
      .maybeSingle();

    if (finalizeExistingError) return fail("generic");
    const recovered = acceptedResult(finalized);
    return recovered ?? fail("suggestionPending");
  }

  if (existing?.status === "pending") return fail("suggestionPending");

  // Only one request may transition skipped → pending. Concurrent requests that
  // lose this claim must re-read instead of creating a duplicate business row.
  const claim = existing
    ? await supabase
        .from("suggestion_decisions")
        .update({
          status: "pending",
          accepted_entity_type: null,
          accepted_entity_id: null,
          custom_title: parsed.data.title,
        })
        .eq("suggestion_id", suggestion.id)
        .eq("status", "skipped")
        .select("id")
        .maybeSingle()
    : await supabase
        .from("suggestion_decisions")
        .insert({
          user_id: me.userId,
          suggestion_id: suggestion.id,
          status: "pending",
          custom_title: parsed.data.title,
        })
        .select("id")
        .maybeSingle();

  if (claim.error || !claim.data) {
    const { data: concurrent } = await supabase
      .from("suggestion_decisions")
      .select("status, accepted_entity_type, accepted_entity_id")
      .eq("suggestion_id", suggestion.id)
      .maybeSingle();

    const concurrentAccepted = acceptedResult(concurrent);
    if (concurrentAccepted) return concurrentAccepted;
    return fail("suggestionPending");
  }

  let created: ActionResult<{ id: string }>;
  const defaults = suggestion.defaultValues;

  if (defaults.kind === "task") {
    created = await createTask({
      title: parsed.data.title,
      dueDate: todayBkk(),
      domain: defaults.domain,
      recurrence: "none",
      weekdays: [],
      goalId: null,
      projectId: null,
      priority: defaults.priority,
      estimatedMinutes: defaults.estimatedMinutes ?? null,
      notes: null,
    });
  } else if (defaults.kind === "habit") {
    created = await createHabit({
      title: parsed.data.title,
      domain: defaults.domain,
      cadence: defaults.cadence,
      targetPerWeek: defaults.targetPerWeek,
      goalId: null,
      estimatedMinutes: defaults.estimatedMinutes ?? null,
    });
  } else {
    const today = todayBkk();
    created = await createGoal({
      title: parsed.data.title,
      periodType: defaults.periodType,
      periodStart: startOfMonthISO(today),
      domain: defaults.domain,
      goalKind: defaults.goalKind,
      parentId: null,
    });
  }

  if (!created.ok) {
    await supabase
      .from("suggestion_decisions")
      .delete()
      .eq("suggestion_id", suggestion.id)
      .eq("status", "pending")
      .is("accepted_entity_id", null);
    return created;
  }

  // Stage the canonical id while status is still pending. If the final status
  // update fails, a retry can recover this exact entity instead of duplicating it.
  const { data: staged, error: stageError } = await supabase
    .from("suggestion_decisions")
    .update({
      accepted_entity_type: suggestion.type,
      accepted_entity_id: created.data.id,
      custom_title: parsed.data.title,
    })
    .eq("suggestion_id", suggestion.id)
    .eq("status", "pending")
    .is("accepted_entity_id", null)
    .select("id")
    .maybeSingle();

  if (stageError || !staged) {
    console.error("[starter] stage accepted entity failed", {
      code: stageError?.code,
      suggestionId: suggestion.id,
      entityId: created.data.id,
    });
    return fail("generic");
  }

  const { data: finalized, error: finalizeError } = await supabase
    .from("suggestion_decisions")
    .update({ status: "accepted" })
    .eq("suggestion_id", suggestion.id)
    .eq("status", "pending")
    .eq("accepted_entity_id", created.data.id)
    .select("status, accepted_entity_type, accepted_entity_id")
    .maybeSingle();

  if (finalizeError) {
    console.error("[starter] finalize decision failed", {
      code: finalizeError.code,
      suggestionId: suggestion.id,
      entityId: created.data.id,
    });
    return fail("generic");
  }

  return (
    acceptedResult(finalized) ??
    fail("generic")
  );
}

export async function skipStarterSuggestion(
  input: unknown,
): Promise<ActionResult<{ status: "accepted" | "skipped" }>> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const me = await getMe();
  if (!me || !me.profile.role_code) return fail("unauthorized");

  const suggestion = findStarterSuggestion(
    me.profile.role_code,
    me.profile.focus_areas,
    parsed.data.suggestionId,
  );
  if (!suggestion) return fail("notFound");

  const supabase = await createServerSupabase();
  const { data: existing, error: readError } = await supabase
    .from("suggestion_decisions")
    .select("status")
    .eq("suggestion_id", suggestion.id)
    .maybeSingle();

  if (readError) return fail("generic");
  if (existing?.status === "accepted") return ok({ status: "accepted" });
  if (existing?.status === "pending") return fail("suggestionPending");

  const result = existing
    ? await supabase
        .from("suggestion_decisions")
        .update({
          status: "skipped",
          accepted_entity_type: null,
          accepted_entity_id: null,
          custom_title: null,
        })
        .eq("suggestion_id", suggestion.id)
        .eq("status", "skipped")
    : await supabase.from("suggestion_decisions").insert({
        user_id: me.userId,
        suggestion_id: suggestion.id,
        status: "skipped",
      });

  if (result.error) return fail("generic");
  return ok({ status: "skipped" });
}

export async function finishStarterWorkspace(): Promise<ActionResult<{ next: string }>> {
  return completeOnboarding();
}
