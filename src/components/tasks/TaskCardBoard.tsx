"use client";

import {
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "@/components/icons/ui-icons";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";

import type { ParentCandidate } from "@/core/goals/schema";
import { removePhoto } from "@/core/photos/actions";
import {
  cancelTaskCardPhotoReservation,
  setTaskCardPhotoOrder,
} from "@/core/photos/task-card-actions";
import {
  prepareAndReserveTaskCardPhoto,
  uploadReservedTaskCardPhoto,
  type PreparedTaskCardPhotoUpload,
} from "@/core/photos/task-card-upload";
import { mutateTaskCardGroup, undoTaskCardGroup } from "@/core/tasks/card-actions";
import { mutateTaskCardGroupSchema, type MutateTaskCardGroupInput } from "@/core/tasks/card-schema";
import type {
  TaskCardLinkedBlock,
  TaskCardGroup,
  TaskCardGroupMember,
  TaskCardPendingPhoto,
  TaskCardTask,
} from "@/core/tasks/card-queries";
import { parseRRule } from "@/core/domain/recurrence";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import { TASK_PHOTO_LIMIT } from "@/lib/supabase/storage";
import { APP_TIME_ZONE, toBkkDate, type ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { DomainTag } from "@/components/domain/DomainTag";
import { TaskForm } from "@/components/domain/TaskForm";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type Props = {
  userId: string;
  tasks: TaskCardTask[];
  groups: TaskCardGroup[];
  groupMembers: TaskCardGroupMember[];
  pendingPhotos: TaskCardPendingPhoto[];
  today: ISODate;
  goalOptions: ParentCandidate[];
  projectOptions: { id: string; title: string }[];
};

type Photo = TaskCardTask["photos"][number];

type ErrorMessages = {
  photoLimit: string;
  uploadFailed: string;
  photoInvalid: string;
  photoCancelled: string;
  undoConflict: string;
  generic: string;
};

type PendingGroupOperation =
  { kind: "mutation"; request: MutateTaskCardGroupInput } | { kind: "undo"; operationId: string };

const GROUP_STORAGE_UNAVAILABLE = "__task_card_group_storage_unavailable__";
const GROUP_STORAGE_HYDRATING = "__task_card_group_storage_hydrating__";
const GROUP_STORAGE_EVENT = "kemtit:task-card-group-storage-change";

function subscribeToGroupStorage(key: string, onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(GROUP_STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(GROUP_STORAGE_EVENT, onStoreChange);
  };
}

function readGroupStorage(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return GROUP_STORAGE_UNAVAILABLE;
  }
}

function serverGroupStorageSnapshot() {
  return GROUP_STORAGE_HYDRATING;
}

const pendingGroupOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mutation"), request: mutateTaskCardGroupSchema }),
  z.object({ kind: z.literal("undo"), operationId: z.uuid() }),
]);

