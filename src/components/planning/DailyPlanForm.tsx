"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveDailyPlan } from "@/core/planning/actions";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  deduplicatePriorityTasks,
  suggestTopPriorityTaskIds,
} from "@/core/planning/workflow-suggestions";

type PlanTaskOption = {
  id: string;
  title: string;
  estimatedMinutes?: number | null;
  deadline?: string | null;
  overdue?: boolean;
  priority?: "high" | "normal" | "low" | null;
  goalId?: string | null;
  projectId?: string | null;
};

type Props = {
  planDate: ISODate;
  tasks: PlanTaskOption[];
  eligibleTopPriorityTaskIds: string[];
  defaultAvailableMinutes?: number;
  initial?: {
    available_minutes: number;
    notes: string | null;
    top_priorities?: string[];
  } | null;
};

const MAX_TOP_PRIORITIES = 3;

export function DailyPlanForm({
  planDate,
  tasks,
  eligibleTopPriorityTaskIds,
  defaultAvailableMinutes,
  initial,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const displayTasks = deduplicatePriorityTasks(tasks, planDate);
  const eligibleTaskIds = new Set(eligibleTopPriorityTaskIds);
  const hasSavedPlan = initial != null;
  const suggestionInputKey = JSON.stringify([
    planDate,
    eligibleTopPriorityTaskIds,
    displayTasks.map(({ id, deadline, overdue, priority, goalId, projectId }) => [
      id,
      deadline,
      overdue,
      priority,
      goalId,
      projectId,
    ]),
    hasSavedPlan,
    initial?.top_priorities ?? null,
  ]);
  const [availableMinutes, setAvailableMinutes] = useState(() =>
    String(initial?.available_minutes ?? defaultAvailableMinutes ?? 480),
  );
  const [budgetEdited, setBudgetEdited] = useState(false);
  const [syncedDefaultBudget, setSyncedDefaultBudget] = useState(defaultAvailableMinutes);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [prioritySelection, setPrioritySelection] = useState(() => ({
    eligibleTaskIds: eligibleTopPriorityTaskIds,
    selectedTaskIds: initial?.top_priorities ??
      (hasSavedPlan
        ? []
        : suggestTopPriorityTaskIds(
            displayTasks.filter((task) => eligibleTaskIds.has(task.id)),
            planDate,
          )),
  }));
  const [syncedSuggestionInputKey, setSyncedSuggestionInputKey] = useState(suggestionInputKey);
  const [priorityEdited, setPriorityEdited] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitLock = useRef(false);
  const eligiblePriorityIds = new Set(eligibleTopPriorityTaskIds);
  if (
    !hasSavedPlan &&
    !budgetEdited &&
    defaultAvailableMinutes != null &&
    syncedDefaultBudget !== defaultAvailableMinutes
  ) {
    setAvailableMinutes(String(defaultAvailableMinutes));
    setSyncedDefaultBudget(defaultAvailableMinutes);
  }
  if (
    prioritySelection.eligibleTaskIds !== eligibleTopPriorityTaskIds ||
    syncedSuggestionInputKey !== suggestionInputKey
  ) {
    const eligibleIds = new Set(eligibleTopPriorityTaskIds);
    const selectedTaskIds =
      syncedSuggestionInputKey !== suggestionInputKey && !priorityEdited
        ? hasSavedPlan
          ? (initial?.top_priorities ?? [])
          : suggestTopPriorityTaskIds(
              displayTasks.filter((task) => eligibleIds.has(task.id)),
              planDate,
            )
        : prioritySelection.selectedTaskIds
            .filter(
              (id, index) =>
                eligibleIds.has(id) && prioritySelection.selectedTaskIds.indexOf(id) === index,
            )
            .slice(0, MAX_TOP_PRIORITIES);
    setPrioritySelection({
      eligibleTaskIds: eligibleTopPriorityTaskIds,
      selectedTaskIds,
    });
    if (syncedSuggestionInputKey !== suggestionInputKey) {
      setSyncedSuggestionInputKey(suggestionInputKey);
    }
  }
  const selectedTopPriorities = prioritySelection.selectedTaskIds
    .filter(
      (id, index) =>
        eligiblePriorityIds.has(id) && prioritySelection.selectedTaskIds.indexOf(id) === index,
    )
    .slice(0, MAX_TOP_PRIORITIES);

  function togglePriority(taskId: string) {
    setPriorityEdited(true);
    setPrioritySelection((current) => {
      const selected = current.selectedTaskIds
        .filter(
          (id, index) =>
            eligiblePriorityIds.has(id) && current.selectedTaskIds.indexOf(id) === index,
        )
        .slice(0, MAX_TOP_PRIORITIES);
      if (selected.includes(taskId)) {
        return { ...current, selectedTaskIds: selected.filter((id) => id !== taskId) };
      }
      if (selected.length >= MAX_TOP_PRIORITIES) {
        return { ...current, selectedTaskIds: selected };
      }
      return { ...current, selectedTaskIds: [...selected, taskId] };
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    startTransition(async () => {
      try {
        const result = await saveDailyPlan({
          planDate,
          availableMinutes: Number(availableMinutes),
          topPriorities: selectedTopPriorities,
          notes: notes.trim() || null,
        });
        if (!result.ok) {
          toast.error(t("errors.generic"));
          return;
        }
        toast.success(t("planning.saved"));
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
      <div>
        <p className="mb-2 text-caption font-medium text-text-secondary">
          {t("planning.topPriorities")}
        </p>
        {!hasSavedPlan && displayTasks.length > 0 ? (
          <p className="mb-2 text-caption text-text-secondary">
            {t("planning.suggestedPrioritiesHint")}
          </p>
        ) : null}
        {displayTasks.length > 0 ? (
          <ul className="max-h-44 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {displayTasks.map((task) => {
              const checked = selectedTopPriorities.includes(task.id);
              const maxReached = !checked && selectedTopPriorities.length >= MAX_TOP_PRIORITIES;
              return (
                <li key={task.id}>
                  <div className="flex min-h-11 items-center gap-3 rounded-md bg-bg-subtle px-3 py-2">
                    <input
                      id={`daily-plan-priority-${task.id}`}
                      type="checkbox"
                      checked={checked}
                      disabled={pending || maxReached}
                      onChange={() => togglePriority(task.id)}
                      className="relative z-10 size-4 shrink-0 scroll-mb-32 accent-[var(--color-brand-500)]"
                    />
                    <label
                      htmlFor={`daily-plan-priority-${task.id}`}
                      className="min-w-0 flex-1 cursor-pointer break-words text-small text-text-primary"
                    >
                      {task.title}
                    </label>
                    {task.estimatedMinutes ? (
                      <span className="shrink-0 text-caption text-text-secondary">
                        {t("planning.minutesShort", { minutes: task.estimatedMinutes })}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-small text-text-secondary">{t("planning.noPriorityTasks")}</p>
        )}
        <p className="mt-2 text-caption text-text-secondary">
          {t("planning.topPrioritiesHint", {
            count: selectedTopPriorities.length,
            max: MAX_TOP_PRIORITIES,
          })}
        </p>
      </div>

      <details className="rounded-md border border-border bg-bg-surface px-3 py-2">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 text-caption font-medium text-text-secondary marker:hidden">
          <span>{t("planning.planOptionsLabel")}</span>
          <span className="line-clamp-1 min-w-0 flex-1 text-right font-normal">
            {t("planning.planOptionsSummary", {
              minutes: Number(availableMinutes) || 0,
              notes: notes.trim() || t("planning.noPlanNotes"),
            })}
          </span>
        </summary>
        <div className="mt-3 grid gap-4 border-t border-border pt-3">
          <div>
            <label
              htmlFor="available-minutes"
              className="mb-1 block text-caption font-medium text-text-secondary"
            >
              {t("planning.availableMinutes")}
            </label>
            <Input
              id="available-minutes"
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
              htmlFor="daily-plan-notes"
              className="mb-1 block text-caption font-medium text-text-secondary"
            >
              {t("planning.notes")}
            </label>
            <Textarea
              id="daily-plan-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("planning.notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>
      </details>

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? t("common.saving") : t("planning.savePlan")}
      </Button>
    </form>
  );
}
