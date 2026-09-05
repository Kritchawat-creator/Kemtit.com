import type * as React from "react";

type Props = { title: string; description?: string; actions?: React.ReactNode };

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-h1 text-text-primary">{title}</h1>
        {description ? <p className="mt-1 text-body text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
