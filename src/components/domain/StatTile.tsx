import { cn } from "cn";

type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
};

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-text-primary",
  success: "text-success-800",
  warning: "text-warning-800",
  danger: "text-danger-800",
};

/** ตัวเลขเด่น + label (Design §6.2) — ตัวเลขใช้ tabular-nums จาก body */
export function StatTile({ label, value, hint, tone = "default", className }: Props) {
  return (
    <div className={cn("rounded-lg border border-border bg-bg-surface p-4", className)}>
      <p className="text-caption text-text-secondary">{label}</p>
      <p className={cn("mt-1 text-h1", TONE[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-small text-text-muted">{hint}</p> : null}
    </div>
  );
}
