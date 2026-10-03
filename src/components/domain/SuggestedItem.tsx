"use client";

import { CheckCircle2, Pencil } from "@/components/icons/ui-icons";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SuggestionDecision } from "@/core/shared/suggestions";

type Props = {
  title: string;
  subtitle?: string;
  reason?: string;
  typeLabel: string;
  status: SuggestionDecision;
  pending?: boolean;
  acceptLabel: string;
  editLabel: string;
  skipLabel: string;
  acceptedLabel: string;
  suggestedLabel: string;
  onAccept: (title: string) => void;
  onSkip: () => void;
};

export function SuggestedItem({
  title,
  subtitle,
  reason,
  typeLabel,
  status,
  pending = false,
  acceptLabel,
  editLabel,
  skipLabel,
  acceptedLabel,
  suggestedLabel,
  onAccept,
  onSkip,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  if (status === "skipped") return null;

  return (
    <article className="rounded-xl border border-brand-100 bg-bg-surface p-4 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-800">
              {typeLabel}
            </span>
            <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-caption font-medium text-text-secondary">
              {suggestedLabel}
            </span>
          </div>

          {editing && status !== "accepted" ? (
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={200}
              aria-label={title}
            />
          ) : (
            <h3 className="text-h3 text-text-primary">{draft}</h3>
          )}

          {subtitle ? <p className="mt-1 text-small text-text-secondary">{subtitle}</p> : null}
          {reason ? <p className="mt-2 text-caption text-text-muted">{reason}</p> : null}
        </div>

        {status === "accepted" ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-small font-medium text-brand-700">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {acceptedLabel}
          </span>
        ) : null}
      </div>

      {status !== "accepted" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onAccept(draft.trim())}
            disabled={pending || !draft.trim()}
          >
            {acceptLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing((value) => !value)}
            disabled={pending}
          >
            <Pencil aria-hidden="true" />
            {editLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={onSkip} disabled={pending}>
            {skipLabel}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
