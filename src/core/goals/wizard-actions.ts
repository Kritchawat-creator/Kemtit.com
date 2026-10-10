"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

import { goalWizardApplySchema } from "./wizard-schema";

export async function applyGoalWizard(
  input: unknown,
): Promise<ActionResult<{ goalId: string; taskIds: string[] }>> {
  const parsed = goalWizardApplySchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return fail("unauthorized");

  const { data, error } = await supabase.rpc("create_goal_wizard", {
    p_request_id: parsed.data.requestId,
    p_spec: parsed.data.spec as Json,
  });

  if (error) {
    if (error.message.includes("goal_wizard_idempotency_conflict")) {
      return fail("idempotencyConflict");
    }
    console.error("[goals] wizard apply failed", { code: error.code });
    return fail("generic");
  }

  const result = data?.[0];
  if (!result?.goal_id || !Array.isArray(result.task_ids) || result.task_ids.length !== 1) {
    console.error("[goals] wizard apply returned an invalid result");
    return fail("generic");
  }

  for (const path of [
    "/goals",
    "/life",
    "/today",
    "/reviews",
    "/tasks",
    "/calendar",
    "/plan",
    "/inbox",
  ]) {
    revalidatePath(path);
  }
  revalidatePath(`/goals/${result.goal_id}`);
  return ok({ goalId: result.goal_id, taskIds: result.task_ids });
}
