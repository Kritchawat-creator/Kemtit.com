"use server";

import { revalidatePath } from "next/cache";

import { emitEvent } from "@/core/events/emit";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { dailyPlanSettingsSchema } from "./daily-plan-settings-schema";

export async function saveDailyPlanSettings(input: unknown): Promise<ActionResult> {
  const parsed = dailyPlanSettingsSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthorized");

  const { error } = await supabase.from("daily_plans").upsert(
    {
      user_id: user.id,
      plan_date: parsed.data.planDate,
      available_minutes: parsed.data.availableMinutes,
      notes: parsed.data.notes ?? null,
    },
    { onConflict: "user_id,plan_date" },
  );
  if (error) {
    console.error("[planning] saveDailyPlanSettings failed", { code: error.code });
    return fail("generic");
  }

  const { data: notificationProfile } = await supabase
    .from("user_profiles")
    .select("notify_daily_brief")
    .eq("id", user.id)
    .maybeSingle();
  if (notificationProfile?.notify_daily_brief) {
    await emitEvent(
      supabase,
      user.id,
      "daily.plan.ready",
      { date: parsed.data.planDate },
      { dedupeKey: `daily.plan.ready:${user.id}:${parsed.data.planDate}` },
    );
  }

  revalidatePath("/today");
  revalidatePath("/calendar");
  return ok(null);
}
