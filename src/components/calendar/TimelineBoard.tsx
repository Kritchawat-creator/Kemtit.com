"use client";

import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";

import { scheduleTaskCard, undoTaskCardSchedule } from "@/core/tasks/card-actions";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  scheduleTaskCardSchema,
  undoTaskCardScheduleSchema,
  type ScheduleTaskCardInput,
} from "@/core/tasks/card-schema";
import type { TaskCardTask } from "@/core/tasks/card-queries";
import type { AppLocale } from "@/i18n/config";
import { addDaysISO, APP_TIME_ZONE, isISODate, type ISODate } from "@/lib/date";
import { formatDate, formatWeekdayNarrow } from "@/lib/format";

const MINUTES_PER_DAY = 24 * 60;
const HOUR_HEIGHT = 60;
const DRAG_TYPE = "text/plain";

type LinkedBlock = {
  id: string;
  version: number;
  startAt: string;
  endAt: string;
  isLocked: boolean;
};

export type TimelineBoardItem = {
  key: string;
  task: Pick<
    TaskCardTask,
    | "id"
    | "title"
    | "domain"
    | "priority"
    | "due_date"
    | "planned_date"
    | "updated_at"
    | "recurrence_rule"
    | "estimated_minutes"
    | "photos"
  > & { task_group_id: string | null; task_group_position: number };
  scheduledDate?: ISODate | null;
  occurrenceDate: ISODate | null;
  occurrenceUpdatedAt: string | null;
  done: boolean;
  skipped: boolean;
  /** Complete active linked-block snapshot for this task or exact occurrence. */
  linkedBlocks: LinkedBlock[];
};

export type TimelineBoardBlock = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  version: number;
  isLocked: boolean;
  taskId: string | null;
  occurrenceDate: ISODate | null;
};

export type TimelineBoardBusyItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
};

export type TimelineBoardGroup = { id: string; title: string; position: number };

type Props = {
  userId: string;
  date: ISODate;
  items: TimelineBoardItem[];
  groups: TimelineBoardGroup[];
  hasMoreTasks?: boolean;
  blocks: TimelineBoardBlock[];
  busyItems?: TimelineBoardBusyItem[];
};

type Composer = {
  itemKey: string;
  targetDate: ISODate;
  startTime: string;
  endTime: string;
  dayOnly: boolean;
  blockId: string | null;
  intent: "schedule" | "move" | "resize";
};

type PendingScheduleMutation = {
  kind: "schedule";
  userId: string;
  boardDate: ISODate;
  itemKey: string;
  input: ScheduleTaskCardInput;
};

type PendingUndoMutation = {
  kind: "undo";
  userId: string;
  boardDate: ISODate;
  operationId: string;
};

type PendingMutation = PendingScheduleMutation | PendingUndoMutation;
type UndoableSchedule = {
  userId: string;
  boardDate: ISODate;
  operationId: string;
};

type DragMode = "move" | "resize";
type DragPayload = { itemKey: string; blockId: string | null; mode: DragMode };
type ActiveDropPreview = DragPayload & {
  targetDate: ISODate;
  dayOnly: boolean;
  startMinute: number;
  duration: number;
};
type TouchDrag = DragPayload & { pointerId: number };
type TouchCandidate = TouchDrag & { startX: number; startY: number; timer: number };
const SESSION_STORAGE_UNAVAILABLE = "__session_storage_unavailable__";
const SESSION_STORAGE_EVENT = "kemtit:session-storage-change";

