"use client";

import { ChevronDown, ChevronUp } from "@/components/icons/ui-icons";
import { TaskList } from "@/components/domain/TaskList";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";

import type { DayTaskItem } from "@/core/domain/dayplan";
import type { ParentCandidate } from "@/core/goals/schema";
import { setDailyPriorityOrder, undoDailyPriorityOrder } from "@/core/planning/priority-actions";
import {
  reorderVisiblePriorityIds,
  splitPrioritizedDayItems,
} from "@/core/planning/prioritized-day-items";
import type { TaskWithGoal } from "@/core/tasks/schema";
import type { AppLocale } from "@/i18n/config";
import type { ISODate } from "@/lib/date";

type Item = DayTaskItem<TaskWithGoal>;
type ApplyPriorityRequest = {
  kind: "apply";
  userId: string;
  operationId: string;
  planDate: ISODate;
  priorityTaskIds: string[];
  expectedVersion: number;
  previousPriorityTaskIds: string[];
};
type UndoPriorityRequest = {
  kind: "undo";
  userId: string;
  operationId: string;
  planDate: ISODate;
};
type RetryPriorityRequest = ApplyPriorityRequest | UndoPriorityRequest;

type Props = {
  userId: string;
  planDate: ISODate;
  items: Item[];
  eligiblePriorityTaskIds: string[];
  priorityTaskIds: string[];
  version: number;
  priorityIsSaved: boolean;
  goalOptions: ParentCandidate[];
  emptyState?: ReactNode;
};

