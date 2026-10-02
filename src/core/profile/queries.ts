import "server-only";

import { cache } from "react";

import { signPhotoUrls } from "@/core/photos/queries";
import { authFailureContext, isUnauthenticatedAuthError } from "@/core/auth/session-errors";
import { createServerSupabase } from "@/lib/supabase/server";

import type { Profile } from "./schema";

export type Me = {
  userId: string;
  email: string | null;
  profile: Profile;
  /** signed URL ของรูปโปรไฟล์ (null = ไม่มีรูป / flag uploads ปิด) — Design §6A: avatar เปิดพร้อม attachments ใน MVP */
  avatarUrl: string | null;
};

/** user ปัจจุบัน + โปรไฟล์ (ผ่าน RLS เห็นแค่แถวตัวเอง) — null เมื่อยังไม่ login — cache() กันยิงซ้ำในคำขอเดียว (§2.9) */
export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await createServerSupabase();
  let user: { id: string; email?: string } | null = null;
  let authError: unknown = null;
  try {
    const result = await supabase.auth.getUser();
    authError = result.error;
    user = result.data.user;
  } catch (error) {
    authError = error;
  }
  if (authError) {
    if (isUnauthenticatedAuthError(authError)) return null;
    console.error("[profile] getMe auth verification failed", authFailureContext(authError));
    throw new Error("authUnavailable");
  }
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[profile] getMe failed", { code: error.code });
    throw new Error("profileUnavailable");
  }
  if (!profile) {
    console.error("[profile] getMe missing profile row");
    throw new Error("profileUnavailable");
  }
  const avatarUrl = profile.avatar_path
    ? ((await signPhotoUrls(supabase, user.id, [profile.avatar_path])).get(profile.avatar_path) ??
      null)
    : null;
  return { userId: user.id, email: user.email ?? null, profile: profile as Profile, avatarUrl };
});
