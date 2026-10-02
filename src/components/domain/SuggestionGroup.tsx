import type * as React from "react";

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SuggestionGroup({ title, description, children }: Props) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <h2 className="text-h2 text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-small text-text-secondary">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
