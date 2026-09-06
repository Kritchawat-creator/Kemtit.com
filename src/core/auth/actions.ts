"use server";

import { redirect } from "next/navigation";

import { nextRouteFor, ROUTES, safeInternalPath } from "@/core/profile/onboarding";
import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { requestOtpSchema, verifyOtpSchema } from "./schema";

function mapAuthError(
  error: { code?: string; status?: number; message: string },
  phase: "request" | "verify",
) {
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  ) {
    return "otpRateLimited";
  }
  if (error.code === "email_address_invalid" || error.code === "validation_failed")
    return "invalidEmail";
  if (phase === "verify") return "otpInvalid";
  console.error("[auth] unexpected auth error", { code: error.code, status: error.status });
  return "generic";
}

/** ขั้น 1: ส่งรหัส 6 หลักไปอีเมล (สมัคร/เข้าใช้ใช้ flow เดียวกัน — shouldCreateUser) */
export async function requestOtp(input: unknown): Promise<ActionResult> {
  const parsed = requestOtpSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true },
  });
  if (error) return fail(mapAuthError(error, "request"));
  return ok(null);
}

/** ขั้น 2: ตรวจรหัส → ตั้ง session cookie → บอกหน้าถัดไปตามสถานะ onboarding */
export async function verifyOtp(input: unknown): Promise<ActionResult<{ next: string }>> {
  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error || !data.user) return fail(mapAuthError(error ?? { message: "no user" }, "verify"));

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("active_persona, onboarding_completed_at")
    .eq("id", data.user.id)
    .maybeSingle();

  const gate = nextRouteFor(profile);
  const requested = safeInternalPath(parsed.data.next);
  const next = gate === ROUTES.dashboard && requested ? requested : gate;
  return ok({ next });
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
