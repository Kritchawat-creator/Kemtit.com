import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "cn";

type Badge = {
  tone: "success" | "danger" | "neutral";
  icon?: "up" | "down";
  text: string;
};

type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
  /** เมื่อส่ง icon = การ์ด KPI ทรงใหม่ (Claude Design turn 7 dashboard v3) — ไม่ส่ง = การ์ดเดิม (Design §6.2) */
  icon?: LucideIcon;
  /** หน่วยเล็กต่อท้ายตัวเลข เช่น "บาท" (ใช้กับทรงใหม่เท่านั้น) */
  unit?: string;
  /** ป้ายเทียบก่อนหน้าที่ท้ายการ์ด (ใช้กับทรงใหม่เท่านั้น) */
  badge?: Badge;
};

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-text-primary",
  success: "text-success-800",
  warning: "text-warning-800",
  danger: "text-danger-800",
};

const BADGE_TONE: Record<Badge["tone"], string> = {
  success: "bg-success-50 text-success-800",
  danger: "bg-danger-50 text-danger-800",
  neutral: "bg-bg-subtle text-text-secondary",
};

const BADGE_ICON: Record<NonNullable<Badge["icon"]>, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
};

/**
 * ตัวเลขเด่น + label (Design §6.2) — การ์ดขาวมุม 20px มีเงา; ตัวเลขใช้ tabular-nums จาก body
 * ทรงใหม่ (icon ระบุ, Claude Design turn 7): ไอคอนบนซ้าย · ตัวเลขใหญ่ + หน่วยเล็ก · เส้นคั่นล่าง + badge เทียบก่อนหน้า
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className,
  icon: Icon,
  unit,
  badge,
}: Props) {
  if (Icon) {
    const BadgeIcon = badge?.icon ? BADGE_ICON[badge.icon] : null;
    return (
      <div className={cn("rounded-lg bg-bg-surface px-6 py-5 shadow-md", className)}>
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-small text-text-secondary">{label}</p>
            <p className="truncate text-h1 text-text-primary">
              {value}
              {unit ? <span className="ml-1 text-caption text-text-secondary">{unit}</span> : null}
            </p>
          </div>
        </div>
        {badge || hint ? (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
            {badge ? (
              <span
                className={cn(
                  "inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full px-2.5 text-caption font-medium",
                  BADGE_TONE[badge.tone],
                )}
              >
                {BadgeIcon ? <BadgeIcon className="size-3" aria-hidden="true" /> : null}
                {badge.text}
              </span>
            ) : null}
            {hint ? <span className="truncate text-small text-text-muted">{hint}</span> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg bg-bg-surface p-4 shadow-md", className)}>
      <p className="text-caption text-text-secondary">{label}</p>
      <p className={cn("mt-1 text-h1", TONE[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-small text-text-muted">{hint}</p> : null}
    </div>
  );
}
