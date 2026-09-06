import { useTranslations } from "next-intl";
import { cn } from "cn";

import type { Domain } from "@/core/domain/domains";
import { formatPercent } from "@/lib/format";

import { DOMAIN_STYLES } from "./DomainTag";

type Props = {
  /** 0-100 */
  value: number;
  domain?: Domain;
  size?: "sm" | "md";
  showValue?: boolean;
  /** จุดพีชปลายแถบ = จุดหมาย (Claude Design 3o "ProgressBar · จุดเหนือ") */
  marker?: boolean;
  label?: string;
  className?: string;
};

/** แถบ % แนวนอน ปลายมน ราง neutral-200; เปลี่ยนค่า 400ms ease-out (Design §11) */
export function ProgressBar({
  value,
  domain,
  size = "md",
  showValue = false,
  marker = false,
  label,
  className,
}: Props) {
  const t = useTranslations("a11y");
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative flex-1", marker && "mr-1")}>
        <div
          role="progressbar"
          aria-label={label ?? t("progress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clamped)}
          className={cn(
            "overflow-hidden rounded-full bg-neutral-200",
            size === "sm" ? "h-1.5" : "h-2",
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-400 ease-out",
              domain ? DOMAIN_STYLES[domain].dot : "bg-brand-500",
            )}
            style={{ width: `${clamped}%` }}
          />
        </div>
        {marker ? (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -right-1 size-3.5 -translate-y-1/2 rounded-full bg-accent-500 ring-[2.5px] ring-bg-surface"
          />
        ) : null}
      </div>
      {showValue ? (
        <span className="min-w-10 text-right text-small font-medium text-text-primary">
          {formatPercent(clamped / 100)}
        </span>
      ) : null}
    </div>
  );
}
