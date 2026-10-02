import type { ReactNode } from "react";

export function InsightCard({
  label,
  value,
  helper,
  children,
}: {
  label: string;
  value: string;
  helper?: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-[-0.025em] text-text-primary">{value}</p>
      {helper ? <p className="mt-2 text-small text-text-secondary">{helper}</p> : null}
      {children}
    </article>
  );
}
