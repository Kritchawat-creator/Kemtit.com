"use client";

import type * as React from "react";

import { useIsMobile } from "@/hooks/use-is-mobile";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
};

/**
 * Sheet จากด้านล่างบนมือถือ / Dialog บน desktop (Design §8.2, §8.5)
 * มือถือตาม Claude Design 3l: มุมบน 28px, แถบจับ 40×4, เงาม่วง, ปุ่มปิดมุมขวา
 */
export function ResponsiveDialog({ open, onOpenChange, title, description, children }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto rounded-t-2xl border-0 px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-sheet"
        >
          <span
            aria-hidden="true"
            className="mx-auto block h-1 w-10 shrink-0 rounded-full bg-border-strong"
          />
          <SheetHeader className="px-0 pt-1 pb-0 text-left">
            <SheetTitle className="pr-10 text-h2 text-brand-800">{title}</SheetTitle>
            {description ? (
              <SheetDescription className="text-small text-text-secondary">
                {description}
              </SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{title}</SheetDescription>
            )}
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-h2 text-brand-800">{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
