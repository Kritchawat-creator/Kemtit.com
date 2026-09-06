"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { attachPhoto, removePhoto } from "@/core/photos/actions";
import type { Photo } from "@/core/photos/schema";
import { UPLOADS_ENABLED } from "@/lib/flags";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  isAllowedPhotoType,
  PHOTO_BUCKET,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_EDGE,
  photoPathFor,
  type PhotoKind,
} from "@/lib/supabase/storage";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

/** taskPhoto ต้องมี targetId = task id · avatar ไม่ต้อง */
export type PhotoTarget = { kind: PhotoKind; targetId?: string };

/** ย่อรูปฝั่ง client (ด้านยาวสุด PHOTO_MAX_EDGE, JPEG 0.85) — ถ้าเบราว์เซอร์อ่านไม่ได้ให้ส่งไฟล์เดิม (MVP: WebP + HEIC) */
async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === "image/jpeg" && file.size < 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("toBlob");
    return blob;
  } catch {
    return file;
  }
}

function extensionOf(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

/**
 * อัปโหลดรูป: ตรวจชนิด/ขนาด → ย่อ → ส่งตรงเข้า Storage ที่ <user_id>/<task_id|avatar>/<uuid>.<ext> (RLS โฟลเดอร์แรก)
 * → attachPhoto ผูกกับ task/profile · ลบ: removePhoto (ลบแถว + ไฟล์) · ทุกกรณี toast + router.refresh ให้ server ลงชื่อ URL ใหม่
 * flag ปิด: UI ไม่ถูก render อยู่แล้ว แต่กันไว้อีกชั้น (server action ก็ปฏิเสธ)
 */
export function usePhotoUpload() {
  const t = useTranslations("photos");
  const te = useTranslations("errors");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const translateError = useCallback(
    (key: string) => (te.has(key as ErrorKey) ? te(key as ErrorKey) : te("generic")),
    [te],
  );

  const upload = useCallback(
    async (
      file: File,
      target: PhotoTarget,
      options?: { silent?: boolean },
    ): Promise<Photo | null> => {
      if (!UPLOADS_ENABLED) {
        toast.error(te("featureDisabled"));
        return null;
      }
      if (!isAllowedPhotoType(file.type)) {
        toast.error(te("photoType"));
        return null;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        toast.error(te("photoTooLarge"));
        return null;
      }
      setBusy(true);
      try {
        const supabase = createBrowserSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error(te("unauthorized"));
          return null;
        }
        const blob = await downscale(file);
        const path = photoPathFor(
          target.kind,
          user.id,
          `${crypto.randomUUID()}.${extensionOf(blob.type)}`,
          target.targetId,
        );
        const { error } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
        if (error) {
          console.error("[photos] upload failed", { message: error.message });
          toast.error(te("uploadFailed"));
          return null;
        }
        const result = await attachPhoto({ kind: target.kind, targetId: target.targetId, path });
        if (!result.ok) {
          await supabase.storage.from(PHOTO_BUCKET).remove([path]);
          toast.error(translateError(result.error));
          return null;
        }
        if (!options?.silent) toast.success(t("uploaded"));
        router.refresh();
        return result.data;
      } finally {
        setBusy(false);
      }
    },
    [router, t, te, translateError],
  );

  const remove = useCallback(
    async (target: { kind: PhotoKind; id?: string }): Promise<boolean> => {
      if (!UPLOADS_ENABLED) {
        toast.error(te("featureDisabled"));
        return false;
      }
      setBusy(true);
      try {
        const result = await removePhoto(target);
        if (!result.ok) {
          toast.error(translateError(result.error));
          return false;
        }
        toast.success(t("removed"));
        router.refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [router, t, te, translateError],
  );

  return { upload, remove, busy };
}
