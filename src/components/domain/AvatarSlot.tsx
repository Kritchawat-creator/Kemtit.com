"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { UPLOADS_ENABLED } from "@/lib/flags";
import { usePhotoUpload } from "@/hooks/use-photo-upload";

import { ImageSlot } from "./ImageSlot";

/**
 * ตัวอักษรแรกของ display_name (ไม่ใช่ initials แบบตะวันตก — ชื่อไทยไม่มี convention นั้น) บนพื้น brand-100 ตัวอักษร brand-800
 * ใช้เป็นค่าเริ่มต้นของ avatar ทั้ง header และหน้าตั้งค่า · size = class ขนาด (เช่น size-10 / size-14)
 */
export function LetterAvatar({
  letter,
  className,
  textClass = "text-base font-semibold",
}: {
  letter: string;
  className?: string;
  textClass?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800 select-none",
        textClass,
        className,
      )}
    >
      {letter}
    </span>
  );
}

/**
 * avatar ในหน้าตั้งค่า: ตัวอักษรแรก (ค่าเริ่มต้น) → รูปเมื่ออัปโหลด · ขอบขาว 2px เงา
 * flag uploads ปิด (POC/CP1 — PDPA, Design §6A.6): แสดงตัวอักษรอย่างเดียว ไม่มีช่องอัปโหลด · เปิดพร้อม attachments ใน MVP
 */
export function AvatarSlot({ src, letter }: { src: string | null; letter: string }) {
  const t = useTranslations("photos");
  const { upload, remove, busy } = usePhotoUpload();

  if (!UPLOADS_ENABLED) {
    return <LetterAvatar letter={letter} className="size-14 text-h2" textClass="font-semibold" />;
  }

  return (
    <ImageSlot
      src={src}
      alt={t("avatar")}
      shape="circle"
      compact
      busy={busy}
      fallback={<LetterAvatar letter={letter} className="size-full text-h2" />}
      onSelect={(file) => void upload(file, { kind: "avatar" })}
      onRemove={() => void remove({ kind: "avatar" })}
      sizes="56px"
      className="size-14 shrink-0 rounded-full border-2 border-neutral-0 shadow-sm"
    />
  );
}
