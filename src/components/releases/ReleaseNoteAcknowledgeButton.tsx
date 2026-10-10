"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { acknowledgeReleaseNote } from "@/core/releases/actions";
import { Button } from "@/components/ui/button";

export function ReleaseNoteAcknowledgeButton({
  releaseNoteId,
  initialIsRead,
}: {
  releaseNoteId: string;
  initialIsRead: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [isRead, setIsRead] = useState(initialIsRead);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isEffectivelyRead = initialIsRead || isRead;

  async function acknowledge() {
    if (isSubmitting || isEffectivelyRead) return;
    setIsSubmitting(true);
    setHasError(false);

    try {
      const result = await acknowledgeReleaseNote({ releaseNoteId });
      if (!result.ok) {
        setHasError(true);
        return;
      }

      setIsRead(true);
      router.refresh();
    } catch {
      // A retry uses the same release ID, and the server action is idempotent.
      setHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isEffectivelyRead) {
    return (
      <p
        role="status"
        className="text-success-700 text-small font-medium"
        data-testid="release-note-acknowledged"
      >
        {t("updates.acknowledged")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={acknowledge}
        disabled={isSubmitting}
        data-testid="release-note-acknowledge"
      >
        {isSubmitting ? t("updates.acknowledging") : t("updates.acknowledge")}
      </Button>
      {hasError ? (
        <p role="alert" className="text-danger-700 text-small">
          {t("updates.acknowledgeFailed")}
        </p>
      ) : null}
    </div>
  );
}
