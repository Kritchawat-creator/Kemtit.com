"use server";

import { revalidatePath } from "next/cache";

import { emitEvent } from "@/core/events/emit";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { nextRouteFor, ROUTES, type AppRoute } from "./onboarding";
import { isPersonaEnabled } from "./personas";
import { legacyPersonaForRole, workModeForRole } from "./roles";
import { legacyPersonaForWorkMode } from "./work-modes";
import {
  choosePersonaSchema,
  chooseRoleSchema,
  updateDisplayNameSchema,
  updateFocusAreasSchema,
  updateNotificationPreferenceSchema,
  updateNotifyOverdueSchema,
  updatePlanningContextSchema,
  updateScopeSchema,
  updateWorkModeSchema,
} from "./schema";

/** Legacy persona action kept for compatibility with older flows. */
export async function choosePersona(input: unknown): Promise<ActionResult<{ next: AppRoute }>> {
  const parsed = choosePersonaSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  if (!isPersonaEnabled(parsed.data.persona)) return fail("personaDisabled");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const workMode =
    parsed.data.persona === "seller"
      ? "seller"
      : parsed.data.persona === "office"
        ? "professional"
        : null;
  const { data, error } = await supabase
    .from("user_profiles")
    .update({ active_persona: parsed.data.persona, work_mode: workMode })
    .eq("id", user.id)
    .select("active_persona, work_mode, role_code, focus_areas, onboarding_completed_at")
    .single();
  if (error) {
    console.error("[profile] choosePersona failed", { code: error.code });
    return fail("generic");
  }

  revalidatePath("/", "layout");
  return ok({ next: nextRouteFor(data) });
}

/**
 * UX redesign role selection. role_code is the product-facing role while
 * work_mode/active_persona remain compatibility projections for existing
 * Seller/Professional navigation and modules.
 */
export async function chooseRole(input: unknown): Promise<ActionResult<{ next: AppRoute }>> {
  const parsed = chooseRoleSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const workMode = workModeForRole(parsed.data.role);
  const { data, error } = await supabase
    .from("user_profiles")
    .update({
      role_code: parsed.data.role,
      work_mode: workMode,
      active_persona: legacyPersonaForRole(parsed.data.role),
    })
    .eq("id", user.id)
    .select("active_persona, work_mode, role_code, focus_areas, onboarding_completed_at")
    .single();

  if (error) {
    console.error("[profile] chooseRole failed", { code: error.code });
    return fail("generic");
  }

  revalidatePath("/", "layout");
  return ok({ next: nextRouteFor(data) });
}

export async function chooseFocusAreas(
  input: unknown,
): Promise<ActionResult<{ next: AppRoute }>> {
  const parsed = updateFocusAreasSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("user_profiles")
    .update({ focus_areas: parsed.data.focusAreas })
    .eq("id", user.id)
    .select("active_persona, work_mode, role_code, focus_areas, onboarding_completed_at")
    .single();

  if (error) {
    console.error("[profile] chooseFocusAreas failed", { code: error.code });
    return fail("generic");
  }

  revalidatePath("/", "layout");
  return ok({ next: nextRouteFor(data) });
}

/** V2 compatibility action. active_persona is kept as a compatibility projection. */
export async function chooseWorkMode(input: unknown): Promise<ActionResult<{ next: AppRoute }>> {
  const parsed = updateWorkModeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("user_profiles")
    .update({
      work_mode: parsed.data.workMode,
      active_persona: legacyPersonaForWorkMode(parsed.data.workMode),
    })
    .eq("id", user.id)
    .select("active_persona, work_mode, role_code, focus_areas, onboarding_completed_at")
    .single();
  if (error) return fail("generic");

  revalidatePath("/", "layout");
  return ok({ next: nextRouteFor(data) });
}

export async function updateDisplayName(input: unknown): Promise<ActionResult> {
  const parsed = updateDisplayNameSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase
    .from("user_profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);
  if (error) return fail("generic");

  revalidatePath("/", "layout");
  return ok(null);
}

export async function updateNotifyOverdue(input: unknown): Promise<ActionResult> {
  const parsed = updateNotifyOverdueSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase
    .from("user_profiles")
    .update({ notify_overdue: parsed.data.enabled })
    .eq("id", user.id);
  if (error) return fail("generic");

  revalidatePath("/settings");
  return ok(null);
}

export async function updateNotificationPreference(input: unknown): Promise<ActionResult> {
  const parsed = updateNotificationPreferenceSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const update =
    parsed.data.key === "overdue"
      ? { notify_overdue: parsed.data.enabled }
      : parsed.data.key === "dailyBrief"
        ? { notify_daily_brief: parsed.data.enabled }
        : parsed.data.key === "weeklyReview"
          ? { notify_weekly_review: parsed.data.enabled }
          : parsed.data.key === "habits"
            ? { notify_habits: parsed.data.enabled }
            : { notify_investment: parsed.data.enabled };

  const { error } = await supabase.from("user_profiles").update(update).eq("id", user.id);
  if (error) return fail("generic");

  revalidatePath("/settings");
  return ok(null);
}

export async function updatePlanningContext(input: unknown): Promise<ActionResult> {
  const parsed = updatePlanningContextSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase
    .from("user_profiles")
    .update({
      role_code: parsed.data.role,
      focus_areas: parsed.data.focusAreas,
      default_scope: parsed.data.scope,
      work_mode: workModeForRole(parsed.data.role),
      active_persona: legacyPersonaForRole(parsed.data.role),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[profile] updatePlanningContext failed", { code: error.code });
    return fail("generic");
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return ok(null);
}

/** Legacy V2 settings action kept for compatibility with callers not yet migrated. */
export async function updateWorkMode(input: unknown): Promise<ActionResult> {
  const parsed = updateWorkModeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase
    .from("user_profiles")
    .update({
      work_mode: parsed.data.workMode,
      active_persona: legacyPersonaForWorkMode(parsed.data.workMode),
    })
    .eq("id", user.id);
  if (error) return fail("generic");

  revalidatePath("/", "layout");
  return ok(null);
}

export async function updateScope(input: unknown): Promise<ActionResult> {
  const parsed = updateScopeSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase
    .from("user_profiles")
    .update({ default_scope: parsed.data.scope })
    .eq("id", user.id);
  if (error) return fail("generic");

  revalidatePath("/", "layout");
  return ok(null);
}

/**
 * Completes onboarding after the Starter Workspace decision step.
 * Unaccepted suggestions never reach this action as business records.
 */
export async function completeOnboarding(): Promise<ActionResult<{ next: AppRoute }>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("user_profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("onboarding_completed_at", null)
    .select("active_persona, work_mode, role_code, focus_areas, onboarding_completed_at")
    .maybeSingle();
  if (error) return fail("generic");

  if (data) {
    await emitEvent(supabase, user.id, "onboarding.completed", {
      role: data.role_code ?? data.active_persona ?? "unknown",
      focusAreas: data.focus_areas ?? [],
    });
  }

  revalidatePath("/", "layout");
  return ok({ next: ROUTES.dashboard });
}
