"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Props = {
  src: string | null;
  alt: string;
  onClose: () => void;
  onDelete?: () => void;
  busy?: boolean;
};

/** ดูรูปเต็มจอ (lightbox) — การ์ดขาวมุม 24 พื้นหลังมืดโปร่ง มีปุ่มลบรูป (Claude Design 5 "ถัดไป") */
export function PhotoViewer({ src, alt, onClose, onDelete, busy }: Props) {
  const t = useTranslations("photos");
  return (
    <Dialog open={src !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl gap-3 p-2 sm:p-3">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">{t("view")}</DialogDescription>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-bg-subtle">
          {src ? (
            <Image src={src} alt={alt} fill unoptimized sizes="100vw" className="object-contain" />
          ) : null}
        </div>
        {onDelete ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-danger-800 hover:bg-danger-50 hover:text-danger-800"
              onClick={onDelete}
              disabled={busy}
            >
              <Trash2 aria-hidden="true" />
              {t("remove")}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
