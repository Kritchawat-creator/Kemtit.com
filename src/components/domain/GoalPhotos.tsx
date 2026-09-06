"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";

import type { Photo } from "@/core/photos/schema";
import { GOAL_PHOTO_LIMIT, photoPublicUrl } from "@/lib/supabase/storage";
import { usePhotoUpload } from "@/hooks/use-photo-upload";

import { ImageSlot } from "./ImageSlot";
import { PhotoViewer } from "./PhotoViewer";

/** ภาพเป้าหมาย (cover) บนหน้า detail (Claude Design 5a/5c): มุม 20 + pill "ภาพเป้าหมาย" มุมซ้ายบน */
export function GoalCover({
  goalId,
  path,
  className,
}: {
  goalId: string;
  path: string | null;
  className?: string;
}) {
  const t = useTranslations("photos");
  const { upload, remove, busy } = usePhotoUpload();
  const [open, setOpen] = useState(false);
  const src = path ? photoPublicUrl(path) : null;

  return (
    <div className={cn("relative", className)}>
      <ImageSlot
        src={src}
        alt={t("cover")}
        placeholder={t("coverPlaceholder")}
        rounded="lg"
        busy={busy}
        onSelect={(file) => void upload(file, { kind: "goalCover", targetId: goalId })}
        onRemove={() => void remove({ kind: "goalCover", id: goalId })}
        onOpen={() => setOpen(true)}
        sizes="(max-width: 1024px) 100vw, 400px"
        className="h-full w-full"
      />
      <span className="pointer-events-none absolute top-3 left-3 inline-flex h-6 items-center rounded-full bg-bg-surface px-2.5 text-caption font-medium text-brand-800 shadow-sm">
        {t("cover")}
      </span>
      <PhotoViewer src={open ? src : null} alt={t("cover")} onClose={() => setOpen(false)} />
    </div>
  );
}

/** gallery รูปความคืบหน้า (Claude Design 5a/5c): การ์ดขาว · tile 1:1 มุม 14 · add tile ขอบประ · แตะรูปเพื่อดูเต็มจอ/ลบ */
export function GoalGallery({ goalId, photos }: { goalId: string; photos: Photo[] }) {
  const t = useTranslations("photos");
  const { upload, remove, busy } = usePhotoUpload();
  const [viewing, setViewing] = useState<Photo | null>(null);
  const full = photos.length >= GOAL_PHOTO_LIMIT;

  return (
    <section aria-label={t("gallery")} className="rounded-xl bg-bg-surface p-5 shadow-md lg:p-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-h2 text-brand-800">{t("gallery")}</h2>
        <span className="text-small whitespace-nowrap text-text-secondary">
          {t("count", { count: photos.length })}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-3">
        {photos.map((photo) => (
          <li key={photo.id} className="aspect-square">
            <ImageSlot
              src={photoPublicUrl(photo.path)}
              alt={t("gallery")}
              rounded="md"
              onOpen={() => setViewing(photo)}
              sizes="(max-width: 1024px) 33vw, 120px"
              className="size-full"
            />
          </li>
        ))}
        {!full ? (
          <li className="aspect-square">
            <ImageSlot
              alt={t("add")}
              placeholder={t("add")}
              rounded="md"
              variant="outline"
              busy={busy}
              onSelect={(file) => void upload(file, { kind: "goalPhoto", targetId: goalId })}
              className="size-full"
            />
          </li>
        ) : null}
      </ul>
      <p className="mt-2 text-caption text-text-secondary">{t("galleryHint")}</p>
      <PhotoViewer
        src={viewing ? photoPublicUrl(viewing.path) : null}
        alt={t("gallery")}
        busy={busy}
        onClose={() => setViewing(null)}
        onDelete={
          viewing
            ? async () => {
                const ok = await remove({ kind: "goalPhoto", id: viewing.id });
                if (ok) setViewing(null);
              }
            : undefined
        }
      />
    </section>
  );
}

/** avatar ในหน้าตั้งค่า: ตัวอักษรย่อ (ค่าเริ่มต้น) → รูปเมื่ออัปโหลด · ขอบขาว 2px เงาม่วง (Claude Design 5e) */
export function AvatarSlot({ path, initial }: { path: string | null; initial: string }) {
  const t = useTranslations("photos");
  const { upload, remove, busy } = usePhotoUpload();
  const src = path ? photoPublicUrl(path) : null;

  return (
    <ImageSlot
      src={src}
      alt={t("avatar")}
      shape="circle"
      compact
      busy={busy}
      fallback={
        <span className="flex size-full items-center justify-center rounded-full bg-accent-100 text-h2 text-accent-900">
          {initial}
        </span>
      }
      onSelect={(file) => void upload(file, { kind: "avatar" })}
      onRemove={() => void remove({ kind: "avatar" })}
      sizes="56px"
      className="size-14 shrink-0 rounded-full border-2 border-neutral-0 shadow-sm"
    />
  );
}
