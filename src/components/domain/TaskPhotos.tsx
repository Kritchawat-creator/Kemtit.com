"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";

import type { Photo } from "@/core/photos/schema";
import { photoPublicUrl, TASK_PHOTO_LIMIT } from "@/lib/supabase/storage";
import { usePhotoUpload } from "@/hooks/use-photo-upload";

import { ImageSlot } from "./ImageSlot";
import { PhotoViewer } from "./PhotoViewer";

const THUMBS_MAX = 3;

/** thumbnail 40px ใน TaskRow (Claude Design 5e) — แสดงสูงสุด 3 รูป ที่เหลือเป็น "+N" */
export function TaskThumbs({ photos, className }: { photos: Photo[]; className?: string }) {
  const t = useTranslations("photos");
  if (photos.length === 0) return null;
  const shown = photos.slice(0, THUMBS_MAX);
  const rest = photos.length - shown.length;
  return (
    <span
      className={cn("flex shrink-0 items-center gap-1", className)}
      aria-label={t("count", { count: photos.length })}
    >
      {shown.map((photo) => (
        <span
          key={photo.id}
          className="relative block size-10 overflow-hidden rounded-sm bg-bg-subtle"
        >
          <Image
            src={photoPublicUrl(photo.path)}
            alt=""
            fill
            unoptimized
            sizes="40px"
            className="object-cover"
          />
        </span>
      ))}
      {rest > 0 ? (
        <span className="flex size-10 items-center justify-center rounded-sm bg-brand-50 text-caption font-medium text-brand-800">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/** แถบรูปแนบในรายละเอียดงาน (Claude Design 5b): รูป 72px มีปุ่มลบ + โซนเพิ่ม + คำอธิบายชนิด/ขนาด */
export function TaskPhotoStrip({ taskId, photos }: { taskId: string; photos: Photo[] }) {
  const t = useTranslations("photos");
  const { upload, remove, busy } = usePhotoUpload();
  const [viewing, setViewing] = useState<Photo | null>(null);
  const full = photos.length >= TASK_PHOTO_LIMIT;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-caption font-medium text-text-secondary">{t("attach")}</p>
        <span className="text-caption text-text-secondary">
          {t("attachCount", { count: photos.length, max: TASK_PHOTO_LIMIT })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {photos.map((photo) => (
          <ImageSlot
            key={photo.id}
            src={photoPublicUrl(photo.path)}
            alt={t("attach")}
            rounded="sm"
            compact
            busy={busy}
            onOpen={() => setViewing(photo)}
            onRemove={() => void remove({ kind: "taskPhoto", id: photo.id })}
            sizes="72px"
            className="size-[72px] shrink-0"
          />
        ))}
        {!full ? (
          <ImageSlot
            alt={t("attachPlaceholder")}
            placeholder={t("attachPlaceholder")}
            rounded="md"
            busy={busy}
            onSelect={(file) => void upload(file, { kind: "taskPhoto", targetId: taskId })}
            className="h-[72px] min-w-[140px] flex-1"
          />
        ) : null}
      </div>
      <p className="mt-2 text-caption text-text-secondary">{t("attachHint")}</p>
      <PhotoViewer
        src={viewing ? photoPublicUrl(viewing.path) : null}
        alt={t("attach")}
        busy={busy}
        onClose={() => setViewing(null)}
        onDelete={
          viewing
            ? async () => {
                const ok = await remove({ kind: "taskPhoto", id: viewing.id });
                if (ok) setViewing(null);
              }
            : undefined
        }
      />
    </div>
  );
}

/** เลือกรูปไว้ก่อนบันทึกงาน (ฟอร์มสร้าง/แก้): พรีวิวจากไฟล์ในเครื่อง อัปโหลดหลังบันทึกสำเร็จ */
export function PendingPhotoPicker({
  files,
  onChange,
  existingCount = 0,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  existingCount?: number;
  disabled?: boolean;
}) {
  const t = useTranslations("photos");
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const total = existingCount + files.length;
  const full = total >= TASK_PHOTO_LIMIT;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-caption font-medium text-text-secondary">{t("attach")}</p>
        <span className="text-caption text-text-secondary">
          {t("attachCount", { count: total, max: TASK_PHOTO_LIMIT })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {files.map((file, index) => (
          <ImageSlot
            key={`${file.name}-${index}`}
            src={previews[index]}
            alt={file.name}
            rounded="sm"
            compact
            disabled={disabled}
            onRemove={() => onChange(files.filter((_, i) => i !== index))}
            sizes="72px"
            className="size-[72px] shrink-0"
          />
        ))}
        {!full ? (
          <ImageSlot
            alt={t("attachPlaceholder")}
            placeholder={t("attachPlaceholder")}
            rounded="md"
            disabled={disabled}
            onSelect={(file) => onChange([...files, file])}
            className="h-[72px] min-w-[140px] flex-1"
          />
        ) : null}
      </div>
      <p className="mt-2 text-caption text-text-secondary">{t("attachHint")}</p>
    </div>
  );
}
