"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, zodFail, type ActionResult } from "@/core/shared/result";
import { UPLOADS_ENABLED } from "@/lib/flags";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import {
  isAvatarPath,
  isTaskPhotoPath,
  isAllowedPhotoType,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
} from "@/lib/supabase/storage";

import { attachPhotoSchema, removePhotoSchema, type Photo } from "./schema";

async function requireUser(supabase: ServerSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function isDefinitePostgresRejection(code: string | undefined): boolean {
  if (!code || code === "40003" || code === "08007") return false;
  return (
    code === "P0001" ||
    code === "42501" ||
    code === "40001" ||
    code === "40P01" ||
    code.startsWith("22") ||
    code.startsWith("23")
  );
}

async function avatarPhotoExists(supabase: ServerSupabase, path: string) {
  const [, , fileName] = path.split("/");
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .list(path.split("/").slice(0, 2).join("/"), {
      limit: 1,
      search: fileName,
    });
  if (error) {
    console.error("[photos] avatar object check failed", {
      status: error.status,
      statusCode: error.statusCode,
    });
    return { exists: false, error: true };
  }
  const object = data?.find((candidate) => candidate.name === fileName);
  if (!object) return { exists: false, error: false };

  const metadata = object.metadata as { mimetype?: unknown; size?: unknown } | null;
  const mimeType = typeof metadata?.mimetype === "string" ? metadata.mimetype : "";
  const size = typeof metadata?.size === "number" ? metadata.size : Number(metadata?.size);
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  const extensionMatches =
    (extension === "jpg" && mimeType === "image/jpeg") ||
    (extension === "png" && mimeType === "image/png") ||
    (extension === "webp" && mimeType === "image/webp");
  return {
    exists:
      isAllowedPhotoType(mimeType) &&
      extensionMatches &&
      Number.isFinite(size) &&
      size > 0 &&
      size <= PHOTO_MAX_BYTES,
    error: false,
  };
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/**
 * ผูกไฟล์ที่ client อัปโหลดเข้า bucket แล้วเข้ากับ task (task_photos) หรือโปรไฟล์ (avatar_path)
 * - ปิด flag (Design §6A.6) → `featureDisabled` ที่นี่ ไม่ใช่แค่ซ่อนปุ่ม
 * - path ต้องเป็น <user_id>/<task_id>/<file> หรือ <user_id>/avatar/<file> (RLS ของ storage บังคับโฟลเดอร์แรกตอนอัปโหลดอยู่แล้ว)
 * - avatar ใหม่จะไม่ลบ object เดิม เพราะ profile อื่นหรือแท็บที่เปิดค้างอาจยังอ้างถึง path นั้น
 * - การถอด avatar/รูปแนบจะยกเลิก reference เท่านั้น; private object ที่ไม่อ้างถึงแล้วรอ reference-aware cleanup
 * - รูปแนบงานมีเพดาน TASK_PHOTO_LIMIT ต่อ task
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
    const { data: previous, error: previousError } = await supabase
      .from("user_profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .maybeSingle();
    if (previousError) return fail("uploadFailed");

    const objectCheck = await avatarPhotoExists(supabase, path);
    if (objectCheck.error) return fail("uploadFailed");
    if (!objectCheck.exists) return fail("photoInvalid");
    if (previous?.avatar_path === path) return ok({ id: user.id, path });

    const { data: updatedProfile, error } = await supabase
      .from("user_profiles")
      .update({ avatar_path: path })
      .eq("id", user.id)
      .select("id")
      .single();
    if (error) {
      if (error.code === "PGRST116") return fail("notFound");
      return fail(isDefinitePostgresRejection(error.code) ? "uploadFailed" : "uploadUncertain");
    }
    if (!updatedProfile?.id) return fail("uploadUncertain");
    // Keep the prior object. A concurrent tab may already have pointed the profile back to it.
    revalidateAll();
    return ok({ id: user.id, path });
  }

  const taskId = targetId!;
  if (!isTaskPhotoPath(path, user.id, taskId)) return fail("validation");
  const { data, error } = await supabase.rpc("attach_task_photo_atomic", {
    p_task_id: taskId,
    p_path: path,
  });
  if (error) {
    const message = error.code === "P0001" ? error.message : "";
    const normalizedError = message.includes("photo_limit")
      ? "photoLimit"
      : message.includes("task_not_found")
        ? "notFound"
        : message.includes("photo_invalid") || message.includes("photo_object_missing")
          ? "photoInvalid"
          : message.includes("not_authenticated")
            ? "unauthorized"
            : message.includes("invalid_input")
              ? "validation"
              : isDefinitePostgresRejection(error.code)
                ? "uploadFailed"
                : "uploadUncertain";
    console.error("[photos] task photo attach failed", {
      code: error?.code,
      reason: normalizedError,
    });
    return fail(normalizedError);
  }
  if (
    typeof data !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)
  ) {
    console.error("[photos] task photo attach response invalid");
    return fail("uploadUncertain");
  }
  revalidateAll();
  return ok({ id: data, path });
}

/** ลบ reference ของรูป; เก็บ private object ไว้จนกว่าจะมี reference-aware cleanup */
export async function removePhoto(input: unknown): Promise<ActionResult> {
  if (!UPLOADS_ENABLED) return fail("featureDisabled");
  const parsed = removePhotoSchema.safeParse(input);
  if (!parsed.success) return zodFail(parsed.error);
  const { kind, id } = parsed.data;

  const supabase = await createServerSupabase();
  const user = await requireUser(supabase);
  if (!user) return fail("unauthorized");

  if (kind === "avatar") {
    const { data, error: readError } = await supabase
      .from("user_profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .maybeSingle();
    if (readError) return fail("generic");
    const previousPath = data?.avatar_path;
    if (!previousPath) return ok(null);

    const { data: clearedProfile, error } = await supabase
      .from("user_profiles")
      .update({ avatar_path: null })
      .eq("id", user.id)
      .eq("avatar_path", previousPath)
      .select("id")
      .maybeSingle();
    if (error) return fail("generic");
    if (!clearedProfile) return fail("generic");
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
  revalidateAll();
  return ok(null);
}
