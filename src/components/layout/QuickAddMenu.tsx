"use client";

import { NotebookPen, Plus, Target, CheckSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { variant?: "button" | "fab"; className?: string };

/**
 * ปุ่ม "+ เพิ่ม" → เมนู 2 ตัวเลือก task / goal (Design §8.1)
 * FAB = วงกลม accent-500 (จุด accent 1 ใน 3 ของ Claude Design 2a) เงาสีเดียวกับปุ่ม
 * เปิดฟอร์มผ่าน query `?new=goal|task` ซึ่ง QuickAddHost ใน (app)/layout เป็นคน render Sheet/Dialog
 */
export function QuickAddMenu({ variant = "button", className }: Props) {
  const t = useTranslations();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "fab" ? (
          <Button
            size="icon-lg"
            aria-label={t("a11y.openQuickAdd")}
            className={cn(
              "size-14 rounded-full bg-accent-500 text-neutral-0 shadow-fab hover:bg-accent-700 active:bg-accent-700",
              className,
            )}
          >
            <Plus className="size-[26px]" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        ) : (
          <Button className={className}>
            <Plus aria-hidden="true" />
            {t("nav.quickAdd")}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-48">
        <DropdownMenuItem asChild>
          <Link href="?new=task" scroll={false}>
            <CheckSquare aria-hidden="true" />
            {t("nav.addTask")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="?new=goal" scroll={false}>
            <Target aria-hidden="true" />
            {t("nav.addGoal")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="?new=entry" scroll={false}>
            <NotebookPen aria-hidden="true" />
            {t("nav.addEntry")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
