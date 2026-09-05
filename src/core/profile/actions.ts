"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { nextRouteFor, type AppRoute } from "./onboarding";
import { isPersonaEnabled } from "./personas";
import { choosePersonaSchema, updateDisplayNameSchema, updateNotifyOverdueSchema } from "./schema";

/** เลือก persona ตอน onboarding (บังคับเลือก ไม่มีข้าม — Design §8.3) */
export async function choosePersona(input: unknown): Promise<ActionResult<{ next: AppRoute }>> {
  const parsed = choosePersonaSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  if (!isPersonaEnabled(parsed.data.persona)) return fail("personaDisabled");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { data, error } = await supabase
    .from("user_profiles")
    .update({ active_persona: parsed.data.persona })
    .eq("id", user.id)
    .select("active_persona, onboarding_completed_at")
    .single();
  if (error) {
    console.error("[profile] choosePersona failed", { code: error.code });
    return fail("generic");
  }

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
