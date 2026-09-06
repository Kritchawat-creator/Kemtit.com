"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { UPLOADS_ENABLED } from "@/lib/flags";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import {
  isAvatarPath,
  isTaskPhotoPath,
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
 * ผูกไฟล์ที่ client อัปโหลดเข้า bucket แล้วเข้ากับ task (task_photos) หรือโปรไฟล์ (avatar_path)
 * - ปิด flag (Design §6A.6) → `featureDisabled` ที่นี่ ไม่ใช่แค่ซ่อนปุ่ม
 * - path ต้องเป็น <user_id>/<task_id>/<file> หรือ <user_id>/avatar/<file> (RLS ของ storage บังคับโฟลเดอร์แรกตอนอัปโหลดอยู่แล้ว)
 * - avatar แทนที่ของเดิมและลบไฟล์เก่า · รูปแนบงานมีเพดาน TASK_PHOTO_LIMIT ต่อ task
 */
export async function attachPhoto(input: unknown): Promise<ActionResult<Photo>> {
  if (!UPLOADS_ENABLED) return fail("featureDisabled");
  const parsed = attachPhotoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { kind, targetId, path } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  if (kind === "avatar") {
    if (!isAvatarPath(path, user.id)) return fail("validation");
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

  const taskId = targetId!;
  if (!isTaskPhotoPath(path, user.id, taskId)) return fail("validation");
  const { count } = await supabase
    .from("task_photos")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);
  if ((count ?? 0) >= TASK_PHOTO_LIMIT) return fail("photoLimit");
  const { data, error } = await supabase
    .from("task_photos")
    .insert({ task_id: taskId, user_id: user.id, path })
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
  if (!UPLOADS_ENABLED) return fail("featureDisabled");
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
  const { data, error } = await supabase
    .from("task_photos")
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
