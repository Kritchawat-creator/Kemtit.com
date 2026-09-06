import { useTranslations } from "next-intl";
import { cn } from "cn";

import type { PaceStatus } from "@/core/domain/progress";

const STYLE: Record<PaceStatus, string> = {
  onTrack: "bg-success-50 text-success-800",
  behind: "bg-warning-50 text-warning-800",
  notStarted: "bg-bg-subtle text-text-secondary",
  done: "bg-brand-500 text-neutral-0",
};

/** สถานะเทียบเวลา ภาษาเข็มทิศ: ตามเส้นทาง / ออกนอกเส้นทาง / ถึงจุดหมายแล้ว (Claude Design 3o) — มีข้อความเสมอ ไม่ใช้สีอย่างเดียว */
export function PaceBadge({ status, className }: { status: PaceStatus; className?: string }) {
  const t = useTranslations("pace");
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-sm px-2.5 text-caption font-medium whitespace-nowrap",
        STYLE[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
