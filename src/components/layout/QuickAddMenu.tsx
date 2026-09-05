"use client";

import { Plus, Target, CheckSquare } from "lucide-react";
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
            className={cn("size-14 rounded-full shadow-lg", className)}
          >
            <Plus className="size-6" aria-hidden="true" />
          </Button>
        ) : (
          <Button className={className}>
            <Plus aria-hidden="true" />
            {t("nav.quickAdd")}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
