import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "cn";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** ปุ่ม CTA (Design §8.6: empty state ต้องเชิญชวนและมีทางไปต่อ) */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border-strong bg-bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      ) : null}
      <h2 className="text-h3 text-text-primary">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-small text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
