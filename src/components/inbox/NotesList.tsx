"use client";

import { Archive, CheckCircle2, MoreHorizontal, Pencil, Plus, WandSparkles } from "@/components/icons/ui-icons";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { APP_TIME_ZONE, type AppLocale } from "@/i18n/config";
import {
  archiveNote,
  convertNoteToTask,
  createNote,
  updateNote,
} from "@/core/notes/actions";
import type { Database } from "@/types/database";
import { Button } from "@/components/ui/button";

type Note = Database["public"]["Tables"]["notes"]["Row"];

const PREVIEW_LIMIT = 5;

export function NotesList({ notes, date }: { notes: Note[]; date: string }) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertDomain, setConvertDomain] = useState<Domain>("work");
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();
  const addNoteButtonRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const shouldRestoreComposerFocus = useRef(false);
  const editingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const noteActionsRefs = useRef(new Map<string, HTMLElement>());
  const editingNoteIdForFocus = useRef<string | null>(null);
  const shouldRestoreEditingFocus = useRef(false);

  const visibleNotes = showAll ? notes : notes.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, notes.length - PREVIEW_LIMIT);

  useEffect(() => {
    if (composerOpen) {
      composerRef.current?.focus({ preventScroll: true });
      return;
    }

    if (!shouldRestoreComposerFocus.current) return;
    shouldRestoreComposerFocus.current = false;
    addNoteButtonRef.current?.focus({ preventScroll: true });
  }, [composerOpen]);

  useEffect(() => {
    if (editingId) {
      editingTextareaRef.current?.focus({ preventScroll: true });
      return;
    }

    if (!shouldRestoreEditingFocus.current) return;
    shouldRestoreEditingFocus.current = false;
    const noteId = editingNoteIdForFocus.current;
    if (noteId) noteActionsRefs.current.get(noteId)?.focus({ preventScroll: true });
    editingNoteIdForFocus.current = null;
  }, [editingId]);

  function closeComposer(clearDraft = false) {
    shouldRestoreComposerFocus.current = true;
    setComposerOpen(false);
    if (clearDraft) setDraft("");
  }

  function closeEditing() {
    shouldRestoreEditingFocus.current = true;
    setEditingId(null);
    setEditingValue("");
  }

  function create() {
    const content = draft.trim();
    if (!content) return;
    const payload = splitNoteContent(content);

    startTransition(async () => {
      const result = await createNote({ ...payload, noteDate: date });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      closeComposer(true);
      toast.success(t("inbox.noteCreated"));
      router.refresh();
    });
  }

  function saveEdit(note: Note) {
    const content = editingValue.trim();
    if (!content) return;
    const payload = splitNoteContent(content);

    startTransition(async () => {
      const result = await updateNote({ id: note.id, ...payload });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      closeEditing();
      toast.success(t("inbox.noteUpdated"));
      router.refresh();
    });
  }

  function archive(note: Note) {
    startTransition(async () => {
      const result = await archiveNote({ id: note.id });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("inbox.noteArchived"));
      router.refresh();
    });
  }

  function convert(note: Note) {
    startTransition(async () => {
      const result = await convertNoteToTask({ id: note.id, domain: convertDomain });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setConvertingId(null);
      toast.success(t("inbox.noteConverted"));
      router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="text-small text-text-secondary">
          {notes.length === 0
            ? t("inbox.notesEmpty")
            : t("inbox.notesSummary", { count: notes.length })}
        </p>
        <Button
          ref={addNoteButtonRef}
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => {
            if (composerOpen) closeComposer();
            else setComposerOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          {t("inbox.addNote")}
        </Button>
      </div>

      {composerOpen ? (
        <div className="mt-3 rounded-lg border border-border bg-bg-subtle p-3">
          <label htmlFor="daily-note-composer" className="sr-only">
            {t("inbox.notePlaceholder")}
          </label>
          <textarea
            id="daily-note-composer"
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                closeComposer(true);
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                create();
              }
            }}
            rows={3}
            placeholder={t("inbox.notePlaceholder")}
            className="min-h-24 w-full resize-y rounded-md border border-border bg-bg-surface px-3 py-2.5 text-base text-text-primary outline-none placeholder:text-text-muted focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-caption text-text-muted">{t("inbox.noteComposerHint")}</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  closeComposer(true);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-11"
                disabled={pending || !draft.trim()}
                onClick={create}
              >
                {pending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <div className="py-5 text-center">
          <p className="text-small text-text-secondary">{t("inbox.notesEmptyHint")}</p>
        </div>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-border">
            {visibleNotes.map((note) => (
              <li key={note.id} className="min-w-0 py-3 first:pt-0">
                {editingId === note.id ? (
                  <div className="rounded-lg bg-bg-subtle p-3">
                    <textarea
                      ref={editingTextareaRef}
                      aria-label={`${t("common.edit")} ${note.title}`}
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      rows={3}
                      className="min-h-24 w-full resize-y rounded-md border border-border bg-bg-surface px-3 py-2.5 text-base text-text-primary outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          closeEditing();
                        }}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11"
                        disabled={pending || !editingValue.trim()}
                        onClick={() => saveEdit(note)}
                      >
                        {pending ? t("common.saving") : t("common.save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium break-words text-text-primary">
                          {note.title}
                        </p>
                        {note.body ? (
                          <p className="mt-1 line-clamp-3 text-small break-words text-text-secondary">
                            {note.body}
                          </p>
                        ) : null}
                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-caption text-text-muted">
                          <span>{formatNoteTime(note.updated_at, locale)}</span>
                          {note.linked_task_id ? (
                            <span className="inline-flex items-center gap-1 font-medium text-success-500">
                              <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              {t("inbox.noteLinkedTask")}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <details className="relative shrink-0">
                        <summary
                          ref={(element) => {
                            if (element) noteActionsRefs.current.set(note.id, element);
                            else noteActionsRefs.current.delete(note.id);
                          }}
                          aria-label={t("inbox.noteActions", { title: note.title })}
                          className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none"
                        >
                          <MoreHorizontal className="size-5" aria-hidden="true" />
                        </summary>
                        <div className="absolute right-0 z-20 mt-1 grid w-44 gap-1 rounded-lg border border-border bg-bg-surface p-1.5 shadow-lg">
                          <button
                            type="button"
                            className="flex min-h-11 items-center gap-2 rounded-md px-2.5 text-left text-small text-text-primary hover:bg-bg-subtle"
                            onClick={() => {
                              editingNoteIdForFocus.current = note.id;
                              setEditingId(note.id);
                              setEditingValue(joinNoteContent(note));
                            }}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                            {t("common.edit")}
                          </button>
                          {!note.linked_task_id ? (
                            <button
                              type="button"
                              className="flex min-h-11 items-center gap-2 rounded-md px-2.5 text-left text-small text-text-primary hover:bg-bg-subtle"
                              onClick={() => setConvertingId(note.id)}
                            >
                              <WandSparkles className="size-4" aria-hidden="true" />
                              {t("inbox.convertToTask")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="flex min-h-11 items-center gap-2 rounded-md px-2.5 text-left text-small text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
                            onClick={() => archive(note)}
                          >
                            <Archive className="size-4" aria-hidden="true" />
                            {t("inbox.archive")}
                          </button>
                        </div>
                      </details>
                    </div>

                    {convertingId === note.id ? (
                      <div className="mt-3 rounded-lg bg-brand-50 p-3">
                        <p className="text-small font-medium text-text-primary">
                          {t("inbox.convertPrompt")}
                        </p>
                        <div className="mt-3">
                          <label
                            htmlFor={`note-domain-${note.id}`}
                            className="mb-1 block text-caption font-medium text-text-secondary"
                          >
                            {t("inbox.area")}
                          </label>
                          <select
                            id={`note-domain-${note.id}`}
                            value={convertDomain}
                            onChange={(event) => setConvertDomain(event.target.value as Domain)}
                            disabled={pending}
                            className="h-11 w-full rounded-md border border-border bg-bg-surface px-3 text-base text-text-primary outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
                          >
                            {DOMAINS.map((domain) => (
                              <option key={domain} value={domain}>
                                {t(`domains.${domain}`)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-11"
                            onClick={() => setConvertingId(null)}
                          >
                            {t("common.cancel")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11"
                            disabled={pending}
                            onClick={() => convert(note)}
                          >
                            {t("inbox.convertConfirm")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>

          {hiddenCount > 0 || showAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 min-h-11"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll
                ? t("inbox.showLessNotes")
                : t("inbox.showMoreNotes", { count: hiddenCount })}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function splitNoteContent(content: string) {
  const normalized = content.trim();
  const newlineIndex = normalized.indexOf("\n");
  const firstLine = newlineIndex >= 0 ? normalized.slice(0, newlineIndex).trim() : normalized;
  const initialBody = newlineIndex >= 0 ? normalized.slice(newlineIndex + 1).trim() : "";
  const title = firstLine.slice(0, 200).trim();
  const overflow = firstLine.slice(200).trim();
  const body = [overflow, initialBody].filter(Boolean).join("\n");

  return {
    title: title || normalized.slice(0, 200),
    body: body || null,
  };
}

function joinNoteContent(note: Note) {
  return [note.title, note.body].filter(Boolean).join("\n");
}

function formatNoteTime(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}
