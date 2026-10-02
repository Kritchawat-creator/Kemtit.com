"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveWeeklyReview } from "@/core/reviews/actions";
import { carryOverReviewTasks } from "@/core/reviews/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  weekStart: string;
  initial?: { wins: string | null; blockers: string | null; next_focus: string | null } | null;
  carryoverTasks?: {
    id: string;
    title: string;
    planned_date: string | null;
    deadline: string | null;
  }[];
  nextWeekStart?: string;
};

export function WeeklyReviewForm({
  weekStart,
  initial,
  carryoverTasks = [],
  nextWeekStart,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [wins, setWins] = useState(initial?.wins ?? "");
  const [blockers, setBlockers] = useState(initial?.blockers ?? "");
  const [nextFocus, setNextFocus] = useState(initial?.next_focus ?? "");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveWeeklyReview({
        weekStart,
        wins: wins || null,
        blockers: blockers || null,
        nextFocus: nextFocus || null,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("reviews.saved"));
      router.refresh();
    });
  }

  function carryOver() {
    if (!nextWeekStart || selectedTaskIds.length === 0) return;
    startTransition(async () => {
      const result = await carryOverReviewTasks({
        taskIds: selectedTaskIds,
        plannedDate: nextWeekStart,
      });
      if (!result.ok) {
        const errorMessage =
          result.error === "deadlineConflict"
            ? t("reviews.deadlineConflict")
            : result.error === "timeBlockConflict"
              ? t("errors.timeBlockConflict")
              : result.error === "timeBlockLocked"
                ? t("errors.timeBlockLocked")
                : result.error === "timeBlockAnchorMissing"
                  ? t("errors.timeBlockAnchorMissing")
                  : result.error === "timeBlockAnchorMismatch"
                    ? t("errors.timeBlockAnchorMismatch")
                    : result.error === "recurringOccurrenceRequired"
                      ? t("errors.recurringOccurrenceRequired")
                      : t("errors.generic");
        toast.error(errorMessage);
        return;
      }
      toast.success(t("reviews.carryoverSaved", { count: result.data.count }));
      setSelectedTaskIds([]);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5 shadow-md"
    >
      <Field
        id="review-wins"
        label={t("reviews.form.wins")}
        value={wins}
        onChange={setWins}
        placeholder={t("reviews.form.winsPlaceholder")}
      />
      <Field
        id="review-blockers"
        label={t("reviews.form.blockers")}
        value={blockers}
        onChange={setBlockers}
        placeholder={t("reviews.form.blockersPlaceholder")}
      />
      <Field
        id="review-next-focus"
        label={t("reviews.form.nextFocus")}
        value={nextFocus}
        onChange={setNextFocus}
        placeholder={t("reviews.form.nextFocusPlaceholder")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("reviews.form.submit")}
      </Button>
      {carryoverTasks.length > 0 && nextWeekStart ? (
        <div className="border-t border-border pt-4">
          <h3 className="text-small font-semibold text-brand-800">{t("reviews.carryoverTitle")}</h3>
          <p className="mt-1 text-caption text-text-secondary">
            {t("reviews.carryoverDescription")}
          </p>
          <div className="mt-3 space-y-2">
            {carryoverTasks.map((task) => (
              <label
                key={task.id}
                className="flex items-start gap-2 rounded-lg bg-bg-subtle p-3 text-small"
              >
                <input
                  type="checkbox"
                  checked={selectedTaskIds.includes(task.id)}
                  onChange={(event) =>
                    setSelectedTaskIds((current) =>
                      event.target.checked
                        ? [...current, task.id]
                        : current.filter((id) => id !== task.id),
                    )
                  }
                  disabled={pending}
                  className="mt-0.5 size-4 accent-brand-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-text-primary">{task.title}</span>
                  {task.deadline ? (
                    <span className="mt-0.5 block text-caption text-text-secondary">
                      {t("reviews.deadline", { date: task.deadline })}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
          <Button
            type="button"
            className="mt-3"
            variant="outline"
            onClick={carryOver}
            disabled={pending || selectedTaskIds.length === 0}
          >
            {t("reviews.carryoverAction")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-caption font-medium text-text-secondary">
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    </div>
  );
}