function parsePendingGroupOperation(serialized: string): PendingGroupOperation | null {
  try {
    const parsed = pendingGroupOperationSchema.safeParse(JSON.parse(serialized));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function errorLabel(error: string, messages: ErrorMessages) {
  if (error === "photoLimit") return messages.photoLimit;
  if (error === "uploadFailed" || error === "uploadUncertain") return messages.uploadFailed;
  if (error === "photoInvalid" || error === "photoType" || error === "photoTooLarge") {
    return messages.photoInvalid;
  }
  if (error === "photoReservationCancelled") return messages.photoCancelled;
  if (error === "conflict" || error === "undoConflict" || error === "idempotencyConflict")
    return messages.undoConflict;
  return messages.generic;
}

function formatLinkedBlockDateTime(block: TaskCardLinkedBlock, locale: AppLocale) {
  const date = toBkkDate(block.start_at);
  const start = formatInTimeZone(new Date(block.start_at), APP_TIME_ZONE, "HH:mm");
  const end = formatInTimeZone(new Date(block.end_at), APP_TIME_ZONE, "HH:mm");
  return `${formatDate(date, "medium", locale)} · ${start}–${end}`;
}

export function TaskCardBoard({
  userId,
  tasks,
  groups,
  groupMembers,
  pendingPhotos,
  today,
  goalOptions,
  projectOptions,
}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const errorMessages: ErrorMessages = {
    photoLimit: t("errors.photoLimit"),
    uploadFailed: t("errors.uploadFailed"),
    photoInvalid: t("errors.photoInvalid"),
    photoCancelled: t("taskCards.photoCancelled"),
    undoConflict: t("taskCards.undoConflict"),
    generic: t("errors.generic"),
  };
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [groupControlsOpen, setGroupControlsOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameGroupTitle, setRenameGroupTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);
  const [groupStorageWriteFailed, setGroupStorageWriteFailed] = useState(false);
  const groupMutationPendingRef = useRef(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const groupOperationStorageKey = `kemtit:task-card-group:${userId}`;
  const subscribeGroupStorage = useCallback(
    (onStoreChange: () => void) => subscribeToGroupStorage(groupOperationStorageKey, onStoreChange),
    [groupOperationStorageKey],
  );
  const getGroupStorageSnapshot = useCallback(
    () => readGroupStorage(groupOperationStorageKey),
    [groupOperationStorageKey],
  );
  const groupOperationSnapshot = useSyncExternalStore(
    subscribeGroupStorage,
    getGroupStorageSnapshot,
    serverGroupStorageSnapshot,
  );
  const groupRecoveryReady = groupOperationSnapshot !== GROUP_STORAGE_HYDRATING;
  const pendingGroupOperation =
    groupOperationSnapshot &&
    groupOperationSnapshot !== GROUP_STORAGE_UNAVAILABLE &&
    groupRecoveryReady
      ? parsePendingGroupOperation(groupOperationSnapshot)
      : null;
  const groupStorageUnavailable =
    groupStorageWriteFailed ||
    groupOperationSnapshot === GROUP_STORAGE_UNAVAILABLE ||
    (groupRecoveryReady && groupOperationSnapshot !== "" && pendingGroupOperation === null);
  const groupControlsVisible = groupControlsOpen || Boolean(pendingGroupOperation);

  function persistGroupOperation(operation: PendingGroupOperation) {
    try {
      window.localStorage.setItem(groupOperationStorageKey, JSON.stringify(operation));
      setGroupStorageWriteFailed(false);
      window.dispatchEvent(new Event(GROUP_STORAGE_EVENT));
      return true;
    } catch {
      setGroupStorageWriteFailed(true);
      return false;
    }
  }

  function clearGroupOperation() {
    try {
      window.localStorage.removeItem(groupOperationStorageKey);
      setGroupStorageWriteFailed(false);
      window.dispatchEvent(new Event(GROUP_STORAGE_EVENT));
    } catch {
      // Keep the same id available for a safe replay if the stored copy cannot be cleared.
      setGroupStorageWriteFailed(true);
    }
  }

  const visibleGroupIds = new Set(
    tasks.flatMap((task) => (task.task_group_id ? [task.task_group_id] : [])),
  );
  const visibleGroups = groups.filter((group) => visibleGroupIds.has(group.id));
  const ungroupedTasks = tasks.filter((task) => !task.task_group_id);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id));
  const pendingByTask = useMemo(() => {
    const result = new Map<string, TaskCardPendingPhoto[]>();
    for (const photo of pendingPhotos) {
      const current = result.get(photo.task_id) ?? [];
      current.push(photo);
      result.set(photo.task_id, current);
    }
    return result;
  }, [pendingPhotos]);
  const detailTask = taskById.get(detailTaskId ?? "") ?? null;
  const detailRule = detailTask?.recurrence_rule ? parseRRule(detailTask.recurrence_rule) : null;

  function toggleSelected(taskId: string) {
    setGroupControlsOpen(true);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function expectedSnapshots(
    action: MutateTaskCardGroupInput["action"],
    groupId: string | null,
    taskIds: string[],
  ) {
    const affectedGroupIds = new Set<string>();
    if (groupId) affectedGroupIds.add(groupId);
    if (action === "create" || action === "add") {
      for (const taskId of taskIds) {
        const group = taskById.get(taskId)?.task_group_id;
        if (group) affectedGroupIds.add(group);
      }
    }
    const expectedGroupVersions = groups
      .filter((group) => affectedGroupIds.has(group.id))
      .map((group) => ({ groupId: group.id, version: group.version }));
    const taskStates = new Map<string, { id: string; updatedAt: string; groupId: string | null }>();
    for (const member of groupMembers) {
      if (
        action !== "rename" &&
        member.task_group_id &&
        affectedGroupIds.has(member.task_group_id)
      ) {
        taskStates.set(member.id, {
          id: member.id,
          updatedAt: member.updated_at,
          groupId: member.task_group_id,
        });
      }
    }
    for (const taskId of taskIds) {
      const task = taskById.get(taskId);
      if (task) {
        taskStates.set(task.id, {
          id: task.id,
          updatedAt: task.updated_at,
          groupId: task.task_group_id,
        });
      }
    }
    return {
      expectedGroupVersions,
      expectedTaskStates: [...taskStates.values()],
    };
  }

  async function applyGroupMutation(
    action: MutateTaskCardGroupInput["action"],
    groupId: string | null,
    taskIds: string[],
    title: string | null = null,
  ) {
    if (busy || groupMutationPendingRef.current || !groupRecoveryReady || groupStorageUnavailable)
      return;
    const snapshots = expectedSnapshots(action, groupId, taskIds);
    const request = {
      action,
      groupId,
      taskIds,
      title,
      ...snapshots,
    };
    if (pendingGroupOperation) {
      if (pendingGroupOperation.kind !== "mutation") {
        toast.error(t("taskCards.groupChangeUncertain"));
        return;
      }
      const pendingRequest = {
        action: pendingGroupOperation.request.action,
        groupId: pendingGroupOperation.request.groupId,
        taskIds: pendingGroupOperation.request.taskIds,
        title: pendingGroupOperation.request.title,
        expectedGroupVersions: pendingGroupOperation.request.expectedGroupVersions,
        expectedTaskStates: pendingGroupOperation.request.expectedTaskStates,
      };
      if (JSON.stringify(request) !== JSON.stringify(pendingRequest)) {
        toast.error(t("taskCards.groupChangeUncertain"));
        return;
      }
      await runGroupMutation(pendingGroupOperation.request, true);
      return;
    }
    await runGroupMutation({ operationId: crypto.randomUUID(), ...request }, false);
  }

  async function runGroupMutation(request: MutateTaskCardGroupInput, isRetry: boolean) {
    if (busy || groupMutationPendingRef.current || !groupRecoveryReady) return;
    if (!isRetry && !persistGroupOperation({ kind: "mutation", request })) {
      toast.error(t("taskCards.groupRetryStorageUnavailable"));
      return;
    }
    groupMutationPendingRef.current = true;
    setBusy(true);
    try {
      const result = await mutateTaskCardGroup(request);
      if (!result.ok) {
        if (result.error === "generic") {
          persistGroupOperation({ kind: "mutation", request });
          toast.error(t("taskCards.groupChangeUncertain"));
        } else {
          clearGroupOperation();
          toast.error(errorLabel(result.error, errorMessages));
          router.refresh();
        }
        return;
      }
      clearGroupOperation();
      setSelectedIds(new Set());
      setLastOperationId(result.data.canUndo ? result.data.operationId : null);
      toast.success(t("taskCards.groupSaved"));
      router.refresh();
    } catch {
      persistGroupOperation({ kind: "mutation", request });
      toast.error(t("taskCards.groupChangeUncertain"));
    } finally {
      groupMutationPendingRef.current = false;
      setBusy(false);
    }
  }

  async function retryGroupMutation() {
    if (!groupRecoveryReady || groupStorageUnavailable || !pendingGroupOperation) return;
    if (pendingGroupOperation.kind === "mutation") {
      await runGroupMutation(pendingGroupOperation.request, true);
    } else {
      await undoGroupChange(pendingGroupOperation.operationId, true);
    }
  }

  async function undoGroupChange(operationId = lastOperationId, isRetry = false) {
    if (!operationId || busy || groupMutationPendingRef.current || !groupRecoveryReady) return;
    if (pendingGroupOperation && !isRetry) {
      toast.error(t("taskCards.groupChangeUncertain"));
      return;
    }
    if (!isRetry && !persistGroupOperation({ kind: "undo", operationId })) {
      toast.error(t("taskCards.groupRetryStorageUnavailable"));
      return;
    }
    groupMutationPendingRef.current = true;
    setBusy(true);
    try {
      const result = await undoTaskCardGroup({ operationId });
      if (!result.ok) {
        if (result.error === "generic") {
          persistGroupOperation({ kind: "undo", operationId });
          toast.error(t("taskCards.groupChangeUncertain"));
          return;
        }
        clearGroupOperation();
        toast.error(errorLabel(result.error, errorMessages));
        return;
      }
      clearGroupOperation();
      setLastOperationId(null);
      toast.success(t("common.undo"));
      router.refresh();
    } catch {
      persistGroupOperation({ kind: "undo", operationId });
      toast.error(t("taskCards.groupChangeUncertain"));
    } finally {
      groupMutationPendingRef.current = false;
      setBusy(false);
    }
  }

  async function addSelectedToGroup(groupId: string) {
    const movingTasks = selectedTasks.filter((task) => task.task_group_id !== groupId);
    if (movingTasks.length === 0) return;
    await applyGroupMutation(
      "add",
      groupId,
      movingTasks.map((task) => task.id),
    );
  }

  function dropTaskOnGroup(taskId: string, groupId: string) {
    const task = taskById.get(taskId);
    if (!task || task.task_group_id === groupId) return;
    void applyGroupMutation("add", groupId, [taskId]);
  }

  function dropTaskOnTask(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const source = taskById.get(sourceId);
    const target = taskById.get(targetId);
    if (
      !source ||
      !target ||
      (source.task_group_id && source.task_group_id === target.task_group_id)
    )
      return;
    if (target.task_group_id) {
      void applyGroupMutation("add", target.task_group_id, [sourceId]);
      return;
    }
    void applyGroupMutation("create", null, [sourceId, targetId], t("taskCards.groupDefaultName"));
  }

  function dragStart(event: DragEvent<HTMLElement>, taskId: string) {
    event.dataTransfer.setData("text/task-id", taskId);
    event.dataTransfer.effectAllowed = "move";
  }

  function draggedTaskId(event: DragEvent<HTMLElement>) {
    return event.dataTransfer.getData("text/task-id");
  }

  async function uploadSelectedPhotos(task: TaskCardTask, files: FileList | null) {
    if (!files?.length || busy) return;
    const alreadyInFlight = pendingByTask.get(task.id)?.length ?? 0;
    const remaining = Math.max(0, TASK_PHOTO_LIMIT - task.photos.length - alreadyInFlight);
    const selectedFiles = Array.from(files).slice(0, remaining);
    if (selectedFiles.length === 0) {
      toast.error(t("errors.photoLimit"));
      return;
    }
    setBusy(true);
    const reservations: PreparedTaskCardPhotoUpload[] = [];
    try {
      for (const file of selectedFiles) {
        const reservation = await prepareAndReserveTaskCardPhoto(file, task.id);
        if (!reservation.ok) {
          toast.error(errorLabel(reservation.error, errorMessages));
          break;
        }
        reservations.push(reservation.data);
      }
      // Every permanent order slot is reserved in the chooser's selection order
      // before any upload can finish out of order.
      router.refresh();
      const uploads = await Promise.allSettled(
        reservations.map((reservation) => uploadReservedTaskCardPhoto(reservation)),
      );
      if (uploads.some((upload) => upload.status === "fulfilled" && upload.value.ok)) {
        toast.success(t("taskCards.photoOrderSaved"));
      }
      const failed = uploads.find((upload) => upload.status === "rejected" || !upload.value.ok);
      if (failed?.status === "rejected") {
        toast.error(errorMessages.uploadFailed);
      } else if (failed?.status === "fulfilled" && !failed.value.ok) {
        toast.error(errorLabel(failed.value.error, errorMessages));
      }
    } catch {
      toast.error(errorMessages.uploadFailed);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function retryPhoto(taskId: string, operationId: string, file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const prepared = await prepareAndReserveTaskCardPhoto(file, taskId, operationId);
      if (!prepared.ok) {
        toast.error(errorLabel(prepared.error, errorMessages));
        return;
      }
      const result = await uploadReservedTaskCardPhoto(prepared.data);
      if (result.ok) toast.success(t("taskCards.photoOrderSaved"));
      else toast.error(errorLabel(result.error, errorMessages));
    } catch {
      toast.error(errorMessages.uploadFailed);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function cancelPendingPhoto(taskId: string, operationId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await cancelTaskCardPhotoReservation({ taskId, operationId });
      if (!result.ok) {
        toast.error(errorLabel(result.error, errorMessages));
        return;
      }
      if (result.data.status === "attached") toast.success(t("taskCards.photoOrderSaved"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function reorderPhotos(
    taskId: string,
    photos: Photo[],
    fromIndex: number,
    toIndex: number,
  ) {
    if (toIndex < 0 || toIndex >= photos.length || busy) return;
    const reordered = [...photos];
    const [photo] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, photo);
    setBusy(true);
    try {
      const result = await setTaskCardPhotoOrder({
        taskId,
        photoIds: reordered.map((entry) => entry.id),
      });
      if (!result.ok) toast.error(errorLabel(result.error, errorMessages));
      else toast.success(t("taskCards.photoOrderSaved"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  async function deletePhoto(photoId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await removePhoto({ kind: "taskPhoto", id: photoId });
      if (!result.ok) toast.error(t("errors.generic"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  function renderTask(task: TaskCardTask) {
    const pendingForTask = pendingByTask.get(task.id) ?? [];
    const cover = task.photos[0];
    const plannedDate = task.planned_date ?? task.due_date;
    const rule = task.recurrence_rule ? parseRRule(task.recurrence_rule) : null;
    const formatBlock = (block: TaskCardLinkedBlock) => {
      const schedule = formatLinkedBlockDateTime(block, locale);
      return block.occurrence_date
        ? t("taskCards.occurrenceSchedule", {
            occurrenceDate: formatDate(block.occurrence_date as ISODate, "medium", locale),
            schedule,
          })
        : schedule;
    };
    return (
      <article
        key={task.id}
        draggable
        onDragStart={(event) => dragStart(event, task.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dropTaskOnTask(draggedTaskId(event), task.id);
        }}
        className="min-w-0 overflow-hidden rounded-xl border border-border bg-bg-surface shadow-sm"
      >
        {cover?.url ? (
          <div className="relative h-36 bg-bg-subtle sm:h-44">
            <Image
              src={cover.url}
              alt={t("taskCards.photoCover")}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selectedIds.has(task.id)}
              disabled={busy}
              onChange={() => toggleSelected(task.id)}
              aria-label={t("taskCards.selectTask", { title: task.title })}
              className="mt-1 size-5 shrink-0 accent-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDetailTaskId(task.id);
                setEditing(false);
              }}
              className="min-w-0 flex-1 text-left focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <h3
                className={`text-body font-semibold break-words ${task.status === "completed" ? "text-text-muted line-through" : "text-text-primary"}`}
              >
                {task.title}
              </h3>
            </button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-label={t("common.edit")}
              onClick={() => {
                setDetailTaskId(task.id);
                setEditing(true);
              }}
            >
              <Pencil aria-hidden="true" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-caption text-text-secondary">
            <DomainTag domain={task.domain} />
            <span>{t(`inbox.priorities.${task.priority ?? "normal"}`)}</span>
            {task.linkedBlocks.length === 1 ? (
              <span>
                {t("taskCards.scheduledTime")}: {formatBlock(task.linkedBlocks[0])}
              </span>
            ) : task.linkedBlocks.length > 1 ? (
              <details className="basis-full rounded-md border border-border px-2 py-1">
                <summary className="cursor-pointer py-1 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                  {t("taskCards.multipleScheduledBlocks", { count: task.linkedBlocks.length })}
                </summary>
                <ul className="space-y-1 pb-1">
                  {task.linkedBlocks.map((block) => (
                    <li key={block.id}>{formatBlock(block)}</li>
                  ))}
                </ul>
              </details>
            ) : plannedDate ? (
              <span>
                {t("taskCards.plannedDate")}: {formatDate(plannedDate, "medium", locale)}
              </span>
            ) : (
              <span>{t("taskCards.undated")}</span>
            )}
            {task.deadline ? (
              <span>
                {t("taskCards.deadline")}: {formatDate(task.deadline, "medium", locale)}
              </span>
            ) : null}
            {rule ? (
              <span>
                {rule.freq === "DAILY"
                  ? t("tasks.recurrence.badgeDaily")
                  : t("tasks.recurrence.badgeWeekly")}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <ImageIcon aria-hidden="true" className="size-4" />
              {task.photos.length}/{TASK_PHOTO_LIMIT}
            </span>
          </div>
          {task.goal ? (
            <p className="text-small text-text-secondary">
              {t("tasks.meta.goal", { title: task.goal.title })}
            </p>
          ) : null}
          {task.notes ? (
            <p className="line-clamp-3 text-small whitespace-pre-wrap text-text-secondary">
              {task.notes}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-small font-medium focus-within:ring-2 focus-within:ring-brand-500 hover:bg-bg-subtle">
              <Plus aria-hidden="true" />
              <span>{t("taskCards.addPhoto")}</span>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={busy || task.photos.length + pendingForTask.length >= TASK_PHOTO_LIMIT}
                onChange={(event) => {
                  void uploadSelectedPhotos(task, event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setDetailTaskId(task.id);
                setEditing(false);
              }}
            >
              {t("taskCards.taskDetails")}
            </Button>
          </div>
          {task.photos.length ? (
            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-small font-medium text-text-secondary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                {t("taskCards.managePhotos")}
              </summary>
              <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {task.photos.map((photo, index) => (
                  <li key={photo.id} className="min-w-0 rounded-lg border border-border p-2">
                    {photo.url ? (
                      <div className="relative mb-2 aspect-[4/3] overflow-hidden rounded-md bg-bg-subtle">
                        <Image
                          src={photo.url}
                          alt={index === 0 ? t("taskCards.photoCover") : t("taskCards.photos")}
                          fill
                          unoptimized
                          sizes="160px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className="mb-2 aspect-[4/3] rounded-md bg-bg-subtle"
                        aria-label={t("photos.unavailable")}
                      />
                    )}
                    <p className="truncate text-caption text-text-secondary">
                      {index === 0
                        ? t("taskCards.photoCover")
                        : `${index + 1}. ${t("taskCards.photos")}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy || index === 0}
                        aria-label={t("taskCards.movePhotoEarlier")}
                        onClick={() => void reorderPhotos(task.id, task.photos, index, index - 1)}
                      >
                        <ChevronDown className="rotate-180" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy || index === task.photos.length - 1}
                        aria-label={t("taskCards.movePhotoLater")}
                        onClick={() => void reorderPhotos(task.id, task.photos, index, index + 1)}
                      >
                        <ChevronDown aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label={t("photos.remove")}
                        onClick={() => void deletePhoto(photo.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
          {pendingForTask.map((pendingPhoto) => (
            <PendingPhotoControls
              key={pendingPhoto.operation_id}
              reservation={pendingPhoto}
              busy={busy}
              onRetry={(file) => void retryPhoto(task.id, pendingPhoto.operation_id, file)}
              onCancel={() => void cancelPendingPhoto(task.id, pendingPhoto.operation_id)}
              label={t("taskCards.retryPhoto")}
              pendingLabel={t("taskCards.photoPending")}
              failedLabel={t("taskCards.photoFailed")}
              cancelLabel={t("common.cancel")}
            />
          ))}
        </div>
      </article>
    );
  }

  function renderGroup(group: TaskCardGroup) {
    const members = tasks
      .filter((task) => task.task_group_id === group.id)
      .sort(
        (left, right) =>
          left.task_group_position - right.task_group_position || left.id.localeCompare(right.id),
      );
    const collapsed = collapsedIds.has(group.id);
    const selectedInGroup = members
      .filter((task) => selectedIds.has(task.id))
      .map((task) => task.id);
    return (
      <section
        key={group.id}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          dropTaskOnGroup(draggedTaskId(event), group.id);
        }}
        aria-label={t("taskCards.openGroup", { name: group.title })}
        className="rounded-2xl border border-brand-200 bg-brand-50/50 p-3 sm:p-4"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="min-w-0 flex-1 justify-start"
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? t("taskCards.openGroup", { name: group.title })
                : t("taskCards.closeGroup", { name: group.title })
            }
            onClick={() =>
              setCollapsedIds((current) => {
                const next = new Set(current);
                if (next.has(group.id)) next.delete(group.id);
                else next.add(group.id);
                return next;
              })
            }
          >
            {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            <span className="truncate font-semibold">{group.title}</span>
            <span className="text-caption text-text-secondary">
              {t("taskCards.groupTaskCount", { count: members.length })}
            </span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              busy ||
              !groupRecoveryReady ||
              groupStorageUnavailable ||
              Boolean(pendingGroupOperation)
            }
            onClick={() => {
              setRenameGroupId(group.id);
              setRenameGroupTitle(group.title);
            }}
          >
            {t("taskCards.renameGroup")}
          </Button>
          {selectedInGroup.length ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                busy ||
                !groupRecoveryReady ||
                groupStorageUnavailable ||
                Boolean(pendingGroupOperation)
              }
              onClick={() => void applyGroupMutation("remove", group.id, selectedInGroup)}
            >
              {t("taskCards.removeFromGroup")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={
              busy ||
              !groupRecoveryReady ||
              groupStorageUnavailable ||
              Boolean(pendingGroupOperation)
            }
            onClick={() => void applyGroupMutation("dissolve", group.id, [])}
          >
            {t("taskCards.dissolveGroup")}
          </Button>
        </div>
        {!collapsed ? (
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {members.map(renderTask)}
          </div>
        ) : null}
      </section>
    );
  }

  const selectedGroupIds = new Set(
    selectedTasks.flatMap((task) => (task.task_group_id ? [task.task_group_id] : [])),
  );
  const selectedMembers = groupMembers.filter((member) =>
    selectedGroupIds.has(member.task_group_id),
  ).length;

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-xl border border-border bg-bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            {t("taskCards.newTask")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            aria-expanded={groupControlsVisible}
            onClick={() => setGroupControlsOpen((open) => !open)}
          >
            {groupControlsVisible ? (
              <ChevronDown aria-hidden="true" />
            ) : (
              <ChevronRight aria-hidden="true" />
            )}
            {t("taskCards.groupTasks")}
          </Button>
          {groupStorageUnavailable ? (
            <p role="alert" className="text-danger-700 w-full text-small">
              {t("taskCards.groupRetryStorageUnavailable")}
            </p>
          ) : null}
          {pendingGroupOperation ? (
            <>
              <p role="status" className="w-full text-small text-text-secondary">
                {t("taskCards.groupChangeUncertain")}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !groupRecoveryReady || groupStorageUnavailable}
                onClick={() => void retryGroupMutation()}
              >
                {t("taskCards.retryGroupChange")}
              </Button>
            </>
          ) : null}
          <span className="text-caption text-text-secondary">
            {t("taskCards.selectTasks")}: {selectedIds.size}
          </span>
          {selectedMembers > 0 ? (
            <span className="text-caption text-text-secondary">
              {t("taskCards.groupTaskCount", { count: selectedMembers })}
            </span>
          ) : null}
          {lastOperationId ? (
            <Button
              type="button"
              variant="ghost"
              disabled={
                busy ||
                !groupRecoveryReady ||
                groupStorageUnavailable ||
                Boolean(pendingGroupOperation)
              }
              onClick={() => void undoGroupChange()}
            >
              <Undo2 aria-hidden="true" />
              {t("taskCards.undo")}
            </Button>
          ) : null}
        </div>
        {groupControlsVisible ? (
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="min-w-0">
              <span className="mb-1 block text-caption font-medium text-text-secondary">
                {t("taskCards.groupName")}
              </span>
              <input
                disabled={busy}
                className="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-body"
                value={groupTitle}
                onChange={(event) => setGroupTitle(event.target.value)}
                maxLength={80}
              />
            </label>
            <Button
              type="button"
              disabled={
                busy ||
                !groupRecoveryReady ||
                groupStorageUnavailable ||
                Boolean(pendingGroupOperation) ||
                selectedTasks.length < 2 ||
                !groupTitle.trim()
              }
              onClick={() =>
                void applyGroupMutation(
                  "create",
                  null,
                  selectedTasks.map((task) => task.id),
                  groupTitle.trim(),
                )
              }
            >
              {t("taskCards.createGroup")}
            </Button>
            <label className="min-w-0">
              <span className="mb-1 block text-caption font-medium text-text-secondary">
                {t("taskCards.selectGroupTarget")}
              </span>
              <select
                disabled={busy}
                className="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-body"
                value={targetGroupId}
                onChange={(event) => setTargetGroupId(event.target.value)}
              >
                <option value="">{t("taskCards.selectGroupTarget")}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={
                busy ||
                !groupRecoveryReady ||
                groupStorageUnavailable ||
                Boolean(pendingGroupOperation) ||
                !targetGroupId ||
                selectedTasks.length === 0
              }
              onClick={() => void addSelectedToGroup(targetGroupId)}
            >
              {t("taskCards.addToGroup")}
            </Button>
          </div>
        ) : null}
      </section>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-border bg-bg-surface p-4 text-small text-text-secondary">
          {t("taskCards.noTasks")}
        </p>
      ) : null}
      {visibleGroups.map(renderGroup)}
      {ungroupedTasks.length ? (
        <section aria-label={t("taskCards.ungrouped")}>
          <h2 className="mb-2 text-h2 text-text-primary">{t("taskCards.ungrouped")}</h2>
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ungroupedTasks.map(renderTask)}
          </div>
        </section>
      ) : null}

      <ResponsiveDialog
        open={detailTask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTaskId(null);
            setEditing(false);
          }
        }}
        title={editing ? t("tasks.edit") : (detailTask?.title ?? t("taskCards.taskDetails"))}
      >
        {detailTask && editing ? (
          <TaskForm
            mode="edit"
            taskId={detailTask.id}
            initial={{
              title: detailTask.title,
              dueDate: detailTask.due_date ?? today,
              plannedDate: detailTask.planned_date ?? detailTask.due_date ?? today,
              deadline: detailTask.deadline,
              domain: detailTask.domain,
              recurrence: detailRule ? (detailRule.freq === "DAILY" ? "daily" : "weekly") : "none",
              weekdays: detailRule?.freq === "WEEKLY" ? detailRule.byDay : [],
              goalId: detailTask.goal_id,
              projectId: detailTask.project_id ?? null,
              priority: detailTask.priority ?? "normal",
              estimatedMinutes: detailTask.estimated_minutes ?? null,
              notes: detailTask.notes ?? null,
            }}
            goalOptions={goalOptions}
            projectOptions={projectOptions}
            existingPhotoCount={detailTask.photos.length}
            onDone={() => {
              setDetailTaskId(null);
              setEditing(false);
            }}
          />
        ) : detailTask ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-text-secondary">{t("taskCards.plannedDate")}</dt>
                <dd className="text-body">
                  {(detailTask.planned_date ?? detailTask.due_date)
                    ? formatDate(
                        (detailTask.planned_date ?? detailTask.due_date)!,
                        "medium",
                        locale,
                      )
                    : t("taskCards.undated")}
                </dd>
              </div>
              <div>
                <dt className="text-caption text-text-secondary">{t("taskCards.deadline")}</dt>
                <dd className="text-body">
                  {detailTask.deadline
                    ? formatDate(detailTask.deadline, "medium", locale)
                    : t("tasks.library.noDeadline")}
                </dd>
              </div>
            </dl>
            {detailTask.linkedBlocks.length ? (
              <section aria-labelledby="task-scheduled-blocks-title" className="space-y-2">
                <h3
                  id="task-scheduled-blocks-title"
                  className="text-caption font-semibold text-text-secondary"
                >
                  {t("taskCards.scheduledTime")}
                </h3>
                <ul className="space-y-2">
                  {detailTask.linkedBlocks.map((block) => (
                    <li
                      key={block.id}
                      className="rounded-md border border-border px-3 py-2 text-small text-text-primary"
                    >
                      {block.occurrence_date
                        ? t("taskCards.occurrenceSchedule", {
                            occurrenceDate: formatDate(
                              block.occurrence_date as ISODate,
                              "medium",
                              locale,
                            ),
                            schedule: formatLinkedBlockDateTime(block, locale),
                          })
                        : formatLinkedBlockDateTime(block, locale)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {detailTask.notes ? (
              <p className="text-small whitespace-pre-wrap text-text-secondary">
                {detailTask.notes}
              </p>
            ) : null}
            <Button type="button" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              {t("common.edit")}
            </Button>
          </div>
        ) : null}
      </ResponsiveDialog>

      <ResponsiveDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("taskCards.newTask")}
      >
        <TaskForm
          mode="create"
          initial={{ dueDate: today, plannedDate: today, recurrence: "none" }}
          goalOptions={goalOptions}
          projectOptions={projectOptions}
          onDone={() => setCreateOpen(false)}
        />
      </ResponsiveDialog>

      <ResponsiveDialog
        open={renameGroupId !== null}
        onOpenChange={(open) => {
          if (!open) setRenameGroupId(null);
        }}
        title={t("taskCards.renameGroup")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (renameGroupId && renameGroupTitle.trim()) {
              void applyGroupMutation("rename", renameGroupId, [], renameGroupTitle.trim());
              setRenameGroupId(null);
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-caption font-medium text-text-secondary">
              {t("taskCards.groupName")}
            </span>
            <input
              disabled={busy}
              className="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-body"
              value={renameGroupTitle}
              onChange={(event) => setRenameGroupTitle(event.target.value)}
              maxLength={80}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRenameGroupId(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy || !renameGroupTitle.trim()}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

function PendingPhotoControls({
  reservation,
  busy,
  onRetry,
  onCancel,
  label,
  pendingLabel,
  failedLabel,
  cancelLabel,
}: {
  reservation: TaskCardPendingPhoto;
  busy: boolean;
  onRetry: (file: File | undefined) => void;
  onCancel: () => void;
  label: string;
  pendingLabel: string;
  failedLabel: string;
  cancelLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const text = reservation.status === "failed" ? failedLabel : pendingLabel;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-bg-subtle p-2">
      <span className="min-w-0 flex-1 text-small text-text-secondary">{text}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(event) => {
          onRetry(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
        aria-label={label}
      />
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  );
}
