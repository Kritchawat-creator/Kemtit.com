import Link from "next/link";
import { cn } from "cn";

export type SegmentedNavItem = { key: string; href: string; label: string; active: boolean };

type Props = { label: string; items: SegmentedNavItem[]; className?: string };

/**
 * Segmented control แบบลิงก์ (Claude Design 3h/3m): ราง neutral-200 มุม 14px · ตัวเลือก active เป็นการ์ดขาวมุม 10px มีเงา
 * ใช้ลิงก์ + aria-current เพื่อให้ SSR/back-forward ทำงาน (ใช้กับ filter หน้าเป้าหมายและมุมมองปฏิทิน)
 */
export function SegmentedNav({ label, items, className }: Props) {
  return (
    <nav aria-label={label} className={cn("flex gap-1 rounded-md bg-neutral-200 p-1", className)}>
      {items.map((item) => (
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
      ))}
    </nav>
  );
}
