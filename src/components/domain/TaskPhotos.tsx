"use client";

import { ImageIcon, ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { cn } from "cn";

import type { TaskPhoto } from "@/core/tasks/schema";
import { formatNumber } from "@/lib/format";
import { TASK_PHOTO_LIMIT } from "@/lib/supabase/storage";
import { usePhotoUpload } from "@/hooks/use-photo-upload";

import { ImageSlot } from "./ImageSlot";
import { PhotoViewer } from "./PhotoViewer";

const THUMBS_MAX = 3;

/** รูปที่ signed URL ไม่มา (ลบไปแล้ว/ลงชื่อไม่ได้) — Design §6A.4 state "tile เทา + icon image-off" */
function BrokenTile({
  className,
  iconClass = "size-4",
}: {
  className?: string;
  iconClass?: string;
}) {
  const t = useTranslations("photos");
  return (
    <span
      role="img"
      aria-label={t("unavailable")}
      className={cn("flex items-center justify-center bg-neutral-100 text-neutral-400", className)}
    >
      <ImageOff className={iconClass} strokeWidth={1.5} aria-hidden="true" />
    </span>
  );
}

/**
 * Dashboard / TodayTasks / ปฏิทิน (Design §6A.3): ไม่แสดงรูป — Lucide `image` + จำนวน ท้าย TaskRow
 * ตัวเลขผ่าน formatNumber ตาม DoD
 */
export function TaskAttachmentCount({ count, className }: { count: number; className?: string }) {
  const t = useTranslations("photos");
  if (count <= 0) return null;
  return (
    <span
      role="img"
      aria-label={t("count", { count })}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-caption text-text-secondary",
        className,
      )}
    >
      <ImageIcon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      <span aria-hidden="true">{formatNumber(count)}</span>
    </span>
  );
}

/** Goal detail → task list (Design §6A.3): thumbnail 40×40 radius 10 ซ้อนกัน (stack) สูงสุด 3 ที่เหลือ "+N" */
export function TaskThumbs({ photos, className }: { photos: TaskPhoto[]; className?: string }) {
  const t = useTranslations("photos");
  if (photos.length === 0) return null;
  const shown = photos.slice(0, THUMBS_MAX);
  const rest = photos.length - shown.length;
  return (
    <span
      role="img"
      aria-label={t("count", { count: photos.length })}
      className={cn("flex shrink-0 items-center pl-2", className)}
    >
      {shown.map((photo, index) => (
        <span
          key={photo.id}
          className={cn(
            "relative block size-10 overflow-hidden rounded-sm bg-bg-subtle ring-2 ring-bg-surface",
            index > 0 && "-ml-2.5",
          )}
          style={{ zIndex: THUMBS_MAX - index }}
        >
          {photo.url ? (
            <Image
              src={photo.url}
              alt=""
              fill
              unoptimized
              loading="lazy"
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <BrokenTile className="size-full" />
          )}
        </span>
      ))}
      {rest > 0 ? (
        <span
          aria-hidden="true"
          className="-ml-2.5 flex size-10 items-center justify-center rounded-sm bg-brand-50 text-caption font-medium text-brand-800 ring-2 ring-bg-surface"
        >
          +{formatNumber(rest)}
        </span>
      ) : null}
    </span>
  );
}

/** แถบรูปแนบในรายละเอียดงาน: รูป 72px มีปุ่มลบ + โซนเพิ่ม + คำอธิบายชนิด/ขนาด (MVP: AttachmentGrid 5 state ตาม §6A.4) */
export function TaskPhotoStrip({ taskId, photos }: { taskId: string; photos: TaskPhoto[] }) {
  const t = useTranslations("photos");
  const { upload, remove, busy } = usePhotoUpload();
  const [viewing, setViewing] = useState<TaskPhoto | null>(null);
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
        {photos.map((photo) =>
          photo.url ? (
            <ImageSlot
              key={photo.id}
              src={photo.url}
              alt={t("attach")}
              rounded="sm"
              compact
              busy={busy}
              onOpen={() => setViewing(photo)}
              onRemove={() => void remove({ kind: "taskPhoto", id: photo.id })}
              sizes="72px"
              className="size-[72px] shrink-0"
            />
          ) : (
            <span key={photo.id} className="relative size-[72px] shrink-0">
              <BrokenTile className="size-full rounded-sm" iconClass="size-5" />
              <button
                type="button"
                onClick={() => void remove({ kind: "taskPhoto", id: photo.id })}
                disabled={busy}
                aria-label={t("remove")}
                className="absolute -top-1.5 -right-1.5 z-10 flex size-[22px] items-center justify-center rounded-full border-2 border-neutral-0 bg-brand-800 text-neutral-0 hover:bg-brand-900 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
              >
                <ImageOff className="size-3" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </span>
          ),
        )}
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
        src={viewing?.url ?? null}
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

/** เลือกรูปไว้ก่อนบันทึกงาน (ฟอร์มสร้าง/แก้): พรีวิวจากไฟล์ในเครื่อง อัปโหลดหลังบันทึกสำเร็จ (ไม่บล็อกการบันทึก) */
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
