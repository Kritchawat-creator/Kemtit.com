import { useTranslations } from "next-intl";
import { cn } from "cn";

import type { PaceStatus } from "@/core/domain/progress";

const STYLE: Record<PaceStatus, string> = {
  onTrack: "bg-success-50 text-success-800",
  behind: "bg-warning-50 text-warning-800",
  notStarted: "bg-bg-subtle text-text-secondary",
  done: "bg-brand-50 text-brand-800",
};

/** สถานะเทียบเวลา: ตามเป้า / ตกเป้า (Design §8.2 สี warning) — มีข้อความเสมอ ไม่ใช้สีอย่างเดียว */
export function PaceBadge({ status, className }: { status: PaceStatus; className?: string }) {
  const t = useTranslations("pace");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-caption",
        STYLE[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
