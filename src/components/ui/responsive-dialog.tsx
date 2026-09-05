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

/** Sheet จากด้านล่างบนมือถือ / Dialog บน desktop (Design §8.2, §8.5) */
export function ResponsiveDialog({ open, onOpenChange, title, description, children }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="px-0 text-left">
            <SheetTitle className="text-h2">{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-h2">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
