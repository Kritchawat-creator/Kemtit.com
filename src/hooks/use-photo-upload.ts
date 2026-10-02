"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { removePhoto } from "@/core/photos/actions";
import { uploadPhotoFile, type PhotoTarget } from "@/core/photos/upload";
import { UPLOADS_ENABLED } from "@/lib/flags";
import type { Photo } from "@/core/photos/schema";
import type { PhotoKind } from "@/lib/supabase/storage";

export type { PhotoTarget } from "@/core/photos/upload";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

/**
 * Shared upload hook: core/photos/upload owns validation, resize, Storage, and attachment.
 * → attachPhoto ผูกกับ task/profile · removePhoto ยกเลิก reference แล้วเก็บ private object ไว้สำหรับ reference-aware cleanup
 * · ทุกกรณี toast + router.refresh ให้ server ลงชื่อ URL ใหม่
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
      setBusy(true);
      try {
        const result = await uploadPhotoFile(file, target);
        if (!result.ok) {
          toast.error(translateError(result.error));
          if (result.error === "uploadUncertain") router.refresh();
          return null;
        }
        if (!options?.silent) toast.success(t("uploaded"));
        router.refresh();
        return result.data;
      } catch {
        toast.error(te("generic"));
        return null;
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
