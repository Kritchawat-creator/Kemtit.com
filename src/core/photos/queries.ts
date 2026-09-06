import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

import type { Photo } from "./schema";

/** รูปความคืบหน้าของเป้าหมาย (gallery) เรียงตามลำดับ/เวลา */
export async function listGoalPhotos(goalId: string): Promise<Photo[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("goal_photos")
    .select("id, path")
    .eq("goal_id", goalId)
    .order("sort_order")
    .order("created_at");
  if (error) {
    console.error("[photos] listGoalPhotos failed", { code: error.code });
    return [];
  }
  return data ?? [];
}