export function TimelineBoard({
  userId,
  date,
  items,
  groups,
  hasMoreTasks = false,
  blocks,
  busyItems = [],
}: Props) {
  const t = useTranslations();
  const cards = useTranslations("taskCards");
  const calendar = useTranslations("calendar");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [composer, setComposer] = useState<Composer | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropPreview, setDropPreview] = useState<ActiveDropPreview | null>(null);
  const [dayDropPreview, setDayDropPreview] = useState<ISODate | null>(null);
  const [touchDrag, setTouchDrag] = useState<TouchDrag | null>(null);
  const [trayFilter, setTrayFilter] = useState<"unscheduled" | "all">("unscheduled");
  const [retryStorageUnavailable, setRetryStorageUnavailable] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [nowTimestamp, setNowTimestamp] = useState<number | null>(null);
  const [livePendingMutation, setLivePendingMutation] = useState<PendingMutation | null>(null);
  const [undoableSchedule, setUndoableSchedule] = useState<UndoableSchedule | null>(null);
  const mutationPendingRef = useRef(false);
  const draggedPayloadRef = useRef<DragPayload | null>(null);
  const dropPreviewRef = useRef<ActiveDropPreview | null>(null);
  const touchCandidateRef = useRef<TouchCandidate | null>(null);
  const touchDragRef = useRef<TouchDrag | null>(null);
  const acceptedDropRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const timelineGridRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const composerDateRef = useRef<HTMLInputElement | null>(null);
  const composerFocusReturnRef = useRef<HTMLElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const touchActionsRef = useRef<{
    handleDayDrop: (item: TimelineBoardItem, preview: ActiveDropPreview) => void;
    handleTimeDrop: (item: TimelineBoardItem, preview: ActiveDropPreview) => void;
    cancelDrag: () => void;
  }>({ handleDayDrop: () => {}, handleTimeDrop: () => {}, cancelDrag: () => {} });
  const storageKey = `kemtit:calendar-schedule:${userId}:${date}`;
  const pendingSnapshot = useSyncExternalStore(
    (onStoreChange) => subscribeToSessionStorage(storageKey, onStoreChange),
    () => readSessionStorage(storageKey),
    () => "",
  );
  const storedPendingMutation =
    pendingSnapshot && pendingSnapshot !== SESSION_STORAGE_UNAVAILABLE
      ? parsePendingMutation(pendingSnapshot, userId, date)
      : null;
  const pendingMutation =
    livePendingMutation?.userId === userId && livePendingMutation.boardDate === date
      ? livePendingMutation
      : storedPendingMutation;
  const activeUndoableSchedule =
    undoableSchedule?.userId === userId && undoableSchedule.boardDate === date
      ? undoableSchedule
      : null;
  const selectedDayIsToday =
    nowTimestamp !== null &&
    formatInTimeZone(new Date(nowTimestamp), APP_TIME_ZONE, "yyyy-MM-dd") === date;
  const nowClock =
    selectedDayIsToday && nowTimestamp !== null
      ? formatInTimeZone(new Date(nowTimestamp), APP_TIME_ZONE, "H:mm")
      : null;
  const nowMinute = nowClock ? parseClock(nowClock) : null;
  const nowLabel = nowClock ? calendar("nowAt", { time: nowClock }) : null;

  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);
  const unscheduledItems = items.filter(
    (item) => !item.done && !item.skipped && item.linkedBlocks.length === 0,
  );
  const trayItems =
    trayFilter === "all" ? items.filter((item) => !item.done && !item.skipped) : unscheduledItems;
  const visibleGroupIds = new Set(
    trayItems.flatMap((item) => (item.task.task_group_id ? [item.task.task_group_id] : [])),
  );
  const visibleGroups = [...groups]
    .filter((group) => visibleGroupIds.has(group.id))
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  const ungroupedItems = trayItems
    .filter((item) => !item.task.task_group_id)
    .sort((left, right) => left.task.task_group_position - right.task.task_group_position);

  function itemsForGroup(groupId: string) {
    return trayItems
      .filter((item) => item.task.task_group_id === groupId)
      .sort((left, right) => left.task.task_group_position - right.task.task_group_position);
  }

  useEffect(() => {
    touchDragRef.current = touchDrag;
    if (touchDrag === null) return;
    const activeTouchDrag: TouchDrag = touchDrag;

    function onPointerMove(event: PointerEvent) {
      if (event.pointerId !== activeTouchDrag.pointerId) return;
      event.preventDefault();
      autoscrollNearViewportEdge(event.clientY);
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const dayTarget = target?.closest<HTMLElement>("[data-day-drop-date]");
      if (dayTarget?.dataset.dayDropDate && isBoardDate(dayTarget.dataset.dayDropDate)) {
        const targetDate = dayTarget.dataset.dayDropDate;
        const item = itemByKey.get(activeTouchDrag.itemKey);
        if (!item || item.done || item.skipped) return;
        const preview: ActiveDropPreview = {
          ...activeTouchDrag,
          targetDate,
          dayOnly: true,
          startMinute: 0,
          duration: 0,
        };
        updateDropPreview(preview);
        setDayDropPreview(targetDate);
        return;
      }
      const grid = target?.closest<HTMLElement>("[data-timeline-grid]");
      if (!grid) {
        updateDropPreview(null);
        setDayDropPreview(null);
        return;
      }
      const item = itemByKey.get(activeTouchDrag.itemKey);
      if (!item || item.done || item.skipped) return;
      const minute = minuteAtClientY(event.clientY, grid);
      const preview = previewForDrop(item, activeTouchDrag, date, minute);
      updateDropPreview(preview);
      setDayDropPreview(null);
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerId !== activeTouchDrag.pointerId) return;
      const preview = dropPreviewRef.current;
      const item = itemByKey.get(activeTouchDrag.itemKey);
      if (preview && item && !item.done && !item.skipped) {
        if (preview.dayOnly) touchActionsRef.current.handleDayDrop(item, preview);
        else touchActionsRef.current.handleTimeDrop(item, preview);
      } else {
        setStatusMessage(cards("dragCancelled"));
      }
      clearTouchCandidate();
      touchDragRef.current = null;
      setTouchDrag(null);
      draggedPayloadRef.current = null;
      acceptedDropRef.current = true;
      updateDropPreview(null);
      setDayDropPreview(null);
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 500);
    }

    function onPointerCancel(event: PointerEvent) {
      if (event.pointerId !== activeTouchDrag.pointerId) return;
      touchActionsRef.current.cancelDrag();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [cards, date, itemByKey, touchDrag]);

  useEffect(() => {
    const updateNow = () => setNowTimestamp(Date.now());
    const initialUpdate = window.setTimeout(updateNow, 0);
    const interval = window.setInterval(updateNow, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (hasAutoScrolledRef.current) return;
    hasAutoScrolledRef.current = true;
    const scrollTimer = window.setTimeout(() => {
      const scrollRegion = timelineScrollRef.current;
      if (!scrollRegion) return;
      const now = new Date();
      const isToday = formatInTimeZone(now, APP_TIME_ZONE, "yyyy-MM-dd") === date;
      const firstScheduledMinute = [...blocks, ...busyItems]
        .map((item) => minutesInBangkok(item.startAt))
        .sort((left, right) => left - right)[0];
      const targetMinute = isToday
        ? minutesInBangkok(now.toISOString())
        : (firstScheduledMinute ?? 9 * 60);
      const visibleOffset = Math.min(180, Math.max(80, scrollRegion.clientHeight * 0.35));
      scrollRegion.scrollTop = Math.max(0, targetMinute - visibleOffset);
    }, 0);
    return () => window.clearTimeout(scrollTimer);
  }, [blocks, busyItems, date]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (composer || (!dropPreviewRef.current && !touchCandidateRef.current)) return;
      event.preventDefault();
      touchActionsRef.current.cancelDrag();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composer]);

  useEffect(() => {
    function cancelUnactivatedTouchDrag(event: PointerEvent) {
      const candidate = touchCandidateRef.current;
      if (!candidate || candidate.pointerId !== event.pointerId || touchDragRef.current) return;
      if (Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY) > 10) {
        clearTouchCandidate();
      }
    }
    function finishUnactivatedTouchDrag(event: PointerEvent) {
      const candidate = touchCandidateRef.current;
      if (!candidate || candidate.pointerId !== event.pointerId || touchDragRef.current) return;
      clearTouchCandidate();
    }
    window.addEventListener("pointermove", cancelUnactivatedTouchDrag);
    window.addEventListener("pointerup", finishUnactivatedTouchDrag);
    window.addEventListener("pointercancel", finishUnactivatedTouchDrag);
    return () => {
      window.removeEventListener("pointermove", cancelUnactivatedTouchDrag);
      window.removeEventListener("pointerup", finishUnactivatedTouchDrag);
      window.removeEventListener("pointercancel", finishUnactivatedTouchDrag);
    };
  }, []);

  function rememberComposerFocus() {
    const activeElement = document.activeElement;
    composerFocusReturnRef.current = activeElement instanceof HTMLElement ? activeElement : null;
  }

  function openTaskComposer(item: TimelineBoardItem) {
    rememberComposerFocus();
    setStatusMessage("");
    setComposer({
      itemKey: item.key,
      targetDate: date,
      startTime: "",
      endTime: "",
      dayOnly: true,
      blockId: null,
      intent: "schedule",
    });
  }

  function openBlockComposer(
    item: TimelineBoardItem,
    block: TimelineBoardBlock,
    intent: "move" | "resize" = "move",
  ) {
    const linkedBlock = item.linkedBlocks.find((candidate) => candidate.id === block.id);
    if (!linkedBlock || linkedBlock.isLocked) return;
    rememberComposerFocus();
    const startMinutes = minutesInBangkok(linkedBlock.startAt);
    const duration = Math.max(
      1,
      Math.round((Date.parse(linkedBlock.endAt) - Date.parse(linkedBlock.startAt)) / 60_000),
    );
    setStatusMessage("");
    setComposer({
      itemKey: item.key,
      targetDate: date,
      startTime: formatClock(startMinutes),
      endTime: formatClock(startMinutes + duration),
      dayOnly: false,
      blockId: linkedBlock.id,
      intent,
    });
  }

  function startTaskDrag(
    event: DragEvent<HTMLElement>,
    itemKey: string,
    blockId: string | null = null,
    mode: DragMode = "move",
  ) {
    draggedPayloadRef.current = { itemKey, blockId, mode };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({ itemKey, blockId, mode } satisfies DragPayload),
    );
    acceptedDropRef.current = false;
    setStatusMessage("");
  }

  function endTaskDrag() {
    if (draggedPayloadRef.current && !acceptedDropRef.current) {
      setStatusMessage(cards("dragCancelled"));
    }
    acceptedDropRef.current = false;
    draggedPayloadRef.current = null;
    updateDropPreview(null);
    setDayDropPreview(null);
  }

  function beginTouchDrag(
    event: ReactPointerEvent<HTMLElement>,
    itemKey: string,
    blockId: string | null,
    mode: DragMode,
  ) {
    if (event.pointerType !== "touch" || busy || hasCurrentPendingMutation()) return;
    const item = itemByKey.get(itemKey);
    if (!item || item.done || item.skipped || item.linkedBlocks.some((block) => block.isLocked))
      return;
    clearTouchCandidate();
    const candidate = {
      itemKey,
      blockId,
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      timer: 0,
    } satisfies TouchCandidate;
    candidate.timer = window.setTimeout(() => {
      if (touchCandidateRef.current !== candidate) return;
      const drag: TouchDrag = {
        itemKey: candidate.itemKey,
        blockId: candidate.blockId,
        mode: candidate.mode,
        pointerId: candidate.pointerId,
      };
      touchDragRef.current = drag;
      suppressNextClickRef.current = true;
      setTouchDrag(drag);
      setStatusMessage(cards("dragHandle"));
    }, 550);
    touchCandidateRef.current = candidate;
  }

  function clearTouchCandidate() {
    const candidate = touchCandidateRef.current;
    if (candidate) window.clearTimeout(candidate.timer);
    touchCandidateRef.current = null;
  }

  function cancelDrag() {
    clearTouchCandidate();
    touchDragRef.current = null;
    setTouchDrag(null);
    draggedPayloadRef.current = null;
    acceptedDropRef.current = false;
    updateDropPreview(null);
    setDayDropPreview(null);
    setStatusMessage(cards("dragCancelled"));
  }

  function updateDropPreview(preview: ActiveDropPreview | null) {
    dropPreviewRef.current = preview;
    setDropPreview(preview);
  }

  function minuteAtClientY(clientY: number, grid: HTMLElement) {
    const bounds = grid.getBoundingClientRect();
    const offset = Math.max(0, Math.min(bounds.height, clientY - bounds.top));
    return Math.min(
      MINUTES_PER_DAY - 1,
      Math.round(((offset / Math.max(bounds.height, 1)) * MINUTES_PER_DAY) / 15) * 15,
    );
  }

  function autoscrollNearViewportEdge(clientY: number) {
    const edge = 72;
    const scrollRegion = timelineScrollRef.current;
    const bounds = scrollRegion?.getBoundingClientRect();
    if (scrollRegion && bounds && clientY >= bounds.top && clientY <= bounds.bottom) {
      if (clientY < bounds.top + edge) scrollRegion.scrollBy({ top: -14, behavior: "auto" });
      else if (clientY > bounds.bottom - edge) scrollRegion.scrollBy({ top: 14, behavior: "auto" });
      if (clientY < edge) window.scrollBy({ top: -14, behavior: "auto" });
      else if (clientY > window.innerHeight - edge) window.scrollBy({ top: 14, behavior: "auto" });
      return;
    }
    if (clientY < edge) window.scrollBy({ top: -14, behavior: "auto" });
    else if (clientY > window.innerHeight - edge) window.scrollBy({ top: 14, behavior: "auto" });
  }

  function previewTimelineDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    autoscrollNearViewportEdge(event.clientY);
    const payload = draggedPayloadRef.current;
    const item = payload ? itemByKey.get(payload.itemKey) : null;
    if (!payload || !item || item.done || item.skipped) {
      updateDropPreview(null);
      return;
    }
    const block = payload.blockId
      ? item.linkedBlocks.find((candidate) => candidate.id === payload.blockId)
      : null;
    if (block?.isLocked) {
      updateDropPreview(null);
      return;
    }
    updateDropPreview(previewForDrop(item, payload, date, minuteAtPointer(event)));
    setDayDropPreview(null);
  }

  function dropOnTimeline(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (hasCurrentPendingMutation()) {
      endTaskDrag();
      return;
    }
    const payload =
      parseDragPayload(event.dataTransfer.getData(DRAG_TYPE)) ?? draggedPayloadRef.current;
    const item = payload ? itemByKey.get(payload.itemKey) : null;
    if (!payload || !item || item.done || item.skipped) {
      endTaskDrag();
      return;
    }
    const block = payload.blockId
      ? (item.linkedBlocks.find((candidate) => candidate.id === payload.blockId) ?? null)
      : null;
    if (item.linkedBlocks.some((candidate) => candidate.isLocked) || block?.isLocked) {
      endTaskDrag();
      return;
    }

    const dropMinute = minuteAtPointer(event);
    const preview = previewForDrop(
      item,
      { ...payload, blockId: block?.id ?? null },
      date,
      dropMinute,
    );
    handleTimeDrop(item, preview);
    acceptedDropRef.current = true;
    endTaskDrag();
  }

  function minuteAtPointer(event: DragEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const clientY = Number.isFinite(event.clientY) ? event.clientY : bounds.top;
    return minuteAtClientY(clientY, event.currentTarget);
  }

  function previewForDrop(
    item: TimelineBoardItem,
    payload: DragPayload,
    targetDate: ISODate,
    pointerMinute: number,
  ): ActiveDropPreview {
    const selectedBlock = payload.blockId
      ? item.linkedBlocks.find((block) => block.id === payload.blockId)
      : null;
    if (payload.mode === "resize" && selectedBlock) {
      const startMinute = minutesInBangkok(selectedBlock.startAt);
      const snappedEnd =
        pointerMinute >= MINUTES_PER_DAY - 8
          ? MINUTES_PER_DAY
          : Math.floor(pointerMinute / 15) * 15;
      const endMinute = Math.max(startMinute + 15, snappedEnd);
      return {
        ...payload,
        targetDate,
        dayOnly: false,
        startMinute,
        duration: endMinute - startMinute,
      };
    }
    const duration = durationForItem(
      item,
      selectedBlock?.id ?? (item.linkedBlocks.length === 1 ? item.linkedBlocks[0].id : null),
    );
    const startMinute = Math.floor(pointerMinute / 15) * 15;
    return { ...payload, targetDate, dayOnly: false, startMinute, duration };
  }

  function previewDateDrop(event: DragEvent<HTMLButtonElement>, targetDate: ISODate) {
    event.preventDefault();
    const payload = draggedPayloadRef.current;
    const item = payload ? itemByKey.get(payload.itemKey) : null;
    if (
      !payload ||
      !item ||
      item.done ||
      item.skipped ||
      item.linkedBlocks.some((block) => block.isLocked)
    )
      return;
    updateDropPreview({ ...payload, targetDate, dayOnly: true, startMinute: 0, duration: 0 });
    setDayDropPreview(targetDate);
  }

  function dropOnDate(event: DragEvent<HTMLButtonElement>, targetDate: ISODate) {
    event.preventDefault();
    if (hasCurrentPendingMutation()) return;
    const payload =
      parseDragPayload(event.dataTransfer.getData(DRAG_TYPE)) ?? draggedPayloadRef.current;
    const item = payload ? itemByKey.get(payload.itemKey) : null;
    if (
      !payload ||
      !item ||
      item.done ||
      item.skipped ||
      item.linkedBlocks.some((block) => block.isLocked)
    ) {
      endTaskDrag();
      return;
    }
    handleDayDrop(item, { ...payload, targetDate, dayOnly: true, startMinute: 0, duration: 0 });
    acceptedDropRef.current = true;
    endTaskDrag();
  }

  function handleDayDrop(item: TimelineBoardItem, preview: ActiveDropPreview) {
    if (item.linkedBlocks.some((block) => block.isLocked)) return;
    const dayComposer: Composer = {
      itemKey: item.key,
      targetDate: preview.targetDate,
      startTime: "",
      endTime: "",
      dayOnly: true,
      blockId: null,
      intent: "move",
    };
    if (item.linkedBlocks.length > 1) {
      rememberComposerFocus();
      setComposer(dayComposer);
      setStatusMessage("");
      return;
    }
    void runScheduleMutation(makeScheduleRequest(item, dayComposer), false);
  }

  function handleTimeDrop(item: TimelineBoardItem, preview: ActiveDropPreview) {
    if (item.linkedBlocks.some((block) => block.isLocked)) return;
    const endMinute = preview.startMinute + preview.duration;
    if (endMinute >= MINUTES_PER_DAY) {
      setStatusMessage(cards("sameDayTimeBlockOnly"));
      return;
    }
    const selectedBlockId =
      preview.blockId ?? (item.linkedBlocks.length === 1 ? item.linkedBlocks[0].id : null);
    const timeComposer: Composer = {
      itemKey: item.key,
      targetDate: preview.targetDate,
      startTime: formatClock(preview.startMinute),
      endTime: formatClock(endMinute),
      dayOnly: false,
      blockId: selectedBlockId,
      intent: preview.mode === "resize" ? "resize" : "move",
    };
    if (item.linkedBlocks.length > 1) {
      rememberComposerFocus();
      setComposer(timeComposer);
      setStatusMessage("");
      return;
    }
    void runScheduleMutation(makeScheduleRequest(item, timeComposer), false);
  }

  function updateComposer(values: Partial<Composer>) {
    setComposer((current) => (current ? { ...current, ...values } : current));
  }

  async function confirmSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!composer || hasCurrentPendingMutation() || mutationPendingRef.current) return;
    const item = itemByKey.get(composer.itemKey);
    if (!item || item.done || item.skipped) return;
    if (!composer.dayOnly && (!composer.startTime || !composer.endTime)) return;
    if (!composer.dayOnly && composer.endTime <= composer.startTime) {
      setStatusMessage(cards("sameDayTimeBlockOnly"));
      return;
    }
    if (!composer.dayOnly && item.linkedBlocks.length > 0 && !composer.blockId) return;

    await runScheduleMutation(makeScheduleRequest(item, composer), false);
  }

  function makeScheduleRequest(item: TimelineBoardItem, next: Composer): PendingScheduleMutation {
    const startAt = next.dayOnly ? null : toTimestamp(next.targetDate, next.startTime);
    const endAt = next.dayOnly ? null : toTimestamp(next.targetDate, next.endTime);
    const input: ScheduleTaskCardInput = {
      operationId: crypto.randomUUID(),
      taskId: item.task.id,
      taskUpdatedAt: item.task.updated_at,
      occurrenceDate: item.occurrenceDate,
      occurrenceUpdatedAt: item.occurrenceUpdatedAt,
      targetDate: next.targetDate,
      startAt,
      endAt,
      blockId: next.dayOnly ? null : next.blockId,
      blocks: item.linkedBlocks.map(({ id, version, startAt: blockStart, endAt: blockEnd }) => ({
        id,
        version,
        startAt: blockStart,
        endAt: blockEnd,
      })),
    };
    return { kind: "schedule", userId, boardDate: date, itemKey: item.key, input };
  }

  async function runScheduleMutation(request: PendingScheduleMutation, isRetry: boolean) {
    if (
      request.userId !== userId ||
      request.boardDate !== date ||
      mutationPendingRef.current ||
      (pendingMutation && !isRetry)
    )
      return;
    if (!isRetry && !storePendingMutation(request, storageKey)) {
      setRetryStorageUnavailable(true);
      setStatusMessage(cards("scheduleRetryStorageUnavailable"));
      return;
    }
    setLivePendingMutation(request);
    mutationPendingRef.current = true;
    setBusy(true);
    setStatusMessage("");
    try {
      const result = await scheduleTaskCard(request.input);
      if (!result.ok) {
        if (isUncertainError(result.error)) {
          retainPendingMutation(request);
          setStatusMessage(cards("scheduleChangeUncertain"));
        } else {
          clearPendingMutation(storageKey);
          setStatusMessage(
            scheduleErrorMessage(
              result.error,
              cards("deadlineConflict"),
              cards("lockedBlock"),
              cards("scheduleConflict"),
              cards("calendarEventConflict"),
              t("errors.generic"),
            ),
          );
          toast.error(
            scheduleErrorMessage(
              result.error,
              cards("deadlineConflict"),
              cards("lockedBlock"),
              cards("scheduleConflict"),
              cards("calendarEventConflict"),
              t("errors.generic"),
            ),
          );
          router.refresh();
        }
        return;
      }
      clearPendingMutation(storageKey);
      setComposer(null);
      if (result.data.undone) {
        clearUndoableSchedule(result.data.operationId);
        setStatusMessage(cards("scheduleAlreadyUndone"));
        toast(cards("scheduleAlreadyUndone"));
        router.refresh();
        return;
      }
      setStatusMessage(cards("scheduleSaved"));
      if (result.data.canUndo) {
        setUndoableSchedule({
          userId,
          boardDate: date,
          operationId: result.data.operationId,
        });
        toast.success(cards("scheduleSaved"));
      } else {
        clearUndoableSchedule(result.data.operationId);
        toast.success(cards("scheduleSaved"));
      }
      router.refresh();
    } catch {
      retainPendingMutation(request);
      setStatusMessage(cards("scheduleChangeUncertain"));
    } finally {
      mutationPendingRef.current = false;
      setBusy(false);
    }
  }

  async function runUndoMutation(request: PendingUndoMutation, isRetry: boolean) {
    if (
      request.userId !== userId ||
      request.boardDate !== date ||
      mutationPendingRef.current ||
      (pendingMutation && !isRetry)
    )
      return;
    if (!isRetry && !storePendingMutation(request, storageKey)) {
      setRetryStorageUnavailable(true);
      setStatusMessage(cards("scheduleRetryStorageUnavailable"));
      return;
    }
    setLivePendingMutation(request);
    mutationPendingRef.current = true;
    setBusy(true);
    setStatusMessage("");
    try {
      const result = await undoTaskCardSchedule({ operationId: request.operationId });
      if (!result.ok) {
        if (isUncertainError(result.error)) {
          retainPendingMutation(request);
          setStatusMessage(cards("scheduleChangeUncertain"));
        } else {
          clearPendingMutation(storageKey);
          clearUndoableSchedule(request.operationId);
          setStatusMessage(
            scheduleErrorMessage(
              result.error,
              cards("deadlineConflict"),
              cards("lockedBlock"),
              cards("scheduleConflict"),
              cards("calendarEventConflict"),
              t("errors.generic"),
            ),
          );
          toast.error(
            scheduleErrorMessage(
              result.error,
              cards("deadlineConflict"),
              cards("lockedBlock"),
              cards("scheduleConflict"),
              cards("calendarEventConflict"),
              t("errors.generic"),
            ),
          );
          router.refresh();
        }
        return;
      }
      clearPendingMutation(storageKey);
      clearUndoableSchedule(request.operationId);
      setStatusMessage(cards("scheduleSaved"));
      toast.success(cards("undo"));
      router.refresh();
    } catch {
      retainPendingMutation(request);
      setStatusMessage(cards("scheduleChangeUncertain"));
    } finally {
      mutationPendingRef.current = false;
      setBusy(false);
    }
  }

  async function retryPendingMutation() {
    const request = pendingMutation;
    if (!request || request.userId !== userId || request.boardDate !== date) return;
    if (request.kind === "schedule") await runScheduleMutation(request, true);
    else await runUndoMutation(request, true);
  }

  function retainPendingMutation(request: PendingMutation) {
    setLivePendingMutation(request);
  }

  function clearUndoableSchedule(operationId: string) {
    setUndoableSchedule((current) => (current?.operationId === operationId ? null : current));
  }

  function clearPendingMutation(key: string) {
    try {
      window.sessionStorage.removeItem(key);
      dispatchSessionStorageChange(key);
    } catch {
      // Replaying the same operation remains safe if storage cannot be cleared.
    }
    setLivePendingMutation(null);
  }

  function hasCurrentPendingMutation() {
    return Boolean(pendingMutation);
  }

  const selectedItem = composer ? itemByKey.get(composer.itemKey) : null;
  const activePendingMutation = pendingMutation;
  const selectedBlocks = selectedItem?.linkedBlocks ?? [];
  const timedSelectionNeedsBlock = Boolean(
    composer && !composer.dayOnly && selectedBlocks.length > 0 && !composer.blockId,
  );
  const storageUnavailable =
    retryStorageUnavailable || pendingSnapshot === SESSION_STORAGE_UNAVAILABLE;
  const invalidTimedRange = Boolean(
    composer &&
    !composer.dayOnly &&
    composer.startTime &&
    composer.endTime &&
    composer.endTime <= composer.startTime,
  );
  const weekDates = useMemo(() => {
    const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const start = addDaysISO(date, -dayOfWeek);
    return Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
  }, [date]);

  function navigateToDay(targetDate: ISODate) {
    const search = new URLSearchParams(window.location.search);
    if (!new Set(["day", "week", "month"]).has(search.get("view") ?? "")) {
      search.set("view", "day");
    }
    search.set("date", targetDate);
    router.push(`/calendar?${search.toString()}`);
  }

  touchActionsRef.current = { handleDayDrop, handleTimeDrop, cancelDrag };

  function renderTrayItem(item: TimelineBoardItem) {
    return (
      <li key={item.key}>
        <article className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-border p-3">
          <button
            type="button"
            draggable={!busy && !activePendingMutation}
            disabled={busy || Boolean(activePendingMutation)}
            aria-label={`${cards("dragHandle")}: ${item.task.title}`}
            title={cards("dragHandle")}
            onDragStart={(event) => startTaskDrag(event, item.key)}
            onDragEnd={endTaskDrag}
            onPointerDown={(event) => beginTouchDrag(event, item.key, null, "move")}
            className="min-h-11 min-w-11 shrink-0 self-start touch-none rounded-md border border-border px-2 text-small text-text-secondary focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-50"
          >
            ⋮⋮
          </button>
          <div className="min-w-0 @container/tray-item">
            <div
              className={
                item.task.photos[0]?.url
                  ? "grid min-w-0 gap-3 @min-[26rem]/tray-item:grid-cols-[auto_minmax(0,1fr)]"
                  : "min-w-0"
              }
            >
              {item.task.photos[0]?.url ? (
                <Image
                  src={item.task.photos[0].url}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized
                  className="size-12 shrink-0 rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-small font-medium break-words text-text-primary">
                  {item.task.title}
                </p>
                <p className="mt-1 text-caption text-text-secondary">
                  {cards("duration")}: {cards("minutes", { count: item.task.estimated_minutes ?? 30 })}
                </p>
                {item.linkedBlocks.length === 1 ? (
                  <p className="mt-1 text-caption text-text-secondary">
                    {formatDate(blockDate(item.linkedBlocks[0]), "medium", locale)} ·{" "}
                    {formatTimeRange(item.linkedBlocks[0].startAt, item.linkedBlocks[0].endAt, locale)}
                  </p>
                ) : item.linkedBlocks.length > 1 ? (
                  <details className="mt-1 text-caption text-text-secondary">
                    <summary className="cursor-pointer py-1">
                      {cards("multipleScheduledBlocks", { count: item.linkedBlocks.length })}
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {item.linkedBlocks.map((block) => (
                        <li key={block.id}>
                          {formatDate(blockDate(block), "medium", locale)} ·{" "}
                          {formatTimeRange(block.startAt, block.endAt, locale)}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (item.scheduledDate ?? item.task.planned_date ?? item.task.due_date) ? (
                  <p className="mt-1 text-caption text-text-secondary">
                    {cards("plannedDate")}:{" "}
                    {formatDate(
                      (item.scheduledDate ?? item.task.planned_date ?? item.task.due_date) as ISODate,
                      "medium",
                      locale,
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-caption text-text-secondary">{cards("undated")}</p>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={busy || Boolean(activePendingMutation)}
            aria-label={`${cards("schedule")}: ${item.task.title}`}
            onClick={() => openTaskComposer(item)}
            className="col-start-2 min-h-11 shrink-0 justify-self-end rounded-md border border-border px-3 text-small font-medium text-brand-700 hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-50"
          >
            {cards("schedule")}
          </button>
        </article>
      </li>
    );
  }

  return (
    <section className="@container/timeline space-y-4" aria-label={calendar("timelineHint")}>
      <p className="text-small text-text-secondary">{calendar("timelineHint")}</p>
      <p className="sr-only" aria-live="polite">
        {statusMessage}
      </p>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 @min-[44rem]/timeline:grid-cols-[minmax(20rem,1fr)_minmax(0,1.25fr)]">
        <section
          className="min-w-0 rounded-xl border border-border bg-bg-surface p-3"
          aria-labelledby="timeline-unscheduled-heading"
        >
          <h2
            id="timeline-unscheduled-heading"
            className="text-heading-sm mb-3 font-semibold text-text-primary"
          >
            {cards(trayFilter === "all" ? "allTasks" : "unscheduled")}
          </h2>
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={cards("allTasks")}>
            {(["unscheduled", "all"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={trayFilter === filter}
                onClick={() => setTrayFilter(filter)}
                className={`min-h-11 rounded-md border px-3 text-small font-medium focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none ${
                  trayFilter === filter
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-border bg-bg-surface text-text-secondary hover:bg-bg-subtle"
                }`}
              >
                {cards(filter === "all" ? "allTasks" : "unscheduled")}
              </button>
            ))}
          </div>
          {hasMoreTasks ? (
            <p
              role="note"
              className="mb-3 rounded-md bg-warning-50 p-3 text-caption text-text-secondary"
            >
              {cards("calendarTaskLimit", { count: 200 })}{" "}
              <Link
                href="/tasks?mode=cards&view=all"
                className="font-medium text-brand-700 underline"
              >
                {cards("allTasks")}
              </Link>
            </p>
          ) : null}
          {trayItems.length === 0 ? (
            <p className="rounded-lg bg-bg-subtle p-3 text-small text-text-secondary">
              {cards(trayFilter === "all" ? "noTasks" : "noUnscheduledTasks")}
            </p>
          ) : (
            <div className="space-y-3 @min-[44rem]/timeline:max-h-[32rem] @min-[44rem]/timeline:overflow-y-auto @min-[44rem]/timeline:overscroll-contain @min-[44rem]/timeline:pr-1">
              {visibleGroups.map((group) => (
                <details key={group.id} className="rounded-lg border border-border p-2">
                  <summary className="cursor-pointer px-1 py-2 text-small font-semibold text-text-primary">
                    {group.title}{" "}
                    <span className="text-caption text-text-secondary">
                      ({itemsForGroup(group.id).length})
                    </span>
                  </summary>
                  <ul className="mt-2 space-y-2">{itemsForGroup(group.id).map(renderTrayItem)}</ul>
                </details>
              ))}
              {ungroupedItems.length > 0 ? (
                <section aria-label={cards("ungrouped")}>
                  <h3 className="mb-2 text-caption font-medium text-text-secondary">
                    {cards("ungrouped")}
                  </h3>
                  <ul className="space-y-2">{ungroupedItems.map(renderTrayItem)}</ul>
                </section>
              ) : null}
            </div>
          )}
        </section>

        <section
          className="min-w-0 rounded-xl border border-border bg-bg-surface p-3"
          aria-labelledby="timeline-heading"
        >
          <h2
            id="timeline-heading"
            className="text-heading-sm mb-3 font-semibold text-text-primary"
          >
            {formatDate(date, "medium", locale)}
          </h2>
          <p className="mb-3 text-caption text-text-secondary">{cards("keyboardInstructions")}</p>
          <div className="mb-3 grid grid-cols-7 gap-1" role="group" aria-label={calendar("title")}>
            {weekDates.map((targetDate) => (
              <button
                key={targetDate}
                type="button"
                data-day-drop-date={targetDate}
                onClick={() => navigateToDay(targetDate)}
                onDragOver={(event) => previewDateDrop(event, targetDate)}
                onDrop={(event) => dropOnDate(event, targetDate)}
                aria-label={formatDate(targetDate, "longWeekday", locale)}
                aria-current={targetDate === date ? "date" : undefined}
                className={`min-h-12 min-w-0 rounded-md border px-1 py-1 text-center focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none ${
                  dayDropPreview === targetDate
                    ? "border-brand-600 bg-brand-100 text-brand-900"
                    : targetDate === date
                      ? "border-brand-300 bg-brand-50 text-brand-800"
                      : "border-border bg-bg-surface text-text-secondary hover:bg-bg-subtle"
                }`}
              >
                <span className="block truncate text-caption">
                  {formatWeekdayNarrow(targetDate, locale)}
                </span>
                <span className="block text-small font-medium">
                  {formatDate(targetDate, "day", locale)}
                </span>
              </button>
            ))}
          </div>
          {dayDropPreview ? (
            <p className="mb-2 rounded-md bg-brand-50 px-2 py-1 text-caption text-brand-800">
              {cards("dropDayPreview", { date: formatDate(dayDropPreview, "medium", locale) })}
            </p>
          ) : null}
          <div
            data-timeline-scroll-region
            ref={timelineScrollRef}
            className="max-h-[60vh] overflow-auto rounded-lg border border-border lg:max-h-[32rem]"
          >
            <div
              data-timeline-grid
              ref={timelineGridRef}
              className="relative h-[1440px] w-full min-w-0 bg-bg-surface select-none"
              onDragOver={previewTimelineDrop}
              onDrop={dropOnTimeline}
              aria-label={calendar("timelineHint")}
            >
              {Array.from({ length: 25 }, (_, hour) => (
                <div
                  key={hour}
                  className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                  style={{ top: `${hour * HOUR_HEIGHT}px` }}
                >
                  <span className="rounded absolute -top-2.5 left-1 z-20 bg-bg-surface px-1 text-caption text-text-secondary">
                    {formatClock(hour * 60)}
                  </span>
                </div>
              ))}
              {nowMinute !== null && nowLabel ? (
                <div
                  data-current-time-marker
                  role="note"
                  aria-label={nowLabel}
                  className="pointer-events-none absolute inset-x-0 z-30"
                  style={{ top: `${nowMinute}px` }}
                >
                  <span
                    aria-hidden="true"
                    className="border-danger-600 absolute inset-x-0 border-t-2"
                  />
                  <span
                    aria-hidden="true"
                    className="rounded text-danger-700 absolute top-[-0.65rem] left-12 bg-bg-surface px-1 text-caption font-semibold"
                  >
                    {nowLabel}
                  </span>
                </div>
              ) : null}
              {busyItems.map((busyItem) => (
                <div
                  key={`busy-${busyItem.id}`}
                  aria-label={busyItem.title}
                  className="pointer-events-none absolute right-2 left-14 z-0 overflow-hidden rounded-md border border-border bg-bg-subtle/80 px-2 py-1 text-caption text-text-secondary"
                  style={positionForRange(busyItem.startAt, busyItem.endAt)}
                >
                  {busyItem.title}
                </div>
              ))}
              {dropPreview && !dropPreview.dayOnly ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 left-14 z-20 overflow-hidden rounded-md border-2 border-dashed border-brand-600 bg-brand-50/90 px-2 py-1 text-caption text-brand-900"
                  style={{
                    top: `${dropPreview.startMinute}px`,
                    height: `${Math.min(dropPreview.duration, MINUTES_PER_DAY - dropPreview.startMinute)}px`,
                  }}
                >
                  {cards("dropPreview", {
                    date: rangeDateLabel(
                      dropPreview.targetDate,
                      dropPreview.startMinute,
                      dropPreview.duration,
                      locale,
                    ),
                    start: formatClock(dropPreview.startMinute),
                    end: formatClock(dropPreview.startMinute + dropPreview.duration),
                  })}
                </div>
              ) : null}
              {blocks.map((block) => {
                const item = items.find(
                  (candidate) =>
                    candidate.task.id === block.taskId &&
                    candidate.occurrenceDate === block.occurrenceDate &&
                    candidate.linkedBlocks.some((linked) => linked.id === block.id),
                );
                const linked = item?.linkedBlocks.find((candidate) => candidate.id === block.id);
                const canMove = Boolean(
                  item && linked && !linked.isLocked && !activePendingMutation && !busy,
                );
                return (
                  <div
                    key={block.id}
                    className={`absolute right-2 left-14 z-10 flex min-w-0 items-stretch overflow-hidden rounded-md border text-caption ${
                      block.taskId
                        ? "border-brand-300 bg-brand-50 text-brand-900"
                        : "border-border bg-bg-subtle text-text-secondary"
                    } ${canMove ? "" : "opacity-75"}`}
                    style={positionForRange(block.startAt, block.endAt)}
                  >
                    {canMove && item ? (
                      <button
                        type="button"
                        draggable={!busy && !activePendingMutation}
                        disabled={busy || Boolean(activePendingMutation)}
                        onDragStart={(event) => startTaskDrag(event, item.key, block.id, "move")}
                        onDragEnd={endTaskDrag}
                        onPointerDown={(event) => beginTouchDrag(event, item.key, block.id, "move")}
                        aria-label={`${cards("dragHandle")}: ${block.title}`}
                        title={cards("dragHandle")}
                        className="min-h-11 min-w-8 shrink-0 touch-none border-r border-brand-200 px-1 text-text-secondary focus-visible:ring-[3px] focus-visible:ring-brand-500/40 focus-visible:outline-none"
                      >
                        ⋮⋮
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={canMove && item ? () => openBlockComposer(item, block) : undefined}
                      disabled={!canMove}
                      aria-label={`${canMove ? cards("moveTask") : cards("lockedBlock")}: ${block.title}, ${formatTimeRange(block.startAt, block.endAt, locale)}`}
                      title={block.isLocked ? cards("lockedBlock") : undefined}
                      className="min-w-0 flex-1 overflow-hidden px-2 py-1 text-left focus-visible:ring-[3px] focus-visible:ring-brand-500/40 focus-visible:outline-none"
                    >
                      <span className="block truncate font-medium">{block.title}</span>
                      <span className="block truncate">
                        {formatTimeRange(block.startAt, block.endAt, locale)}
                      </span>
                    </button>
                    {canMove && item ? (
                      <button
                        type="button"
                        draggable={!busy && !activePendingMutation}
                        disabled={busy || Boolean(activePendingMutation)}
                        onDragStart={(event) => startTaskDrag(event, item.key, block.id, "resize")}
                        onDragEnd={endTaskDrag}
                        onPointerDown={(event) =>
                          beginTouchDrag(event, item.key, block.id, "resize")
                        }
                        onClick={(event) => {
                          if (suppressNextClickRef.current) {
                            suppressNextClickRef.current = false;
                            event.preventDefault();
                            return;
                          }
                          openBlockComposer(item, block, "resize");
                        }}
                        aria-label={`${cards("resizeHandle")}: ${block.title}`}
                        title={cards("resizeHandle")}
                        className="min-h-11 min-w-8 shrink-0 touch-none border-l border-brand-200 px-1 text-text-secondary focus-visible:ring-[3px] focus-visible:ring-brand-500/40 focus-visible:outline-none"
                      >
                        ↕
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          {dropPreview &&
          !dropPreview.dayOnly &&
          dropPreview.startMinute + dropPreview.duration >= MINUTES_PER_DAY ? (
            <p role="alert" className="text-danger-700 mt-2 text-caption">
              {cards("sameDayTimeBlockOnly")}
            </p>
          ) : null}
        </section>
      </div>

      <ResponsiveDialog
        open={Boolean(composer && selectedItem)}
        onOpenChange={(open) => {
          if (!open && !busy) setComposer(null);
        }}
        title={cards("scheduleTask")}
        description={selectedItem?.task.title}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          composerDateRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          const focusTarget = composerFocusReturnRef.current;
          if (focusTarget?.isConnected) {
            event.preventDefault();
            focusTarget.focus({ preventScroll: true });
          }
          composerFocusReturnRef.current = null;
        }}
      >
        {composer && selectedItem ? (
          <form
            onSubmit={(event) => void confirmSchedule(event)}
            className="space-y-3"
            aria-label={cards("scheduleTask")}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 text-small text-text-secondary">
                {composer.dayOnly
                  ? cards("dropDayPreview", {
                      date: formatDate(composer.targetDate, "medium", locale),
                    })
                  : cards("dropPreview", {
                      date: rangeDateLabel(
                        composer.targetDate,
                        parseClock(composer.startTime),
                        durationBetweenClocks(composer.startTime, composer.endTime),
                        locale,
                      ),
                      start: composer.startTime,
                      end: composer.endTime,
                    })}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => setComposer(null)}
                className="min-h-11 rounded-md px-3 text-small text-text-secondary hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
              >
                {cards("cancelMove")}
              </button>
            </div>

            {invalidTimedRange ? (
              <p role="alert" className="text-danger-700 text-caption">
                {cards("sameDayTimeBlockOnly")}
              </p>
            ) : null}

            {selectedBlocks.length > 1 ? (
              <div className="rounded-lg bg-bg-subtle p-3 text-small text-text-secondary">
                <p>{cards("existingBlocksRequireChoice")}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {selectedBlocks.map((block) => (
                    <li key={block.id}>
                      {formatTimeRange(block.startAt, block.endAt, locale)}
                      {block.isLocked ? ` · ${cards("lockedBlock")}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-caption font-medium text-text-primary">
                {cards("scheduleDate")}
                <input
                  ref={composerDateRef}
                  type="date"
                  value={composer.targetDate}
                  disabled={busy}
                  onChange={(event) =>
                    updateComposer({ targetDate: event.target.value as ISODate })
                  }
                  className="min-h-11 min-w-0 rounded-md border border-border bg-bg-surface px-2 text-small"
                  required
                />
              </label>
              <label className="grid gap-1 text-caption font-medium text-text-primary">
                {cards("startTime")}
                <input
                  type="time"
                  value={composer.startTime}
                  disabled={busy || composer.dayOnly || composer.intent === "resize"}
                  onChange={(event) =>
                    updateComposer({ startTime: event.target.value, dayOnly: false })
                  }
                  className="min-h-11 min-w-0 rounded-md border border-border bg-bg-surface px-2 text-small disabled:opacity-50"
                  required={!composer.dayOnly}
                />
              </label>
              <label className="grid gap-1 text-caption font-medium text-text-primary">
                {cards("endTime")}
                <input
                  type="time"
                  value={composer.endTime}
                  min={composer.startTime}
                  disabled={busy || composer.dayOnly}
                  onChange={(event) =>
                    updateComposer({ endTime: event.target.value, dayOnly: false })
                  }
                  className="min-h-11 min-w-0 rounded-md border border-border bg-bg-surface px-2 text-small disabled:opacity-50"
                  required={!composer.dayOnly}
                />
              </label>
            </div>

            <label className="flex min-h-11 items-center gap-3 text-small text-text-primary">
              <input
                type="checkbox"
                checked={composer.dayOnly}
                disabled={busy || selectedBlocks.some((block) => block.isLocked)}
                onChange={(event) => {
                  if (event.target.checked) {
                    updateComposer({ dayOnly: true, startTime: "", endTime: "", blockId: null });
                  } else {
                    updateComposer({ dayOnly: false, startTime: "09:00", endTime: "09:30" });
                  }
                }}
                className="size-4 accent-brand-700"
              />
              {cards("dayOnly")}
            </label>

            {!composer.dayOnly && selectedBlocks.length > 0 ? (
              <label className="grid max-w-xl gap-1 text-caption font-medium text-text-primary">
                {cards("chooseBlock")}
                <select
                  value={composer.blockId ?? ""}
                  disabled={busy}
                  required
                  onChange={(event) => updateComposer({ blockId: event.target.value || null })}
                  className="min-h-11 rounded-md border border-border bg-bg-surface px-2 text-small"
                >
                  <option value="">{cards("chooseBlock")}</option>
                  {selectedBlocks.map((block) => (
                    <option key={block.id} value={block.id} disabled={block.isLocked}>
                      {formatTimeRange(block.startAt, block.endAt, locale)}
                      {block.isLocked ? ` · ${cards("lockedBlock")}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selectedBlocks.some((block) => block.isLocked) && composer.dayOnly ? (
              <p className="text-danger-700 text-caption">{cards("lockedBlock")}</p>
            ) : null}
            {statusMessage && !pendingMutation ? (
              <p role="alert" className="text-danger-700 text-caption">
                {statusMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={
                busy ||
                Boolean(pendingMutation) ||
                storageUnavailable ||
                timedSelectionNeedsBlock ||
                (!composer.dayOnly && composer.endTime <= composer.startTime)
              }
              className="min-h-11 rounded-md bg-brand-700 px-4 text-small font-semibold text-white hover:bg-brand-800 focus-visible:ring-[3px] focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:opacity-50"
            >
              {busy ? cards("saving") : cards("confirmMove")}
            </button>
          </form>
        ) : null}
      </ResponsiveDialog>

      {activeUndoableSchedule && !pendingMutation && !storageUnavailable ? (
        <div
          role="status"
          aria-live="polite"
          className="border-success-300 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-success-50 p-4 text-small text-text-primary"
        >
          <span>{cards("scheduleSaved")}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runUndoMutation(
                {
                  kind: "undo",
                  userId: activeUndoableSchedule.userId,
                  boardDate: activeUndoableSchedule.boardDate,
                  operationId: activeUndoableSchedule.operationId,
                },
                false,
              )
            }
            className="border-success-600 min-h-11 rounded-md border bg-bg-surface px-4 font-medium text-brand-700 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-50"
          >
            {t("common.undo")}
          </button>
        </div>
      ) : null}

      {pendingMutation && busy ? (
        <p role="status" aria-live="polite" className="text-small text-text-secondary">
          {cards("saving")}
        </p>
      ) : null}
      {pendingMutation && !busy ? (
        <div
          role="alert"
          className="border-warning-300 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-warning-50 p-4 text-small text-text-primary"
        >
          <span>{cards("scheduleChangeUncertain")}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void retryPendingMutation()}
            className="min-h-11 rounded-md bg-bg-surface px-4 font-medium text-brand-700 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-50"
          >
            {busy ? cards("saving") : cards("retrySchedule")}
          </button>
        </div>
      ) : storageUnavailable ? (
        <p
          role="alert"
          className="border-danger-300 text-danger-700 rounded-lg border p-3 text-small"
        >
          {cards("scheduleRetryStorageUnavailable")}
        </p>
      ) : null}
    </section>
  );
}

function parseDragPayload(serialized: string): DragPayload | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.itemKey !== "string") return null;
    if (record.blockId !== null && typeof record.blockId !== "string") return null;
    if (record.mode !== "move" && record.mode !== "resize") return null;
    return { itemKey: record.itemKey, blockId: record.blockId as string | null, mode: record.mode };
  } catch {
    return null;
  }
}

function parsePendingMutation(
  serialized: string,
  userId: string,
  boardDate: ISODate,
): PendingMutation | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (record.userId !== userId || record.boardDate !== boardDate) return null;
    if (record.kind === "undo") {
      const undoInput = undoTaskCardScheduleSchema.safeParse({ operationId: record.operationId });
      if (!undoInput.success) return null;
      return { kind: "undo", userId, boardDate, operationId: undoInput.data.operationId };
    }
    if (record.kind !== "schedule" || typeof record.itemKey !== "string") return null;
    const input = scheduleTaskCardSchema.safeParse(record.input);
    if (!input.success) return null;
    return { kind: "schedule", userId, boardDate, itemKey: record.itemKey, input: input.data };
  } catch {
    return null;
  }
}

function storePendingMutation(request: PendingMutation, storageKey: string) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(request));
    dispatchSessionStorageChange(storageKey);
    return true;
  } catch {
    return false;
  }
}

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
  function onLocalStorageChange(event: Event) {
    const changedKey = (event as CustomEvent<string>).detail;
    if (changedKey === storageKey) onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSION_STORAGE_EVENT, onLocalStorageChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SESSION_STORAGE_EVENT, onLocalStorageChange);
  };
}

function dispatchSessionStorageChange(storageKey: string) {
  window.dispatchEvent(new CustomEvent(SESSION_STORAGE_EVENT, { detail: storageKey }));
}

function isUncertainError(error: string) {
  return error === "generic";
}

function durationForItem(item: TimelineBoardItem, blockId: string | null) {
  const block = blockId ? item.linkedBlocks.find((candidate) => candidate.id === blockId) : null;
  if (block) {
    return Math.max(1, Math.round((Date.parse(block.endAt) - Date.parse(block.startAt)) / 60_000));
  }
  return Math.max(1, item.task.estimated_minutes ?? 30);
}

function scheduleErrorMessage(
  error: string,
  deadlineConflict: string,
  blockLocked: string,
  scheduleConflict: string,
  calendarEventConflict: string,
  generic: string,
) {
  if (error === "deadlineConflict") return deadlineConflict;
  if (error === "timeBlockLocked") return blockLocked;
  if (error === "calendarEventConflict") return calendarEventConflict;
  if (error === "conflict" || error === "undoConflict" || error === "timeBlockConflict") {
    return scheduleConflict;
  }
  return generic;
}

function positionForRange(startAt: string, endAt: string) {
  const start = minutesInBangkok(startAt);
  const duration = Math.max(1, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000));
  const end = Math.min(MINUTES_PER_DAY, start + duration);
  const safeEnd = Math.max(start + 1, end);
  return {
    top: `${start}px`,
    height: `${safeEnd - start}px`,
  };
}

function minutesInBangkok(value: string) {
  const local = formatInTimeZone(new Date(value), APP_TIME_ZONE, "H:mm");
  const [hour, minute] = local.split(":").map(Number);
  return hour * 60 + minute;
}

function formatClock(totalMinutes: number) {
  const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function parseClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function durationBetweenClocks(start: string, end: string) {
  const startMinute = parseClock(start);
  let endMinute = parseClock(end);
  if (endMinute <= startMinute) endMinute += MINUTES_PER_DAY;
  return endMinute - startMinute;
}

function rangeDateLabel(date: ISODate, startMinute: number, duration: number, locale: AppLocale) {
  const endDate = addDaysISO(date, Math.floor((startMinute + duration) / MINUTES_PER_DAY));
  const startLabel = formatDate(date, "medium", locale);
  return endDate === date ? startLabel : `${startLabel} → ${formatDate(endDate, "medium", locale)}`;
}

function formatTimeRange(startAt: string, endAt: string, locale: AppLocale) {
  const formatter = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
  return `${formatter.format(new Date(startAt))}–${formatter.format(new Date(endAt))}`;
}

function blockDate(block: LinkedBlock): ISODate {
  return formatInTimeZone(new Date(block.startAt), APP_TIME_ZONE, "yyyy-MM-dd") as ISODate;
}

function toTimestamp(date: ISODate, time: string) {
  return fromZonedTime(`${date}T${time}:00`, APP_TIME_ZONE).toISOString();
}

function isBoardDate(value: string): value is ISODate {
  return isISODate(value);
}
