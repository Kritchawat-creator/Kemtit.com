"use client";

import { RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { restoreNote } from "@/core/notes/actions";
import { restoreProject } from "@/core/projects/actions";
import { restoreTask } from "@/core/tasks/actions";
import { restoreGoal } from "@/core/goals/actions";
import type { ActionResult } from "@/core/shared/result";
import type { Database } from "@/types/database";
import type { AppLocale } from "@/i18n/config";
import { toBkkDate, type ISODate } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

export type ArchivedTask = Pick<
  TaskRow,
  | "id"
  | "title"
  | "due_date"
  | "planned_date"
  | "completed_at"
  | "recurrence_rule"
  | "archived_at"
  | "archived_from_status"
>;
export type ArchivedProject = Pick<
  ProjectRow,
  "id" | "title" | "archived_at" | "archived_from_status"
>;
export type ArchivedNote = Pick<NoteRow, "id" | "title" | "body" | "note_date" | "archived_at">;
export type ArchivedGoal = Pick<
  GoalRow,
  "id" | "title" | "status" | "archived_at" | "archived_from_status"
>;

export function ArchiveList({
  tasks,
  projects,
  notes,
  goals,
  pageIndex,
  tasksHaveMore,
  projectsHaveMore,
  notesHaveMore,
  goalsHaveMore,
}: {
  tasks: ArchivedTask[];
  projects: ArchivedProject[];
  notes: ArchivedNote[];
  goals: ArchivedGoal[];
  pageIndex: number;
  tasksHaveMore: boolean;
  projectsHaveMore: boolean;
  notesHaveMore: boolean;
  goalsHaveMore: boolean;
}) {
  const t = useTranslations("archive");
  const errorT = useTranslations("errors");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasAnyItems = tasks.length + projects.length + notes.length + goals.length > 0;
  const hasMore = tasksHaveMore || projectsHaveMore || notesHaveMore || goalsHaveMore;

  function restore(kind: "task" | "project" | "note" | "goal", id: string, title: string) {
    startTransition(async () => {
      try {
        let result: ActionResult;
        if (kind === "task") result = await restoreTask({ id });
        else if (kind === "project") result = await restoreProject({ id });
        else if (kind === "note") result = await restoreNote({ id });
        else result = await restoreGoal({ id });

        if (!result.ok) {
          toast.error(errorT("generic"));
          router.refresh();
          return;
        }
        toast.success(t("restored", { title }));
        router.refresh();
      } catch {
        // A disconnected client may not know whether the server committed the
        // restore. Refresh before offering another attempt to avoid false feedback.
        toast.error(t("restoreUncertain"));
        router.refresh();
      }
    });
  }

  function restoreButton(kind: "task" | "project" | "note" | "goal", id: string, title: string) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        aria-label={`${t("restore")} ${title}`}
        onClick={() => restore(kind, id, title)}
      >
        <RotateCcw aria-hidden="true" />
        {t("restore")}
      </Button>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {!hasAnyItems ? (
        <p className="rounded-xl border border-border bg-bg-surface p-6 text-small text-text-secondary shadow-xs">
          {t("empty")}
        </p>
      ) : null}

      {goals.length > 0 ? (
        <section aria-labelledby="archive-goals-heading" className="min-w-0">
          <h2 id="archive-goals-heading" className="mb-3 text-h2 text-text-primary">
            {t("goals")}
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-bg-surface px-4 shadow-xs">
            {goals.map((goal) => (
              <li key={goal.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <Link
                    className="break-words text-body font-medium text-text-primary underline-offset-2 hover:underline"
                    href={`/goals/${goal.id}`}
                  >
                    {goal.title}
                  </Link>
                  {goal.archived_from_status === null ? (
                    <p className="mt-1 text-caption text-text-secondary">
                      {t("legacyGoalStatusHint")}
                    </p>
                  ) : null}
                </div>
                {restoreButton("goal", goal.id, goal.title)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tasks.length > 0 ? (
        <section aria-labelledby="archive-tasks-heading" className="min-w-0">
          <h2 id="archive-tasks-heading" className="mb-3 text-h2 text-text-primary">
            {t("tasks")}
          </h2>
          <p className="mb-3 text-small text-text-secondary">{t("taskBlocksCancelledHint")}</p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-bg-surface px-4 shadow-xs">
            {tasks.map((task) => {
              const plannedDate = task.planned_date ?? task.due_date;
              return (
                <li key={task.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-body font-medium text-text-primary">{task.title}</p>
                    <p className="mt-1 text-caption text-text-secondary">
                      {task.archived_at
                        ? formatDate(toBkkDate(task.archived_at) as ISODate, "medium", locale)
                        : null}
                      {plannedDate ? ` · ${formatDate(plannedDate, "medium", locale)}` : ""}
                    </p>
                  </div>
                  {restoreButton("task", task.id, task.title)}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {projects.length > 0 ? (
        <section aria-labelledby="archive-projects-heading" className="min-w-0">
          <h2 id="archive-projects-heading" className="mb-3 text-h2 text-text-primary">
            {t("projects")}
          </h2>
          <p className="mb-3 text-small text-text-secondary">
            {t("projectTasksRemainActiveHint")}
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-bg-surface px-4 shadow-xs">
            {projects.map((project) => (
              <li key={project.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-body font-medium text-text-primary">{project.title}</p>
                  {project.archived_from_status === null ? (
                    <p className="mt-1 text-caption text-text-secondary">
                      {t("legacyProjectStatusHint")}
                    </p>
                  ) : null}
                </div>
                {restoreButton("project", project.id, project.title)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {notes.length > 0 ? (
        <section aria-labelledby="archive-notes-heading" className="min-w-0">
          <h2 id="archive-notes-heading" className="mb-3 text-h2 text-text-primary">
            {t("notes")}
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-bg-surface px-4 shadow-xs">
            {notes.map((note) => (
              <li key={note.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-body font-medium text-text-primary">{note.title}</p>
                  <p className="mt-1 line-clamp-2 break-words text-caption text-text-secondary">
                    {formatDate(note.note_date, "medium", locale)}
                    {note.body ? ` · ${note.body}` : ""}
                  </p>
                </div>
                {restoreButton("note", note.id, note.title)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pageIndex > 0 || hasMore ? (
        <nav aria-label={t("title")} className="flex items-center justify-between gap-3">
          {pageIndex > 0 ? (
            <Button asChild type="button" variant="outline">
              <Link href={pageIndex === 1 ? "/archive" : `/archive?page=${pageIndex - 1}`}>
                {t("previousPage")}
              </Link>
            </Button>
          ) : <span />}
          {hasMore ? (
            <Button asChild type="button" variant="outline">
              <Link href={`/archive?page=${pageIndex + 1}`}>{t("nextPage")}</Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
