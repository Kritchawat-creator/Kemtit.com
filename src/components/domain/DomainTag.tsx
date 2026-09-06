import { useTranslations } from "next-intl";
import { cn } from "cn";

import type { Domain } from "@/core/domain/domains";

/** class คงที่ต่อ domain (Tailwind ไม่ทำ class แบบ dynamic) — สีจาก token domain-* ใน globals.css */
export const DOMAIN_STYLES: Record<
  Domain,
  { pill: string; dot: string; tint: string; text: string; selected: string }
> = {
  work: {
    pill: "bg-domain-work-bg text-domain-work-fg",
    dot: "bg-domain-work-dot",
    tint: "bg-domain-work-bg/40",
    text: "text-domain-work-fg",
    selected:
      "data-[state=on]:border-domain-work-fg data-[state=on]:bg-domain-work-bg data-[state=on]:text-domain-work-fg",
  },
  health: {
    pill: "bg-domain-health-bg text-domain-health-fg",
    dot: "bg-domain-health-dot",
    tint: "bg-domain-health-bg/40",
    text: "text-domain-health-fg",
    selected:
      "data-[state=on]:border-domain-health-fg data-[state=on]:bg-domain-health-bg data-[state=on]:text-domain-health-fg",
  },
  family: {
    pill: "bg-domain-family-bg text-domain-family-fg",
    dot: "bg-domain-family-dot",
    tint: "bg-domain-family-bg/40",
    text: "text-domain-family-fg",
    selected:
      "data-[state=on]:border-domain-family-fg data-[state=on]:bg-domain-family-bg data-[state=on]:text-domain-family-fg",
  },
  finance: {
    pill: "bg-domain-finance-bg text-domain-finance-fg",
    dot: "bg-domain-finance-dot",
    tint: "bg-domain-finance-bg/40",
    text: "text-domain-finance-fg",
    selected:
      "data-[state=on]:border-domain-finance-fg data-[state=on]:bg-domain-finance-bg data-[state=on]:text-domain-finance-fg",
  },
  growth: {
    pill: "bg-domain-growth-bg text-domain-growth-fg",
    dot: "bg-domain-growth-dot",
    tint: "bg-domain-growth-bg/40",
    text: "text-domain-growth-fg",
    selected:
      "data-[state=on]:border-domain-growth-fg data-[state=on]:bg-domain-growth-bg data-[state=on]:text-domain-growth-fg",
  },
  relationships: {
    pill: "bg-domain-relationships-bg text-domain-relationships-fg",
    dot: "bg-domain-relationships-dot",
    tint: "bg-domain-relationships-bg/40",
    text: "text-domain-relationships-fg",
    selected:
      "data-[state=on]:border-domain-relationships-fg data-[state=on]:bg-domain-relationships-bg data-[state=on]:text-domain-relationships-fg",
  },
};

type Props = { domain: Domain; size?: "sm" | "md"; className?: string };

/** pill มน สี + จุด 6px + ชื่อ domain (Claude Design 3o: สูง 24/28) — ต้องมี label ข้อความเสมอ (Design §3.3) */
export function DomainTag({ domain, size = "sm", className }: Props) {
  const t = useTranslations("domains");
  const style = DOMAIN_STYLES[domain];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full text-caption font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-2.5" : "h-7 px-3",
        style.pill,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" />
      {t(domain)}
    </span>
  );
}
