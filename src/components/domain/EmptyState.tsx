import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "cn";

export type EmptyStateProps = {
  icon?: LucideIcon;
  /** ภาพประกอบ monoline "ยังไม่ได้ตั้งทิศ" (Claude Design 3e/3i) — ใช้แทน icon */
  illustration?: "compass";
  /** บรรทัดเล็กเหนือหัวข้อ เช่น "ยังไม่ได้ตั้งทิศ" */
  eyebrow?: string;
  title: string;
  description?: string;
  /** ปุ่ม CTA (Design §8.6: empty state ต้องเชิญชวนและมีทางไปต่อ) */
  action?: React.ReactNode;
  className?: string;
};

/** ภาพเข็มทิศยังไม่ชี้ทิศ — เส้น monoline brand-800 · ขีดทิศ border-strong · เส้นประ brand-200 · จุดกลาง brand-500 */
function CompassIllustration() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 48 48"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      className="stroke-brand-800"
    >
      <circle cx="24" cy="24" r="18" />
      <path d="M24 6v4M42 24h-4M24 42v-4M6 24h4" className="stroke-border-strong" />
      <path d="M24 24l8-6" strokeDasharray="2 3" className="stroke-brand-200" />
      <circle cx="24" cy="24" r="2" stroke="none" className="fill-brand-500" />
    </svg>
  );
}

/** Empty state = การ์ดขาวมุม 28px มีเงา ข้อความกลาง (Claude Design 3e) */
export function EmptyState({
  icon: Icon,
  illustration,
  eyebrow,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl bg-bg-surface px-5 py-8 text-center shadow-md",
        className,
      )}
    >
      {illustration === "compass" ? (
        <span className="mb-2">
          <CompassIllustration />
        </span>
      ) : Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
        </span>
      ) : null}
      {eyebrow ? <p className="mb-1 text-caption text-text-secondary">{eyebrow}</p> : null}
      <h2 className="text-h2 text-brand-800">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-xs text-body text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
