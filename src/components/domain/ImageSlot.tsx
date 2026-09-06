"use client";

import { ImageIcon, Loader2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";

import { PHOTO_MIME_TYPES } from "@/lib/supabase/storage";

type Props = {
  /** URL รูป (null = ช่องว่างสำหรับอัปโหลด) */
  src?: string | null;
  alt: string;
  /** ข้อความในช่องว่าง (ไม่แสดงเมื่อ compact) */
  placeholder?: string;
  shape?: "rounded" | "circle";
  /** มุม: sm 10 · md 14 · lg 20 (Claude Design 5e: thumbnail 10 · tile 14 · cover 20) */
  rounded?: "sm" | "md" | "lg";
  /** ช่องเล็ก (40/72px): ซ่อนข้อความ วางไอคอนอย่างเดียว */
  compact?: boolean;
  /** ช่องว่างแบบขอบขาว + ไอคอนบวก (add tile ใน gallery) แทนพื้น brand-50 + ไอคอนรูป */
  variant?: "tint" | "outline";
  /** สิ่งที่แสดงแทนช่องว่าง เช่น ตัวอักษรย่อของ avatar */
  fallback?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** เลือกไฟล์ (ลากวาง/คลิก) */
  onSelect?: (file: File) => void;
  /** ปุ่มลบมุมขวาบน (brand-800) — แสดงเมื่อมีรูป */
  onRemove?: () => void;
  /** แตะรูปที่มีอยู่ (เปิดดูเต็มจอ) — ถ้าไม่ส่ง แตะ = เลือกรูปใหม่ */
  onOpen?: () => void;
  sizes?: string;
  className?: string;
};

const RADIUS = { sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg" } as const;

/**
 * ช่องรูป (Claude Design 5e): ว่าง = พื้น brand-50 ขอบประ brand-200 ไอคอน/ข้อความ brand-600 · มีรูป = แสดงรูป + ปุ่มลบ
 * ลากรูปวางหรือแตะเพื่อเลือกได้ทั้งสองสถานะ · ระหว่างอัปโหลดมี overlay หมุน
 */
export function ImageSlot({
  src,
  alt,
  placeholder,
  shape = "rounded",
  rounded = "md",
  compact = false,
  variant = "tint",
  fallback,
  busy = false,
  disabled = false,
  onSelect,
  onRemove,
  onOpen,
  sizes = "(max-width: 640px) 100vw, 400px",
  className,
}: Props) {
  const t = useTranslations("photos");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const canSelect = Boolean(onSelect) && !disabled && !busy;
  const radius = shape === "circle" ? "rounded-full" : RADIUS[rounded];

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file && onSelect) onSelect(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  const dragHandlers = canSelect
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        },
      }
    : {};

  return (
    <div className={cn("relative", className)} {...dragHandlers}>
      {src ? (
        <button
          type="button"
          onClick={onOpen ?? (canSelect ? () => inputRef.current?.click() : undefined)}
          disabled={!onOpen && !canSelect}
          aria-label={onOpen ? t("view") : alt}
          className={cn(
            "relative block size-full overflow-hidden bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none",
            radius,
            dragging && "ring-[3px] ring-brand-500/40",
          )}
        >
          <Image src={src} alt={alt} fill unoptimized sizes={sizes} className="object-cover" />
        </button>
      ) : (
        <button
          type="button"
          onClick={canSelect ? () => inputRef.current?.click() : undefined}
          disabled={!canSelect}
          aria-label={placeholder ?? alt}
          className={cn(
            "flex size-full flex-col items-center justify-center gap-1 text-brand-600 transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none",
            radius,
            variant === "outline"
              ? "border-[1.5px] border-dashed border-brand-200 bg-bg-surface"
              : "border-[1.5px] border-dashed border-brand-200 bg-brand-50",
            canSelect && "cursor-pointer hover:border-brand-300",
            dragging && "border-brand-500 bg-brand-100",
            fallback && "border-0 bg-transparent",
          )}
        >
          {fallback ? (
            <>
              {fallback}
              {canSelect ? (
                <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-neutral-0 bg-brand-500 text-neutral-0">
                  <ImageIcon className="size-3" strokeWidth={2} aria-hidden="true" />
                </span>
              ) : null}
            </>
          ) : variant === "outline" ? (
            <Plus className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <ImageIcon
              className={compact ? "size-4" : "size-6"}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          )}
          {!compact && placeholder && !fallback ? (
            <span className="max-w-[90%] truncate px-2 text-caption font-medium">
              {placeholder}
            </span>
          ) : null}
        </button>
      )}

      {src && onRemove && !busy ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t("remove")}
          className="absolute -top-1.5 -right-1.5 z-10 flex size-[22px] items-center justify-center rounded-full border-2 border-neutral-0 bg-brand-800 text-neutral-0 hover:bg-brand-900 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
        >
          <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
        </button>
      ) : null}

      {busy ? (
        <span
          role="status"
          aria-label={t("uploading")}
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-bg-surface/70 text-brand-600",
            radius,
          )}
        >
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </span>
      ) : null}

      {onSelect ? (
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={PHOTO_MIME_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => pick(e.target.files)}
        />
      ) : null}
    </div>
  );
}
