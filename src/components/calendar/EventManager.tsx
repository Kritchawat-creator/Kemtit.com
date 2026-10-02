"use client";

import { CalendarDays, Clock3, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/core/calendar-events/actions";
import {
  createExternalCalendarEvent,
  deleteExternalCalendarEvent,
  loadExternalCalendarEvent,
  reconcileExternalCalendarOperation,
  updateExternalCalendarEvent,
} from "@/core/calendar-integrations/actions";
import type { CalendarEventValue, CalendarProviderName } from "@/core/calendar-integrations/provider";
import type { Database } from "@/types/database";
import { APP_TIME_ZONE, type AppLocale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import { ConfirmSheet } from "@/components/domain/ConfirmSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  emptyEventDraft,
  eventDraftFromLocal,
  eventDraftFromProvider,
  localDraftFromEvent,
  providerPatchFromDraft,
  providerValueFromDraft,
  updateDraftScheduleMode,
  validateEventDraft,
  type EventDraft,
  type EventDraftField,
} from "./event-manager-utils";

type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];

export type ExternalEventDetail = {
  sourceEventId: string;
  connectionId: string;
  provider: CalendarProviderName;
  providerLabel: string | null;
  editable: boolean;
  kind: "single" | "occurrence" | "series";
  revision: string;
  value: CalendarEventValue;
};

export type EventManagerConnection = {
  id: string;
  provider: CalendarProviderName;
  accountLabel: string | null;
  status: "active" | "revoked" | "error";
  canWrite: boolean;
};

export type ExternalCalendarOperation = {
  operationId: string;
  connectionId: string;
  sourceEventId: string | null;
  kind: "create" | "update" | "delete";
  status: "queued" | "pending" | "unknown" | "conflict" | string;
  errorCode: string | null;
  updatedAt: string;
};

type Props = {
  date: string;
  events: CalendarEventRow[];
  connections: EventManagerConnection[];
  externalDetails: ExternalEventDetail[];
  operations: ExternalCalendarOperation[];
};

type EditorContext =
  | { kind: "new"; destination: string }
  | { kind: "local"; event: CalendarEventRow }
  | { kind: "external"; detail: ExternalEventDetail };

type ActiveOperation = {
  operationId: string;
  connectionId: string;
  status: "queued" | "pending" | "unknown" | "conflict";
  kind: "create" | "update" | "delete";
};

type DeleteRequest = {
  target: EditorContext;
  title: string;
  source: string;
  priorOperation: ActiveOperation | null;
};

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

function isUnresolved(status: string): status is ActiveOperation["status"] {
  return status === "queued" || status === "pending" || status === "unknown" || status === "conflict";
}

function providerLabel(provider: CalendarProviderName, t: ReturnType<typeof useTranslations<"calendarEvents">>) {
  return provider === "google" ? t("providerGoogle") : t("providerOutlook");
}

function eventScheduleLabel(
  event: CalendarEventRow,
  detail: ExternalEventDetail | undefined,
  locale: AppLocale,
  t: ReturnType<typeof useTranslations<"calendarEvents">>,
) {
  if (detail) {
    const draft = eventDraftFromProvider(detail.value);
    if (detail.value.allDay) {
      const first = formatDate(draft.startDate, "short", locale);
      const last = formatDate(draft.lastDay, "short", locale);
      const dateRange = draft.startDate === draft.lastDay ? first : `${first} – ${last}`;
      return `${dateRange} · ${t("allDay")}`;
    }
    const start = new Date(detail.value.start);
    const end = new Date(detail.value.end);
    const dateLabel =
      draft.lastDay === draft.startDate
        ? formatDate(draft.startDate, "short", locale)
        : `${formatDate(draft.startDate, "short", locale)} – ${formatDate(draft.lastDay, "short", locale)}`;
    return `${dateLabel} · ${start.toLocaleTimeString(locale, { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString(locale, { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}`;
  }

  const dateLabel = formatDate(event.event_date, "short", locale);
  if (event.all_day) return `${dateLabel} · ${t("allDay")}`;
  return `${dateLabel} · ${(event.start_time ?? "").slice(0, 5)}–${(event.end_time ?? "").slice(0, 5)}`;
}

