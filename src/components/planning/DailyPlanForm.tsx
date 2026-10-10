"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveDailyPlanSettings } from "@/core/planning/daily-plan-settings-actions";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  planDate: ISODate;
  defaultAvailableMinutes?: number;
  initial?: {
    available_minutes: number;
    notes: string | null;
  } | null;
};

export function DailyPlanForm({ planDate, defaultAvailableMinutes, initial }: Props) {
  const t = useTranslations();
  const daily = useTranslations("lifePlannerDaily");
  const router = useRouter();
  const [availableMinutes, setAvailableMinutes] = useState(() =>
    String(initial?.available_minutes ?? defaultAvailableMinutes ?? 480),
  );
  const [budgetEdited, setBudgetEdited] = useState(false);
  const [syncedDefaultBudget, setSyncedDefaultBudget] = useState(defaultAvailableMinutes);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [pending, startTransition] = useTransition();
  const submitLock = useRef(false);

  if (
    !initial &&
    !budgetEdited &&
    defaultAvailableMinutes != null &&
    syncedDefaultBudget !== defaultAvailableMinutes
  ) {
    setAvailableMinutes(String(defaultAvailableMinutes));
    setSyncedDefaultBudget(defaultAvailableMinutes);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    startTransition(async () => {
      try {
        const result = await saveDailyPlanSettings({
          planDate,
          availableMinutes: Number(availableMinutes),
          notes: notes.trim() || null,
        });
        if (!result.ok) {
          toast.error(t("errors.generic"));
          return;
        }
        toast.success(daily("planSaved"));
        router.refresh();
      } catch {
        toast.error(t("errors.generic"));
      } finally {
        submitLock.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <details className="rounded-md border border-border bg-bg-surface px-3 py-2">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 text-caption font-medium text-text-secondary marker:hidden">
          <span>{daily("planOptionsLabel")}</span>
          <span className="line-clamp-1 min-w-0 flex-1 text-right font-normal">
            {daily("planOptionsSummary", {
              minutes: Number(availableMinutes) || 0,
              notes: notes.trim() || daily("noPlanNotes"),
            })}
          </span>
        </summary>
        <div className="mt-3 grid gap-4 border-t border-border pt-3">
          <div>
            <label
              htmlFor={`available-minutes-${planDate}`}
              className="mb-1 block text-caption font-medium text-text-secondary"
            >
              {daily("plannedBudgetField")}
            </label>
            <Input
              id={`available-minutes-${planDate}`}
              type="number"
              min={0}
              max={1440}
              step={1}
              value={availableMinutes}
              onChange={(event) => {
                setBudgetEdited(true);
                setAvailableMinutes(event.target.value);
              }}
            />
          </div>

          <div>
            <label
              htmlFor={`daily-plan-notes-${planDate}`}
              className="mb-1 block text-caption font-medium text-text-secondary"
            >
              {daily("notesForDay")}
            </label>
            <Textarea
              id={`daily-plan-notes-${planDate}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={daily("notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>
      </details>

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? t("common.saving") : daily("savePlan")}
      </Button>
    </form>
  );
}
