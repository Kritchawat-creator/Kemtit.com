"use client";

import { AlertTriangle, Check, RotateCcw } from "@/components/icons/ui-icons";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { confirmRescue, undoRescue } from "@/core/planning/actions";
import type { AppLocale } from "@/i18n/config";
import type { RescueProposal, RescueProposalAction } from "@/core/planning/rescue";
import { Button } from "@/components/ui/button";

const ACTION_KEYS: Record<
  RescueProposalAction,
  "rescue.actions.keep" | "rescue.actions.move" | "rescue.actions.unplaced" | "rescue.actions.atRisk"
> = {
  keep: "rescue.actions.keep",
  move: "rescue.actions.move",
  unplaced: "rescue.actions.unplaced",
  at_risk: "rescue.actions.atRisk",
};

export function RescueReview({ proposal }: { proposal: RescueProposal }) {
  const t = useTranslations();
  const te = useTranslations("errors");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [operationId] = useState(() => crypto.randomUUID());
  const [applied, setApplied] = useState(false);
  const [pending, startTransition] = useTransition();
  const hasChanges = proposal.items.some((item) => item.action === "move" || item.action === "at_risk");

  function apply() {
    startTransition(async () => {
      const result = await confirmRescue({
        operationId,
        targetDate: proposal.targetDate,
        proposalVersion: proposal.proposalVersion,
        items: proposal.items,
      });
      if (!result.ok) {
        toast.error(te(result.error === "rescueConflict" ? "rescueConflict" : "generic"));
        return;
      }
      setApplied(true);
      toast.success(t("rescue.applied"));
      router.refresh();
    });
  }

  function undo() {
    startTransition(async () => {
      const result = await undoRescue({ operationId });
      if (!result.ok) {
        toast.error(te(result.error === "rescueConflict" ? "rescueConflict" : "generic"));
        return;
      }
      setApplied(false);
      toast.success(t("rescue.undone"));
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border bg-bg-surface p-5 shadow-md" aria-labelledby="rescue-preview-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="rescue-preview-heading" className="text-h2 text-text-primary">
            {t("rescue.previewHeading")}
          </h2>
          <p className="mt-1 text-small text-text-secondary">{t("rescue.previewDescription")}</p>
        </div>
        {proposal.overCapacityMinutes > 0 ? (
          <span className="shrink-0 rounded-full bg-danger-50 px-3 py-1 text-caption font-semibold text-danger-800">
            {t("rescue.unplacedMinutes", { minutes: proposal.overCapacityMinutes })}
          </span>
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-border" aria-label={t("rescue.itemsLabel")}>
        {proposal.items.map((item) => (
          <li key={item.taskId} className="flex items-start gap-3 py-3">
            <span
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                item.action === "unplaced" || item.action === "at_risk"
                  ? "bg-danger-50 text-danger-800"
                  : "bg-brand-50 text-brand-700"
              }`}
            >
              {item.action === "unplaced" || item.action === "at_risk" ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-body font-medium text-text-primary">{item.title}</p>
                <span className="text-caption text-text-secondary">{t(ACTION_KEYS[item.action])}</span>
              </div>
              <p className="mt-1 text-caption text-text-secondary">
                {item.startAt && item.endAt
                  ? `${new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
                      timeZone: "Asia/Bangkok",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    }).format(new Date(item.startAt))}–${new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
                      timeZone: "Asia/Bangkok",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                  }).format(new Date(item.endAt))}`
                  : item.reason === "recurringOccurrenceRequired"
                    ? t("rescue.recurringOccurrenceRequired")
                    : t("rescue.noPlacement")}
              </p>
              {item.action === "at_risk" ? (
                <p className="mt-1 text-caption font-medium text-danger-800">{t("rescue.deadlineRisk")}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        {!applied ? (
          <Button type="button" onClick={apply} disabled={pending || !hasChanges}>
            {t(hasChanges ? "rescue.confirm" : "rescue.noChanges")}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={undo} disabled={pending}>
            <RotateCcw aria-hidden="true" />
            {t("rescue.undo")}
          </Button>
        )}
      </div>
    </section>
  );
}
