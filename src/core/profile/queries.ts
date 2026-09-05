import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

import type { Profile } from "./schema";

export type Me = { userId: string; email: string | null; profile: Profile };

/** user ปัจจุบัน + โปรไฟล์ (ผ่าน RLS เห็นแค่แถวตัวเอง) — null เมื่อยังไม่ login */
export async function getMe(): Promise<Me | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[profile] getMe failed", { code: error.code });
    return null;
  }
  if (!profile) return null;
  return { userId: user.id, email: user.email ?? null, profile: profile as Profile };
}
