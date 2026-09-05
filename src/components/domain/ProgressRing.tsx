import { useTranslations } from "next-intl";
import type * as React from "react";
import { cn } from "cn";

import type { Domain } from "@/core/domain/domains";

import { DOMAIN_STYLES } from "./DomainTag";

type Props = {
  /** 0-100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  domain?: Domain;
  label?: string;
  children?: React.ReactNode;
  className?: string;
};

/** วงกลม % ปลายมน (stroke-linecap round — Design §5.4) เนื้อหาตรงกลางเป็น slot */
export function ProgressRing({ value, size = 128, strokeWidth = 10, domain, label, children, className }: Props) {
  const t = useTranslations("a11y");
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const ringColor = domain ? DOMAIN_STYLES[domain].text : "text-brand-500";

  return (
    <div
      role="progressbar"
      aria-label={label ?? t("progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-brand-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("stroke-current transition-[stroke-dashoffset] duration-400 ease-out", ringColor)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