export function EventManager({ date, events, connections, externalDetails, operations }: Props) {
  const t = useTranslations("calendarEvents");
  const te = useTranslations("errors");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [context, setContext] = useState<EditorContext | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [originalTitle, setOriginalTitle] = useState<string | null>(null);
  const [dirtyFields, setDirtyFields] = useState<Set<EventDraftField>>(() => new Set());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [operationStatuses, setOperationStatuses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  function beginRequest() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  }

  function endRequest() {
    busyRef.current = false;
    setBusy(false);
  }

  const detailsBySourceId = useMemo(
    () => new Map(externalDetails.map((detail) => [detail.sourceEventId, detail])),
    [externalDetails],
  );
  const writableConnections = connections.filter(
    (connection) => connection.status === "active" && connection.canWrite,
  );

  const visibleEvents = useMemo(() => {
    const seenSources = new Set<string>();
    return events.filter((event) => {
      if (!event.external_source_id) return true;
      if (seenSources.has(event.external_source_id)) return false;
      seenSources.add(event.external_source_id);
      return true;
    });
  }, [events]);

  const localDestination =
    context?.kind === "local" || (context?.kind === "new" && context.destination === "local");
  const existingExternal = context?.kind === "external";
  const editorReadOnly =
    context?.kind === "external" && (!context.detail.editable || context.detail.kind === "series");
  const titleChanged = context?.kind === "new" || draft?.title !== originalTitle;
  const scheduleChanged =
    dirtyFields.has("allDay") ||
    dirtyFields.has("startDate") ||
    dirtyFields.has("lastDay") ||
    dirtyFields.has("startLocal") ||
    dirtyFields.has("endLocal");
  const destinationConnection =
    context?.kind === "new"
      ? writableConnections.find((connection) => connection.id === context.destination)
      : null;

  function showActionError(key: string) {
    setActionError(te.has(key as ErrorKey) ? te(key as ErrorKey) : te("generic"));
  }

  function resetEditor() {
    setContext(null);
    setDraft(null);
    setOriginalTitle(null);
    setDirtyFields(new Set());
    setValidationError(null);
    setActionError(null);
    setActiveOperation(null);
  }

  function startNew() {
    setContext({ kind: "new", destination: "" });
    setDraft(emptyEventDraft(date));
    setOriginalTitle(null);
    setDirtyFields(new Set());
    setValidationError(null);
    setActionError(null);
    setActiveOperation(null);
  }

  function startLocalEdit(event: CalendarEventRow) {
    const nextDraft = eventDraftFromLocal({
      title: event.title,
      eventDate: event.event_date,
      allDay: event.all_day,
      blocksTime: event.blocks_time,
      startTime: event.start_time,
      endTime: event.end_time,
    });
    setContext({ kind: "local", event });
    setDraft(nextDraft);
    setOriginalTitle(nextDraft.title);
    setDirtyFields(new Set());
    setValidationError(null);
    setActionError(null);
    setActiveOperation(null);
  }

  function startExternalEdit(detail: ExternalEventDetail) {
    if (!detail.editable || detail.kind === "series") return;
    const nextDraft = eventDraftFromProvider(detail.value);
    setContext({ kind: "external", detail });
    setDraft(nextDraft);
    setOriginalTitle(nextDraft.title);
    setDirtyFields(new Set());
    setValidationError(null);
    setActionError(null);
    setActiveOperation(null);
  }

  function changeField<K extends EventDraftField>(field: K, value: EventDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setDirtyFields((current) => new Set(current).add(field));
    setValidationError(null);
    setActionError(null);
  }

  function changeAllDay(allDay: boolean) {
    setDraft((current) => (current ? updateDraftScheduleMode(current, allDay) : current));
    setDirtyFields((current) => new Set(current).add("allDay"));
    setValidationError(null);
    setActionError(null);
  }

  async function saveEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !draft || busyRef.current) return;
    if (context.kind === "new" && !context.destination) {
      setValidationError("required");
      return;
    }

    const isNew = context.kind === "new";
    const isExternal =
      context.kind === "external" || (context.kind === "new" && context.destination !== "local");
    const validation = validateEventDraft(draft, {
      localDestination: Boolean(localDestination),
      titleChanged: Boolean(titleChanged),
      scheduleChanged: !existingExternal || scheduleChanged,
    });
    if (validation) {
      setValidationError(validation);
      return;
    }

    if (!beginRequest()) return;
    setActionError(null);
    let pendingExternalOperation: ActiveOperation | null = null;
    try {
      if (!isExternal) {
        const localDraft = localDraftFromEvent(draft);
        if (!localDraft) {
          setValidationError("localSingleDay");
          return;
        }
        const input = { ...localDraft };
        const result = isNew
          ? await createCalendarEvent(input)
          : await updateCalendarEvent({ ...input, id: context.event.id });
        if (!result.ok) {
          showActionError(result.error);
          return;
        }
        router.refresh();
        resetEditor();
        return;
      }

      const connectionId =
        context.kind === "external" ? context.detail.connectionId : destinationConnection?.id;
      if (!connectionId) {
        showActionError("externalCalendarUnavailable");
        return;
      }

      const operationId = activeOperation?.operationId ?? crypto.randomUUID();
      const operationKind = isNew ? "create" : "update";
      pendingExternalOperation = {
        operationId,
        connectionId,
        status: "unknown",
        kind: operationKind,
      };
      const result = isNew
        ? await createExternalCalendarEvent({
            connectionId,
            operationId,
            value: providerValueFromDraft(draft)!,
          })
        : await updateExternalCalendarEvent({
            connectionId,
            sourceEventId: context.detail.sourceEventId,
            operationId,
            expectedRevision: context.detail.revision,
            patch: providerPatchFromDraft(draft, dirtyFields),
          });

      if (!result.ok) {
        showActionError(result.error);
        if (result.error === "externalCalendarConflict") {
          setActiveOperation({ operationId, connectionId, status: "conflict", kind: operationKind });
        } else if (result.error === "externalCalendarOutcomeUnknown") {
          setActiveOperation({ operationId, connectionId, status: "unknown", kind: operationKind });
        }
        return;
      }

      if (result.data.status === "succeeded") {
        router.refresh();
        resetEditor();
        return;
      }
      if (isUnresolved(result.data.status)) {
        setActiveOperation({
          operationId: result.data.operationId,
          connectionId,
          status: result.data.status,
          kind: operationKind,
        });
        if (result.data.status === "conflict") showActionError("externalCalendarConflict");
      } else {
        showActionError("calendarSyncFailed");
      }
    } catch {
      if (pendingExternalOperation) {
        setActiveOperation(pendingExternalOperation);
        showActionError("externalCalendarOutcomeUnknown");
      } else {
        showActionError("generic");
      }
    } finally {
      endRequest();
    }
  }

  async function deleteTarget(target: EditorContext, priorOperation?: ActiveOperation | null) {
    if (!beginRequest()) return;
    setActionError(null);
    let pendingExternalOperation: ActiveOperation | null = null;
    try {
      if (target.kind === "local") {
        const result = await deleteCalendarEvent({ id: target.event.id });
        if (!result.ok) {
          showActionError(result.error);
          return;
        }
        router.refresh();
        resetEditor();
        return;
      }

      if (target.kind !== "external") return;
      const operationId = priorOperation?.operationId ?? crypto.randomUUID();
      pendingExternalOperation = {
        operationId,
        connectionId: target.detail.connectionId,
        status: "unknown",
        kind: "delete",
      };
      const result = await deleteExternalCalendarEvent({
        connectionId: target.detail.connectionId,
        sourceEventId: target.detail.sourceEventId,
        expectedRevision: target.detail.revision,
        operationId,
      });
      if (!result.ok) {
        showActionError(result.error);
        if (result.error === "externalCalendarConflict") {
          setActiveOperation({
            operationId,
            connectionId: target.detail.connectionId,
            status: "conflict",
            kind: "delete",
          });
        } else if (result.error === "externalCalendarOutcomeUnknown") {
          setActiveOperation({
            operationId,
            connectionId: target.detail.connectionId,
            status: "unknown",
            kind: "delete",
          });
        }
        return;
      }
      if (result.data.status === "succeeded") {
        router.refresh();
        resetEditor();
        return;
      }
      if (isUnresolved(result.data.status)) {
        setActiveOperation({
          operationId: result.data.operationId,
          connectionId: target.detail.connectionId,
          status: result.data.status,
          kind: "delete",
        });
        if (result.data.status === "conflict") showActionError("externalCalendarConflict");
      } else {
        showActionError("calendarSyncFailed");
      }
    } catch {
      if (pendingExternalOperation) {
        setActiveOperation(pendingExternalOperation);
        showActionError("externalCalendarOutcomeUnknown");
      } else {
        showActionError("generic");
      }
    } finally {
      endRequest();
    }
  }

  async function deleteEvent() {
    if (!context || context.kind === "new") return;
    requestDelete(context, activeOperation);
  }

  function deleteFromList(event: CalendarEventRow, detail?: ExternalEventDetail) {
    const target: EditorContext = detail ? { kind: "external", detail } : { kind: "local", event };
    requestDelete(target);
  }

  function requestDelete(target: EditorContext, priorOperation: ActiveOperation | null = null) {
    if (target.kind === "new") return;
    setActionError(null);
    setDeleteRequest({
      target,
      title: target.kind === "external" ? target.detail.value.title : target.event.title,
      source: target.kind === "external"
        ? `${providerLabel(target.detail.provider, t)}${target.detail.providerLabel ? ` · ${target.detail.providerLabel}` : ""}`
        : t("sourceLocal"),
      priorOperation,
    });
  }

  async function confirmDelete() {
    if (!deleteRequest || busyRef.current) return;
    const { target } = deleteRequest;
    setDeleteRequest(null);
    if (target.kind === "local") startLocalEdit(target.event);
    else if (target.kind === "external") startExternalEdit(target.detail);
    await deleteTarget(target, deleteRequest.priorOperation);
  }

  async function reconcile(operation: { connectionId: string; operationId: string }) {
    if (!beginRequest()) return;
    setActionError(null);
    try {
      const result = await reconcileExternalCalendarOperation(operation);
      if (!result.ok) {
        showActionError(result.error);
        return;
      }
      const status = result.data.status;
      if (status === "succeeded") {
        router.refresh();
        if (activeOperation?.operationId === result.data.operationId) resetEditor();
        setOperationStatuses((current) => ({ ...current, [result.data.operationId]: status }));
        return;
      }
      if (isUnresolved(status)) {
        setOperationStatuses((current) => ({ ...current, [result.data.operationId]: status }));
        if (activeOperation?.operationId === result.data.operationId) {
          setActiveOperation({ ...activeOperation, status });
          if (status === "conflict") showActionError("externalCalendarConflict");
        }
      } else if (status === "failed") {
        setOperationStatuses((current) => ({ ...current, [result.data.operationId]: status }));
        if (activeOperation?.operationId === result.data.operationId) setActiveOperation(null);
        showActionError("calendarSyncFailed");
      } else {
        showActionError("calendarSyncFailed");
      }
    } catch {
      showActionError("externalCalendarOutcomeUnknown");
    } finally {
      endRequest();
    }
  }

  async function loadLatest() {
    if (context?.kind !== "external" || !beginRequest()) return;
    setActionError(null);
    try {
      const result = await loadExternalCalendarEvent({
        connectionId: context.detail.connectionId,
        sourceEventId: context.detail.sourceEventId,
      });
      if (!result.ok) {
        showActionError(result.error);
        return;
      }
      const detail = result.data;
      if (!detail.editable || detail.kind === "series") {
        setContext({ kind: "external", detail });
        setActiveOperation(null);
        showActionError("externalCalendarUnavailable");
        return;
      }
      const latestDraft = eventDraftFromProvider(detail.value);
      setContext({ kind: "external", detail });
      setDraft(latestDraft);
      setOriginalTitle(latestDraft.title);
      setDirtyFields(new Set());
      setActiveOperation(null);
      setValidationError(null);
      setActionError(null);
    } catch {
      showActionError("calendarSyncFailed");
    } finally {
      endRequest();
    }
  }

  const unresolvedOperations = operations.filter((operation) => {
    const status = operationStatuses[operation.operationId] ?? operation.status;
    return isUnresolved(status);
  });

  return (
    <div
      className={`grid min-w-0 items-start gap-4 ${context ? "lg:grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.1fr)]" : ""}`}
    >
      <section className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs">
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={startNew} disabled={busy || Boolean(activeOperation)}>
            <Plus aria-hidden="true" />
            {t("newEvent")}
          </Button>
        </div>

        {visibleEvents.length ? (
          <ul className="mt-4 divide-y divide-border">
            {visibleEvents.map((event) => {
              const detail = event.external_source_id
                ? detailsBySourceId.get(event.external_source_id)
                : undefined;
              const isExternal = Boolean(event.external_source_id);
              const canEdit = detail
                ? detail.editable && detail.kind !== "series"
                : !isExternal && event.data_origin === "USER";
              const sourceText = detail
                ? `${providerLabel(detail.provider, t)}${detail.providerLabel ? ` · ${detail.providerLabel}` : ""}`
                : t(isExternal ? "sourceImported" : "sourceLocal");

              return (
                <li key={event.id} className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-body font-medium text-text-primary">
                      {detail?.value.title ?? event.title}
                    </p>
                    <p className="mt-0.5 text-small text-text-secondary">
                      {eventScheduleLabel(event, detail, locale, t)}
                    </p>
                    <p className="mt-0.5 text-caption text-text-muted">
                      {t("source")}: {sourceText}
                    </p>
                    {isExternal && !canEdit ? (
                      <p className="mt-1 text-caption text-text-secondary">
                        {detail?.kind === "series" ? t("seriesReadOnly") : t("readOnly")}
                      </p>
                    ) : null}
                    {canEdit ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={busy || Boolean(activeOperation)}
                          onClick={() => (detail ? startExternalEdit(detail) : startLocalEdit(event))}
                          aria-label={`${t("editEvent")}: ${detail?.value.title ?? event.title}`}
                        >
                          <Pencil aria-hidden="true" />
                          {t("editEvent")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={busy || Boolean(activeOperation)}
                          onClick={() => deleteFromList(event, detail)}
                          aria-label={`${t("delete")}: ${detail?.value.title ?? event.title}`}
                        >
                          <Trash2 aria-hidden="true" />
                          {t("delete")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg bg-bg-subtle p-3 text-small text-text-secondary">{t("noEvents")}</p>
        )}

        {unresolvedOperations.length ? (
          <section className="mt-4 border-t border-border pt-3" aria-label={t("reconcile")}>
            <h3 className="text-caption font-semibold text-text-primary">{t("reconcile")}</h3>
            <ul className="mt-2 space-y-2">
              {unresolvedOperations.map((operation) => {
                const status = operationStatuses[operation.operationId] ?? operation.status;
                return (
                  <li key={operation.operationId} className="rounded-lg bg-bg-subtle p-3">
                    <p className="text-caption text-text-secondary">
                      {status === "queued"
                        ? t("queued")
                        : status === "pending"
                          ? t("pending")
                          : status === "conflict"
                            ? t("conflict")
                            : t("outcomeUnknown")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="mt-2"
                      disabled={busy}
                      onClick={() =>
                        void reconcile({
                          connectionId: operation.connectionId,
                          operationId: operation.operationId,
                        })
                      }
                    >
                      <RefreshCw aria-hidden="true" />
                      {t("reconcile")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </section>

      {context && draft ? (
        <section className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs">
          <form className="space-y-4" onSubmit={(event) => void saveEvent(event)}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-h2 text-text-primary">
                {context.kind === "new" ? t("newEvent") : t("editEvent")}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={resetEditor}
                disabled={busy || Boolean(activeOperation)}
              >
                {t("cancel")}
              </Button>
            </div>

            {context.kind === "new" ? (
              <label className="block text-caption font-medium text-text-secondary">
                {t("destination")}
                <select
                  className="mt-1 h-11 w-full min-w-0 rounded-md border border-border bg-bg-surface px-3 text-base text-text-primary"
                  value={context.destination}
                  onChange={(event) => {
                    setContext({ kind: "new", destination: event.target.value });
                    setValidationError(null);
                  }}
                  disabled={busy}
                >
                  <option value="" disabled>
                    {t("destinationChoose")}
                  </option>
                  <option value="local">{t("destinationLocal")}</option>
                  {writableConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {providerLabel(connection.provider, t)}
                      {connection.accountLabel ? ` · ${connection.accountLabel}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-md bg-bg-subtle px-3 py-2 text-caption text-text-secondary">
                {t("source")}: {context.kind === "local"
                  ? t("sourceLocal")
                  : `${providerLabel(context.detail.provider, t)}${context.detail.providerLabel ? ` · ${context.detail.providerLabel}` : ""}`}
              </p>
            )}

            {editorReadOnly ? (
              <p role="note" className="text-small text-text-secondary">
                {context.kind === "external" && context.detail.kind === "series"
                  ? t("seriesReadOnly")
                  : t("readOnly")}
              </p>
            ) : null}

            <label className="block text-caption font-medium text-text-secondary" htmlFor="calendar-event-title">
              {t("eventTitle")}
              <Input
                id="calendar-event-title"
                value={draft.title}
                onChange={(event) => changeField("title", event.target.value)}
                className="mt-1"
                required={Boolean(localDestination || titleChanged)}
                disabled={busy || editorReadOnly || Boolean(activeOperation && activeOperation.status !== "conflict")}
              />
            </label>

            <label className="flex items-center gap-2 text-small text-text-primary">
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(event) => changeAllDay(event.target.checked)}
                disabled={busy || editorReadOnly || Boolean(activeOperation && activeOperation.status !== "conflict")}
                className="size-4 accent-brand-600"
              />
              {t("allDay")}
            </label>

            {draft.allDay ? (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block text-caption font-medium text-text-secondary">
                  {t("startDate")}
                  <Input
                    type="date"
                    value={draft.startDate}
                    onChange={(event) => changeField("startDate", event.target.value)}
                    className="mt-1"
                    required
                    disabled={busy || editorReadOnly || Boolean(activeOperation && activeOperation.status !== "conflict")}
                  />
                </label>
                <label className="block text-caption font-medium text-text-secondary">
                  {t("lastDay")}
                  <Input
                    type="date"
                    value={draft.lastDay}
                    onChange={(event) => changeField("lastDay", event.target.value)}
                    className="mt-1"
                    required
                    disabled={busy || editorReadOnly || Boolean(activeOperation && activeOperation.status !== "conflict")}
                  />
                </label>
              </div>
            ) : (
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="block text-caption font-medium text-text-secondary">
                  {t("startTime")}
                  <Input
                    type="datetime-local"
                    value={draft.startLocal}
                    onChange={(event) => changeField("startLocal", event.target.value)}
                    className="mt-1"
                    required
                    disabled={busy || editorReadOnly || Boolean(activeOperation && activeOperation.status !== "conflict")}
                  />
                </label>
                <label className="block text-caption font-medium text-text-secondary">
                  {t("endTime")}
                  <Input
                    type="datetime-local"
                    value={draft.endLocal}
                    onChange={(event) => changeField("endLocal", event.target.value)}
                    className="mt-1"
                    required
                    disabled={busy || editorReadOnly || Boolean(activeOperation && activeOperation.status !== "conflict")}
                  />
                </label>
              </div>
            )}

            <p className="text-caption text-text-muted">
              <Clock3 className="mr-1 inline size-3.5" aria-hidden="true" />
              {t("timeZoneHint", { timezone: APP_TIME_ZONE })}
            </p>

            <label className="flex items-center gap-2 text-small text-text-primary">
              <input
                type="checkbox"
                checked={draft.blocksTime}
                onChange={(event) => changeField("blocksTime", event.target.checked)}
                disabled={busy || editorReadOnly || Boolean(activeOperation && activeOperation.status !== "conflict")}
                className="size-4 accent-brand-600"
              />
              {t("blocksTime")}
            </label>

            {validationError ? (
              <p role="alert" className="text-small text-danger-700">
                {te.has(validationError as ErrorKey) ? te(validationError as ErrorKey) : te("generic")}
              </p>
            ) : null}
            {actionError ? <p role="alert" className="text-small text-danger-700">{actionError}</p> : null}

            {activeOperation ? (
              <div role="status" className="rounded-lg bg-bg-subtle p-3 text-small text-text-secondary">
                <p>
                  {activeOperation.status === "queued"
                    ? t("queued")
                    : activeOperation.status === "pending"
                      ? t("pending")
                      : activeOperation.status === "conflict"
                        ? t("conflict")
                        : t("outcomeUnknown")}
                </p>
                {activeOperation.status === "conflict" && context.kind === "external" ? (
                  <Button type="button" variant="outline" size="xs" className="mt-2" disabled={busy} onClick={() => void loadLatest()}>
                    {t("loadLatest")}
                  </Button>
                ) : null}
                {activeOperation.status !== "conflict" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="mt-2"
                    disabled={busy}
                    onClick={() =>
                      void reconcile({
                        connectionId: activeOperation.connectionId,
                        operationId: activeOperation.operationId,
                      })
                    }
                  >
                    <RefreshCw aria-hidden="true" />
                    {t("reconcile")}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={busy || editorReadOnly || Boolean(activeOperation) || (context.kind !== "new" && dirtyFields.size === 0)}
              >
                {t("save")}
              </Button>
              {context.kind !== "new" ? (
                <Button type="button" variant="destructive" onClick={() => void deleteEvent()} disabled={busy || editorReadOnly || Boolean(activeOperation)}>
                  <Trash2 aria-hidden="true" />
                  {t("delete")}
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      <ConfirmSheet
        open={deleteRequest !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteRequest(null);
        }}
        title={t("deleteConfirmTitle")}
        description={
          deleteRequest
            ? t("deleteConfirmDescription", {
                title: deleteRequest.title,
                source: deleteRequest.source,
              })
            : undefined
        }
      >
        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setDeleteRequest(null)}
          >
            {t("cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
            {t("deleteConfirm")}
          </Button>
        </div>
      </ConfirmSheet>
    </div>
  );
}
