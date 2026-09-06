"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import {
  GOAL_PHOTO_LIMIT,
  isOwnPhotoPath,
  PHOTO_BUCKET,
  TASK_PHOTO_LIMIT,
} from "@/lib/supabase/storage";

import { attachPhotoSchema, removePhotoSchema, type Photo } from "./schema";

async function requireUser(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function removeObject(supabase: ServerSupabase, path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.error("[photos] remove object failed", { message: error.message });
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/**
 * ผูกไฟล์ที่ client อัปโหลดเข้า bucket แล้ว (path ต้องอยู่ในโฟลเดอร์ของ user — RLS ของ storage บังคับตอนอัปโหลดอยู่แล้ว)
 * cover/avatar แทนที่ของเดิมและลบไฟล์เก่า · gallery/แนบงาน มีเพดานจำนวนต่อเป้า/งาน
 */
export async function attachPhoto(input: unknown): Promise<ActionResult<Photo>> {
  const parsed = attachPhotoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { kind, targetId, path } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");
  if (!isOwnPhotoPath(path, user.id)) return fail("validation");

  if (kind === "avatar") {
    const { data: previous } = await supabase
      .from("user_profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .maybeSingle();
    const { error } = await supabase
      .from("user_profiles")
      .update({ avatar_path: path })
      .eq("id", user.id);
    if (error) return fail("generic");
    await removeObject(supabase, previous?.avatar_path);
    revalidateAll();
    return ok({ id: user.id, path });
  }

  if (kind === "goalCover") {
    const { data: goal } = await supabase
      .from("goals")
      .select("id, cover_path")
      .eq("id", targetId!)
      .maybeSingle();
    if (!goal) return fail("notFound");
    const { error } = await supabase.from("goals").update({ cover_path: path }).eq("id", goal.id);
    if (error) return fail("generic");
    await removeObject(supabase, goal.cover_path);
    revalidateAll();
    return ok({ id: goal.id, path });
  }

  if (kind === "goalPhoto") {
    const { count } = await supabase
      .from("goal_photos")
      .select("id", { count: "exact", head: true })
      .eq("goal_id", targetId!);
    if ((count ?? 0) >= GOAL_PHOTO_LIMIT) return fail("photoLimit");
    const { data, error } = await supabase
      .from("goal_photos")
      .insert({ goal_id: targetId!, user_id: user.id, path, sort_order: count ?? 0 })
      .select("id, path")
      .single();
    if (error || !data) {
      console.error("[photos] goal photo insert failed", { code: error?.code });
      return fail(error?.code === "23514" ? "notFound" : "generic");
    }
    revalidateAll();
    return ok(data);
  }

  const { count } = await supabase
    .from("task_photos")
    .select("id", { count: "exact", head: true })
    .eq("task_id", targetId!);
  if ((count ?? 0) >= TASK_PHOTO_LIMIT) return fail("photoLimit");
  const { data, error } = await supabase
    .from("task_photos")
    .insert({ task_id: targetId!, user_id: user.id, path })
    .select("id, path")
    .single();
  if (error || !data) {
    console.error("[photos] task photo insert failed", { code: error?.code });
    return fail(error?.code === "23514" ? "notFound" : "generic");
  }
  revalidateAll();
  return ok(data);
}

/** ลบรูป: ลบแถว/ล้างคอลัมน์ แล้วลบไฟล์ใน bucket (ไฟล์ค้างถ้าลบไม่สำเร็จ — ไม่บล็อกผู้ใช้) */
export async function removePhoto(input: unknown): Promise<ActionResult> {
  const parsed = removePhotoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { kind, id } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  if (kind === "avatar") {
    const { data } = await supabase
      .from("user_profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .maybeSingle();
    const { error } = await supabase
      .from("user_profiles")
      .update({ avatar_path: null })
      .eq("id", user.id);
    if (error) return fail("generic");
    await removeObject(supabase, data?.avatar_path);
    revalidateAll();
    return ok(null);
  }

  if (!id) return fail("validation");

  if (kind === "goalCover") {
    const { data } = await supabase.from("goals").select("cover_path").eq("id", id).maybeSingle();
    if (!data) return fail("notFound");
    const { error } = await supabase.from("goals").update({ cover_path: null }).eq("id", id);
    if (error) return fail("generic");
    await removeObject(supabase, data.cover_path);
    revalidateAll();
    return ok(null);
  }

  const table = kind === "goalPhoto" ? "goal_photos" : "task_photos";
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .select("path")
    .maybeSingle();
  if (error) return fail("generic");
  if (!data) return fail("notFound");
  await removeObject(supabase, data.path);
  revalidateAll();
  return ok(null);
}
