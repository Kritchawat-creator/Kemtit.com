"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createTimeBlock } from "@/core/planning/actions";
import type { Interval } from "@/core/planning/availability";
import { DEFAULT_TASK_MINUTES } from "@/core/planning/capacity";
import type { DayTaskItem } from "@/core/domain/dayplan";
import type { TaskWithGoal } from "@/core/tasks/schema";
import type { ISODate } from "@/lib/date";
import {
  defaultManualTimeBlockSlot,
  suggestTimeBlockSlot,
  type SuggestedTimeSlot,
} from "@/core/planning/workflow-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  date: ISODate;
  tasks: DayTaskItem<TaskWithGoal>[];
} & (
  | { freeIntervals: readonly Interval[]; suggestionNow: number }
  | { freeIntervals?: undefined; suggestionNow?: undefined }
);

type TimeSuggestion = {
  slot: SuggestedTimeSlot | null;
  availabilityKnown: boolean;
  usesDefaultEstimate: boolean;
  durationMinutes: number;
};

function toBangkokIso(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}

function isValidTimeRange(startAt: string, endAt: string): boolean {
  const start = Date.parse(`${startAt}:00+07:00`);
  const end = Date.parse(`${endAt}:00+07:00`);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function estimateMinutes(task: DayTaskItem<TaskWithGoal> | null): number {
  return task?.task.estimated_minutes ?? DEFAULT_TASK_MINUTES;
}

function buildTimeSuggestion(
  date: string,
  task: DayTaskItem<TaskWithGoal> | null,
  freeIntervals: readonly Interval[] | undefined,
  suggestionNow: number | undefined,
): TimeSuggestion {
  const durationMinutes = estimateMinutes(task);
  return {
    slot:
      freeIntervals === undefined
        ? null
        : suggestTimeBlockSlot({
            date,
            freeIntervals,
            durationMinutes,
            now: suggestionNow ?? 0,
          }),
    availabilityKnown: freeIntervals !== undefined,
    usesDefaultEstimate: task?.task.estimated_minutes == null,
    durationMinutes,
  };
}

function fallbackTimeRange(date: ISODate, durationMinutes: number) {
  return defaultManualTimeBlockSlot(date, durationMinutes);
}

export function TimeBlockForm(props: Props) {
  return <TimeBlockFormForDate key={props.date} {...props} />;
}

function TimeBlockFormForDate({ date, tasks, freeIntervals, suggestionNow }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const firstTask = tasks[0] ?? null;
  const [taskKey, setTaskKey] = useState(firstTask?.key ?? "");
  const [title, setTitle] = useState(firstTask?.task.title ?? "");
  const [taskSelectionEdited, setTaskSelectionEdited] = useState(false);
  const [titleEdited, setTitleEdited] = useState(false);
  const [timeEdited, setTimeEdited] = useState(false);
  const [timeSuggestion, setTimeSuggestion] = useState(() =>
    buildTimeSuggestion(date, firstTask, freeIntervals, suggestionNow),
  );
  const initialRange = timeSuggestion.slot ??
    (timeSuggestion.availabilityKnown
      ? { startAtLocal: "", endAtLocal: "" }
      : fallbackTimeRange(date, timeSuggestion.durationMinutes));
  const [startAt, setStartAt] = useState(initialRange.startAtLocal);
  const [endAt, setEndAt] = useState(initialRange.endAtLocal);
  const availabilityInputKey = JSON.stringify([freeIntervals ?? null, suggestionNow ?? null]);
  const [syncedAvailabilityInputKey, setSyncedAvailabilityInputKey] =
    useState(availabilityInputKey);
  const [pending, startTransition] = useTransition();
  const submitLock = useRef(false);
  const selectedTask = tasks.find((item) => item.key === taskKey) ?? null;
  const taskForSuggestion =
    selectedTask ?? (!taskKey && !taskSelectionEdited ? firstTask : null);

  if (syncedAvailabilityInputKey !== availabilityInputKey && !timeEdited) {
    const suggestion = buildTimeSuggestion(date, taskForSuggestion, freeIntervals, suggestionNow);
    const fallback = fallbackTimeRange(date, suggestion.durationMinutes);
    setTimeSuggestion(suggestion);
    setStartAt(
      suggestion.slot?.startAtLocal ?? (suggestion.availabilityKnown ? "" : fallback.startAtLocal),
    );
    setEndAt(
      suggestion.slot?.endAtLocal ?? (suggestion.availabilityKnown ? "" : fallback.endAtLocal),
    );
    setSyncedAvailabilityInputKey(availabilityInputKey);
  }

  // A task captured after Today rendered should become the default while this draft is untouched.
  if (!taskKey && !taskSelectionEdited && firstTask) {
    const suggestion = buildTimeSuggestion(date, firstTask, freeIntervals, suggestionNow);
    const fallback = fallbackTimeRange(date, suggestion.durationMinutes);
    setTaskKey(firstTask.key);
    if (!titleEdited) setTitle(firstTask.task.title);
    setTimeSuggestion(suggestion);
    if (!timeEdited) {
      setStartAt(
        suggestion.slot?.startAtLocal ?? (suggestion.availabilityKnown ? "" : fallback.startAtLocal),
      );
      setEndAt(
        suggestion.slot?.endAtLocal ?? (suggestion.availabilityKnown ? "" : fallback.endAtLocal),
      );
    }
  }

  const validTimeRange = isValidTimeRange(startAt, endAt);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    startTransition(async () => {
      try {
        const result = await createTimeBlock({
          taskId: selectedTask?.task.id ?? null,
          taskOccurrenceDate: selectedTask?.recurring
            ? (selectedTask.occurrenceDate ?? selectedTask.date)
            : null,
          taskScheduledDate: selectedTask?.recurring ? selectedTask.date : null,
          title: title.trim(),
          startAt: toBangkokIso(startAt),
          endAt: toBangkokIso(endAt),
          source: "manual",
        });
        if (!result.ok) {
          toast.error(
            result.error === "timeBlockConflict"
              ? t("errors.timeBlockConflict")
              : t("errors.generic"),
          );
          return;
        }
        toast.success(t("planning.timeBlockSaved"));
        router.refresh();
      } catch {
        toast.error(t("errors.generic"));
      } finally {
        submitLock.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-3">
      <div className="min-w-0">
        <label
          htmlFor="time-block-title"
          className="mb-1 block text-caption font-medium text-text-secondary"
        >
          {t("planning.timeBlockTitle")}
        </label>
        <Input
          id="time-block-title"
          value={title}
          onChange={(event) => {
            setTitleEdited(true);
            setTitle(event.target.value);
          }}
          required
        />
      </div>
      <div className="min-w-0">
        <label
          htmlFor="time-block-task"
          className="mb-1 block text-caption font-medium text-text-secondary"
        >
          {t("planning.linkTask")}
        </label>
        <select
          id="time-block-task"
          value={taskKey}
          onChange={(event) => {
            const nextTaskKey = event.target.value;
            const nextTask = tasks.find((item) => item.key === nextTaskKey) ?? null;
            const suggestion = buildTimeSuggestion(date, nextTask, freeIntervals, Date.now());
            const fallback = fallbackTimeRange(date, suggestion.durationMinutes);
            setTaskSelectionEdited(true);
            setTaskKey(nextTaskKey);
            if (!titleEdited) setTitle(nextTask?.task.title ?? "");
            setTimeSuggestion(suggestion);
            setStartAt(
              suggestion.slot?.startAtLocal ??
                (suggestion.availabilityKnown ? "" : fallback.startAtLocal),
            );
            setEndAt(
              suggestion.slot?.endAtLocal ??
                (suggestion.availabilityKnown ? "" : fallback.endAtLocal),
            );
            setTimeEdited(false);
          }}
          className="h-11 w-full max-w-full min-w-0 rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
        >
          <option value="">{t("planning.noLinkedTask")}</option>
          {tasks.map((item) => (
            <option key={item.key} value={item.key}>
              {item.task.title}
              {item.recurring && item.occurrenceDate && item.occurrenceDate !== item.date
                ? ` (${item.occurrenceDate} → ${item.date})`
                : ""}
            </option>
          ))}
        </select>
        {timeSuggestion.availabilityKnown ? (
          <div className="mt-2 space-y-1 text-caption text-text-secondary" aria-live="polite">
            {timeSuggestion.slot ? (
              <p>
                {t("planning.timeBlockSuggestedSlot", {
                  minutes: timeSuggestion.slot.durationMinutes,
                })}
              </p>
            ) : (
              <p>{t("planning.timeBlockNoSuggestedSlot")}</p>
            )}
            {timeSuggestion.usesDefaultEstimate ? (
              <p>
                {t("planning.timeBlockDefaultEstimate", {
                  minutes: DEFAULT_TASK_MINUTES,
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
        <div className="min-w-0">
          <label
            htmlFor="time-block-start"
            className="mb-1 block text-caption font-medium text-text-secondary"
          >
            {t("planning.starts")}
          </label>
          <Input
            id="time-block-start"
            type="datetime-local"
            className="max-w-full"
            value={startAt}
            onChange={(event) => {
              setTimeEdited(true);
              setStartAt(event.target.value);
            }}
            required
          />
        </div>
        <div className="min-w-0">
          <label
            htmlFor="time-block-end"
            className="mb-1 block text-caption font-medium text-text-secondary"
          >
            {t("planning.ends")}
          </label>
          <Input
            id="time-block-end"
            type="datetime-local"
            className="max-w-full"
            value={endAt}
            onChange={(event) => {
              setTimeEdited(true);
              setEndAt(event.target.value);
            }}
            required
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <Button
          type="submit"
          className="min-h-11"
          disabled={pending || !title.trim() || !validTimeRange}
        >
          {pending ? t("common.saving") : t("planning.schedule")}
        </Button>
      </div>
    </form>
  );
}
