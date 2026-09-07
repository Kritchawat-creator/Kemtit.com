"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { overdue: number; lineLinked: boolean };

/**
 * กระดิ่งแจ้งเตือน desktop (Claude Design turn 7) — ไม่มีการแจ้งเตือนที่บันทึกลง DB (Decision §1.7)
 * รายการมาจากข้อมูลจริงตอนโหลดหน้า: งานค้าง (จาก getDayPlan) + ยังไม่เชื่อม LINE (จาก profile)
 */
export function NotificationsMenu({ overdue, lineLinked }: Props) {
  const t = useTranslations();
  const showLineHint = !lineLinked;
  const hasItems = overdue > 0 || showLineHint;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("nav.notifications")}
          className="relative flex size-11 items-center justify-center rounded-md bg-bg-surface text-brand-800 shadow-sm transition-colors hover:bg-brand-50"
        >
          <Bell className="size-5" strokeWidth={1.5} aria-hidden="true" />
          {hasItems ? (
            <span
              aria-hidden="true"
              className="absolute top-2.5 right-2.5 size-2 rounded-full bg-accent-500 ring-2 ring-bg-surface"
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-64">
        {overdue > 0 ? (
          <DropdownMenuItem asChild>
            <Link href="/tasks">{t("notifications.overdue", { count: overdue })}</Link>
          </DropdownMenuItem>
        ) : null}
        {showLineHint ? (
          <DropdownMenuItem asChild>
            <Link href="/settings">{t("notifications.lineNotLinked")}</Link>
          </DropdownMenuItem>
        ) : null}
        {!hasItems ? (
          <DropdownMenuItem disabled>{t("notifications.empty")}</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