export function DailyPriorityList({
  userId,
  planDate,
  items,
  eligiblePriorityTaskIds,
  priorityTaskIds: initialPriorityTaskIds,
  version: initialVersion,
  priorityIsSaved: initialPriorityIsSaved,
  goalOptions,
  emptyState,
}: Props) {
  const t = useTranslations();
  const daily = useTranslations("lifePlannerDaily");
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const eligibleIds = useMemo(() => new Set(eligiblePriorityTaskIds), [eligiblePriorityTaskIds]);
  const groupedItems = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of items) {
      const group = groups.get(item.task.id) ?? [];
      group.push(item);
      groups.set(item.task.id, group);
    }
    return groups;
  }, [items]);
  const initialIdsKey = initialPriorityTaskIds.join(",");
  const eligibleIdsKey = eligiblePriorityTaskIds.join(",");
  const propsKey = `${userId}:${planDate}:${initialVersion}:${initialPriorityIsSaved}:${initialIdsKey}:${eligibleIdsKey}`;
  const [priorityTaskIds, setPriorityTaskIds] = useState(() =>
    initialPriorityTaskIds.filter((id) => eligibleIds.has(id)).slice(0, 3),
  );
  const [priorityIsSaved, setPriorityIsSaved] = useState(initialPriorityIsSaved);
  const [pending, setPending] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [liveRetryRequest, setLiveRetryRequest] = useState<RetryPriorityRequest | null>(null);
  const [retryStorageUnavailable, setRetryStorageUnavailable] = useState(false);
  const priorityTaskIdsRef = useRef(priorityTaskIds);
  const versionRef = useRef(initialVersion);
  const mutationPendingRef = useRef(false);
  const retryStorageKey = `kemtit:daily-priority:${userId}:${planDate}`;
  const retrySnapshot = useSyncExternalStore(
    (onStoreChange) => subscribeToSessionStorage(retryStorageKey, onStoreChange),
    () => readSessionStorage(retryStorageKey),
    () => "",
  );
  const storedRetryRequest =
    retrySnapshot && retrySnapshot !== SESSION_STORAGE_UNAVAILABLE
      ? parseRetryRequest(retrySnapshot, userId, planDate)
      : null;
  const retryRequest =
    liveRetryRequest?.userId === userId && liveRetryRequest.planDate === planDate
      ? liveRetryRequest
      : storedRetryRequest;
  const storageUnavailable =
    retryStorageUnavailable || retrySnapshot === SESSION_STORAGE_UNAVAILABLE;

  useEffect(() => {
    if (mutationPendingRef.current || retryRequest) return;
    const nextIds = initialPriorityTaskIds.filter((id) => eligibleIds.has(id)).slice(0, 3);
    priorityTaskIdsRef.current = nextIds;
    versionRef.current = initialVersion;
    setPriorityTaskIds(nextIds);
    setPriorityIsSaved(initialPriorityIsSaved);
    // Serialized keys keep refreshed server props from resetting optimistic state mid-mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propsKey]);

  const visiblePriorityTaskIds = priorityTaskIds.filter((id) => groupedItems.has(id));
  const { prioritized, remaining } = splitPrioritizedDayItems(items, priorityTaskIds);
  const candidateIds = [...groupedItems.keys()];

  async function persist(nextIds: string[]) {
    if (mutationPendingRef.current || retryRequest) return;
    const request: ApplyPriorityRequest = {
      kind: "apply",
      userId,
      operationId: crypto.randomUUID(),
      planDate,
      priorityTaskIds: nextIds,
      expectedVersion: versionRef.current,
      previousPriorityTaskIds: priorityTaskIdsRef.current,
    };
    if (!storeRetryRequest(request, retryStorageKey)) {
      setRetryStorageUnavailable(true);
      toast.error(daily("priorityRetryStorageUnavailable"));
      return;
    }
    setLiveRetryRequest(request);
    mutationPendingRef.current = true;
    setPending(true);
    priorityTaskIdsRef.current = nextIds;
    setPriorityTaskIds(nextIds);

    try {
      const result = await setDailyPriorityOrder(toApplyInput(request));
      if (!result.ok) {
        if (isUncertainError(result.error)) {
          retainRetryRequest(request);
        } else {
          clearPendingRetryRequest();
          priorityTaskIdsRef.current = request.previousPriorityTaskIds;
          setPriorityTaskIds(request.previousPriorityTaskIds);
          showActionError(result.error);
          router.refresh();
        }
        return;
      }

      finishApply(request, result.data);
    } catch {
      retainRetryRequest(request);
    } finally {
      mutationPendingRef.current = false;
      setPending(false);
    }
  }

  function finishApply(
    request: ApplyPriorityRequest,
    data: { operationId: string; priorityTaskIds: string[]; version: number; undone?: boolean },
  ) {
    clearPendingRetryRequest();
    priorityTaskIdsRef.current = data.priorityTaskIds;
    versionRef.current = data.version;
    setPriorityTaskIds(data.priorityTaskIds);
    setPriorityIsSaved(true);
    if (data.undone) {
      toast.success(daily("priorityOrderUndone"));
    } else {
      toast(daily("priorityOrderSaved"), {
        duration: 5000,
        action: {
          label: t("common.undo"),
          onClick: () => void undo(request.operationId),
        },
      });
    }
    router.refresh();
  }

  async function undo(operationId: string) {
    if (mutationPendingRef.current || retryRequest) return;
    const request: UndoPriorityRequest = { kind: "undo", userId, operationId, planDate };
    if (!storeRetryRequest(request, retryStorageKey)) {
      setRetryStorageUnavailable(true);
      toast.error(daily("priorityRetryStorageUnavailable"));
      return;
    }
    setLiveRetryRequest(request);
    mutationPendingRef.current = true;
    setPending(true);
    try {
      const result = await undoDailyPriorityOrder({ operationId });
      if (!result.ok) {
        if (isUncertainError(result.error)) {
          retainRetryRequest(request);
        } else {
          clearPendingRetryRequest();
          showActionError(result.error);
          router.refresh();
        }
        return;
      }
      clearPendingRetryRequest();
      priorityTaskIdsRef.current = result.data.priorityTaskIds;
      versionRef.current = result.data.version;
      setPriorityTaskIds(result.data.priorityTaskIds);
      setPriorityIsSaved(true);
      toast.success(daily("priorityOrderUndone"));
      router.refresh();
    } catch {
      retainRetryRequest(request);
    } finally {
      mutationPendingRef.current = false;
      setPending(false);
    }
  }

  async function retryUnconfirmedRequest() {
    const request = retryRequest;
    if (
      !request ||
      request.userId !== userId ||
      request.planDate !== planDate ||
      mutationPendingRef.current
    )
      return;
    mutationPendingRef.current = true;
    setPending(true);
    try {
      if (request.kind === "apply") {
        const result = await setDailyPriorityOrder(toApplyInput(request));
        if (!result.ok) {
          if (isUncertainError(result.error)) {
            retainRetryRequest(request);
          } else {
            clearPendingRetryRequest();
            priorityTaskIdsRef.current = request.previousPriorityTaskIds;
            setPriorityTaskIds(request.previousPriorityTaskIds);
            showActionError(result.error);
            router.refresh();
          }
          return;
        }
        finishApply(request, result.data);
        return;
      }

      const result = await undoDailyPriorityOrder({ operationId: request.operationId });
      if (!result.ok) {
        if (isUncertainError(result.error)) {
          retainRetryRequest(request);
        } else {
          clearPendingRetryRequest();
          showActionError(result.error);
          router.refresh();
        }
        return;
      }
      clearPendingRetryRequest();
      priorityTaskIdsRef.current = result.data.priorityTaskIds;
      versionRef.current = result.data.version;
      setPriorityTaskIds(result.data.priorityTaskIds);
      setPriorityIsSaved(true);
      toast.success(daily("priorityOrderUndone"));
      router.refresh();
    } catch {
      retainRetryRequest(request);
    } finally {
      mutationPendingRef.current = false;
      setPending(false);
    }
  }

  function retainRetryRequest(request: RetryPriorityRequest) {
    setLiveRetryRequest(request);
  }

  function clearPendingRetryRequest() {
    clearStoredRetryRequest(retryStorageKey);
    setLiveRetryRequest(null);
  }

  function showActionError(error: string) {
    toast.error(
      error === "priorityConflict" ? daily("priorityChangePending") : t("errors.generic"),
    );
  }

  function reorder(fromTaskId: string, toIndex: number) {
    const currentVisible = priorityTaskIdsRef.current.filter((id) => groupedItems.has(id));
    const fromIndex = currentVisible.indexOf(fromTaskId);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= currentVisible.length || fromIndex === toIndex) {
      return;
    }
    const nextVisible = [...currentVisible];
    nextVisible.splice(fromIndex, 1);
    nextVisible.splice(toIndex, 0, fromTaskId);
    void persist(
      reorderVisiblePriorityIds(priorityTaskIdsRef.current, currentVisible, nextVisible),
    );
  }

  function togglePriority(taskId: string, selected: boolean) {
    const current = priorityTaskIdsRef.current;
    const next = selected
      ? current.length < 3 && !current.includes(taskId)
        ? [...current, taskId]
        : current
      : current.filter((id) => id !== taskId);
    if (next.length !== current.length || next.some((id, index) => id !== current[index])) {
      void persist(next);
    }
  }

  if (items.length === 0) return <>{emptyState ?? null}</>;

  return (
    <div className="min-w-0 space-y-3">
      {prioritized.length > 0 ? (
        <section aria-label={daily("savedPriorities")}>
          <h3 className="mb-2 text-small font-semibold text-text-primary">
            {priorityIsSaved ? daily("savedPriorities") : daily("suggestedPriorities")}
          </h3>
          {!priorityIsSaved ? (
            <p className="mb-2 text-caption text-text-secondary">{daily("suggestedHint")}</p>
          ) : null}
          <ol className="space-y-2" aria-label={daily("savedPriorities")}>
            {visiblePriorityTaskIds.map((taskId, index) => {
              const groupItems = groupedItems.get(taskId) ?? [];
              const title = groupItems[0]?.task.title ?? "";
              return (
                <li
                  key={taskId}
                  draggable={!pending && visiblePriorityTaskIds.length > 1}
                  aria-grabbed={draggedTaskId === taskId}
                  onDragStart={(event) => {
                    setDraggedTaskId(taskId);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", taskId);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const draggedId = event.dataTransfer.getData("text/plain") || draggedTaskId;
                    if (draggedId) reorder(draggedId, index);
                    setDraggedTaskId(null);
                  }}
                  onDragEnd={() => setDraggedTaskId(null)}
                  className={`min-w-0 rounded-lg border border-border px-3 py-2 ${draggedTaskId === taskId ? "opacity-60" : ""}`}
                >
                  <div className="mb-1 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      aria-label={daily("moveUp", { title })}
                      title={daily("moveUp", { title })}
                      disabled={pending || index === 0}
                      onClick={() => reorder(taskId, index - 1)}
                      className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-40"
                    >
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={daily("moveDown", { title })}
                      title={daily("moveDown", { title })}
                      disabled={pending || index === visiblePriorityTaskIds.length - 1}
                      onClick={() => reorder(taskId, index + 1)}
                      className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-40"
                    >
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <TaskList
                    items={groupItems}
                    today={planDate}
                    goalOptions={goalOptions}
                    showGoal
                    groupByStatus={false}
                    variant="plain"
                  />
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {remaining.length > 0 ? (
        <section
          aria-label={daily("otherTasks")}
          className={prioritized.length > 0 ? "border-t border-border pt-3" : ""}
        >
          <h3 className="mb-2 text-small font-semibold text-text-primary">
            {prioritized.length > 0
              ? daily("otherTasks")
              : daily("tasksForDay", { date: formatDateLabel(planDate, locale) })}
          </h3>
          <TaskList
            items={remaining}
            today={planDate}
            goalOptions={goalOptions}
            showGoal
            groupByStatus={false}
            variant="plain"
          />
        </section>
      ) : null}

      <details className="border-t border-border pt-3">
        <summary className="min-h-11 cursor-pointer py-2 text-small font-semibold text-brand-700 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none">
          {daily("choosePriorities")}
        </summary>
        <p className="mb-2 text-caption text-text-secondary" aria-live="polite">
          {t("planning.topPrioritiesHint", { count: priorityTaskIds.length, max: 3 })}
          {pending ? ` · ${t("common.saving")}` : ""}
        </p>
        <ul className="space-y-1">
          {candidateIds.map((taskId) => {
            const title = groupedItems.get(taskId)?.[0]?.task.title ?? taskId;
            const checked = priorityTaskIds.includes(taskId);
            return (
              <li key={taskId}>
                <label className="flex min-h-11 min-w-0 items-start gap-3 rounded-md px-2 py-2 text-small text-text-primary hover:bg-bg-subtle">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-brand-700"
                    checked={checked}
                    disabled={pending || (!checked && priorityTaskIds.length >= 3)}
                    onChange={(event) => togglePriority(taskId, event.target.checked)}
                  />
                  <span className="min-w-0 break-words">{title}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </details>
      {retryRequest ? (
        <div
          role="status"
          className="border-warning-300 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-warning-50 px-3 py-2 text-small text-text-primary"
        >
          <span>{daily("priorityRetryPending")}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => void retryUnconfirmedRequest()}
            className="min-h-11 rounded-md px-3 font-medium text-brand-700 hover:bg-white focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-50"
          >
            {pending ? t("common.saving") : t("common.retry")}
          </button>
        </div>
      ) : storageUnavailable ? (
        <p role="alert" className="text-danger-700 text-caption">
          {daily("priorityRetryStorageUnavailable")}
        </p>
      ) : null}
    </div>
  );
}

function toApplyInput(request: ApplyPriorityRequest) {
  return {
    operationId: request.operationId,
    planDate: request.planDate,
    priorityTaskIds: request.priorityTaskIds,
    expectedVersion: request.expectedVersion,
  };
}

function isUncertainError(error: string) {
  return error !== "priorityConflict" && error !== "unauthorized" && error !== "validation";
}

function storeRetryRequest(request: RetryPriorityRequest, storageKey: string) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(request));
    dispatchSessionStorageChange(storageKey);
    return true;
  } catch {
    return false;
  }
}

function clearStoredRetryRequest(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
    dispatchSessionStorageChange(storageKey);
  } catch {
    // A leftover idempotent request is safe to retry after reload.
  }
}

function parseRetryRequest(
  value: string,
  userId: string,
  planDate: ISODate,
): RetryPriorityRequest | null {
  try {
    const request: unknown = JSON.parse(value);
    if (!request || typeof request !== "object") return null;
    const record = request as Record<string, unknown>;
    if (
      typeof record.operationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        record.operationId,
      ) ||
      record.userId !== userId ||
      record.planDate !== planDate
    )
      return null;
    if (record.kind === "undo") {
      return { kind: "undo", userId, operationId: record.operationId, planDate };
    }
    if (
      record.kind !== "apply" ||
      !Array.isArray(record.priorityTaskIds) ||
      record.priorityTaskIds.length > 3 ||
      !record.priorityTaskIds.every((id) => typeof id === "string") ||
      new Set(record.priorityTaskIds).size !== record.priorityTaskIds.length ||
      !Array.isArray(record.previousPriorityTaskIds) ||
      record.previousPriorityTaskIds.length > 3 ||
      !record.previousPriorityTaskIds.every((id) => typeof id === "string") ||
      new Set(record.previousPriorityTaskIds).size !== record.previousPriorityTaskIds.length ||
      typeof record.expectedVersion !== "number" ||
      !Number.isInteger(record.expectedVersion) ||
      record.expectedVersion < 0
    )
      return null;
    return {
      kind: "apply",
      userId,
      operationId: record.operationId,
      planDate,
      priorityTaskIds: record.priorityTaskIds as string[],
      previousPriorityTaskIds: record.previousPriorityTaskIds as string[],
      expectedVersion: record.expectedVersion,
    };
  } catch {
    return null;
  }
}

const SESSION_STORAGE_UNAVAILABLE = "__session_storage_unavailable__";
const SESSION_STORAGE_EVENT = "kemtit:session-storage-change";

function readSessionStorage(storageKey: string) {
  try {
    return window.sessionStorage.getItem(storageKey) ?? "";
  } catch {
    return SESSION_STORAGE_UNAVAILABLE;
  }
}

function subscribeToSessionStorage(storageKey: string, onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === storageKey) onChange();
  }
  function onLocalChange(event: Event) {
    if ((event as CustomEvent<string>).detail === storageKey) onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSION_STORAGE_EVENT, onLocalChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SESSION_STORAGE_EVENT, onLocalChange);
  };
}

function dispatchSessionStorageChange(storageKey: string) {
  window.dispatchEvent(new CustomEvent(SESSION_STORAGE_EVENT, { detail: storageKey }));
}

function formatDateLabel(value: ISODate, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
