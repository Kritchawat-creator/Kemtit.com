import { Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

export type SegmentedNavItem = {
  key: string;
  href: string;
  label: string;
  active: boolean;
  /** ตัวเลือกที่ยังไม่เปิดใช้งาน (เช่น กราฟ "ปี" ที่ล็อกไว้ให้ Pro) — render เป็น span ล็อกไอคอน ไม่ใช่ลิงก์ */
  disabled?: boolean;
  /** tooltip ของตัวเลือกที่ disabled (เช่น "มีในแพ็กเกจ Pro") */
  title?: string;
};

type Props = { label: string; items: SegmentedNavItem[]; className?: string };

/**
 * Segmented control แบบลิงก์ (Claude Design 3h/3m): ราง neutral-200 มุม 14px · ตัวเลือก active เป็นการ์ดขาวมุม 10px มีเงา
 * ใช้ลิงก์ + aria-current เพื่อให้ SSR/back-forward ทำงาน (ใช้กับ filter หน้าเป้าหมายและมุมมองปฏิทิน)
 * ตัวเลือก disabled (Claude Design turn 7 "ปี" ล็อก Pro) เป็น span เฉย ๆ ไม่ใช่ลิงก์ ป้องกันคลิกแล้วพังทาง SEO/back-forward
 */
export function SegmentedNav({ label, items, className }: Props) {
  return (
    <nav aria-label={label} className={cn("flex gap-1 rounded-md bg-neutral-200 p-1", className)}>
      {items.map((item) =>
        item.disabled ? (
          <span
            key={item.key}
            aria-disabled="true"
            title={item.title}
            className="flex min-h-10 flex-1 cursor-not-allowed items-center justify-center gap-1 rounded-sm px-3 text-base font-medium text-text-muted md:min-h-9 md:text-sm"
          >
            <Lock className="size-3" aria-hidden="true" />
            {item.label}
          </span>
        ) : (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center rounded-sm px-3 text-base font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none md:min-h-9 md:text-sm",
              item.active
                ? "bg-bg-surface text-brand-800 shadow-sm"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
