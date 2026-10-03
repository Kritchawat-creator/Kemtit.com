"use client";

import { Pencil, Repeat } from "@/components/icons/ui-icons";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { ParentCandidate } from "@/core/goals/schema";
import { parseRRule } from "@/core/domain/recurrence";
import type { TaskWithGoal } from "@/core/tasks/schema";
import type { TaskLibraryView } from "@/core/tasks/queries";
import type { AppLocale } from "@/i18n/config";
import type { ISODate } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DomainTag } from "@/components/domain/DomainTag";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { TaskForm } from "@/components/domain/TaskForm";

type Props = {
  tasks: TaskWithGoal[];
  today: ISODate;
  view: TaskLibraryView;
  hasMore: boolean;
  goalOptions: ParentCandidate[];
  projectOptions: { id: string; title: string }[];
};

export function TaskLibrary({ tasks, today, view, hasMore, goalOptions, projectOptions }: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;

  const overdue = tasks.filter(
    (task) => task.status === "planned" && task.deadline != null && task.deadline < today,
  );
  const overdueIds = new Set(overdue.map((task) => task.id));
  const planned = tasks.filter((task) => task.status === "planned" && !overdueIds.has(task.id));
  const done = tasks.filter((task) => task.status === "completed");
  const groups =
    view === "done"
      ? [{ key: "done", title: t("tasks.library.sections.done"), items: done }]
      : view === "overdue"
        ? [{ key: "overdue", title: t("tasks.library.sections.overdue"), items: overdue }]
        : [
            { key: "overdue", title: t("tasks.library.sections.overdue"), items: overdue },
            { key: "planned", title: t("tasks.library.sections.planned"), items: planned },
            ...(view === "all"
              ? [{ key: "done", title: t("tasks.library.sections.done"), items: done }]
              : []),
          ].filter((group) => group.items.length > 0);

  function closeDetail() {
    setEditing(false);
    setSelectedId(null);
  }

  const selectedRule = selected?.recurrence_rule ? parseRRule(selected.recurrence_rule) : null;

  return (
    <div className="min-w-0 space-y-5">
      {groups.length === 0 ? (
        <p className="rounded-xl border border-border bg-bg-surface p-4 text-small text-text-secondary shadow-sm">
          {t("tasks.library.empty")}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-labelledby={`task-library-${group.key}`}>
            <h2 id={`task-library-${group.key}`} className="mb-2 text-h2 text-text-primary">
              {group.title}{" "}
              <span className="text-small text-text-secondary">· {group.items.length}</span>
            </h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-bg-surface px-4 shadow-sm sm:px-5">
              {group.items.map((task) => {
                const rule = task.recurrence_rule ? parseRRule(task.recurrence_rule) : null;
                const plannedDate = task.planned_date ?? task.due_date;

                return (
                  <li key={task.id} data-task-id={task.id} className="min-w-0 py-4">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          aria-label={t("a11y.openTask", { title: task.title })}
                          onClick={() => setSelectedId(task.id)}
                          className="block w-full min-w-0 rounded-md text-left focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
                        >
                          <span
                            className={`block text-body font-medium break-words ${task.status === "completed" ? "text-text-muted line-through" : "text-text-primary"}`}
                          >
                            {task.title}
                          </span>
                          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption text-text-secondary">
                            <DomainTag domain={task.domain} />
                            <span>
                              {t("inbox.prioritiesLabel", {
                                value: t(`inbox.priorities.${task.priority ?? "normal"}`),
                              })}
                            </span>
                            {rule ? (
                              <span className="inline-flex items-center gap-1">
                                <Repeat className="size-3" aria-hidden="true" />
                                {rule.freq === "DAILY"
                                  ? t("tasks.recurrence.badgeDaily")
                                  : t("tasks.recurrence.badgeWeekly")}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </div>

                      <div className="flex w-full min-w-0 flex-col gap-1 text-caption text-text-secondary sm:w-auto sm:shrink-0 sm:text-right">
                        <span>
                          {t("tasks.library.plannedDate")}:{" "}
                          {plannedDate
                            ? formatDate(plannedDate, "medium", locale)
                            : t("tasks.library.notPlanned")}
                        </span>
                        <span>
                          {t("tasks.library.deadline")}:{" "}
                          {task.deadline
                            ? formatDate(task.deadline, "medium", locale)
                            : t("tasks.library.noDeadline")}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {hasMore ? (
        <p className="rounded-lg bg-brand-50 p-3 text-small text-text-secondary">
          {t("tasks.library.moreResults")}
        </p>
      ) : null}

      <ResponsiveDialog
        open={selected !== null}
        onOpenChange={(open) => !open && closeDetail()}
        title={editing ? t("tasks.edit") : (selected?.title ?? t("tasks.detail"))}
      >
        {selected && editing ? (
          <TaskForm
            mode="edit"
            taskId={selected.id}
            initial={{
              title: selected.title,
              dueDate: selected.due_date ?? today,
              plannedDate: selected.planned_date ?? selected.due_date ?? today,
              deadline: selected.deadline,
              domain: selected.domain,
              recurrence: selectedRule
                ? selectedRule.freq === "DAILY"
                  ? "daily"
                  : "weekly"
                : "none",
              weekdays: selectedRule?.freq === "WEEKLY" ? selectedRule.byDay : [],
              goalId: selected.goal_id,
              projectId: selected.project_id ?? null,
              priority: selected.priority ?? "normal",
              estimatedMinutes: selected.estimated_minutes ?? null,
              notes: selected.notes ?? null,
            }}
            goalOptions={goalOptions}
            projectOptions={projectOptions}
            existingPhotoCount={selected.photos?.length ?? 0}
            onDone={closeDetail}
          />
        ) : selected ? (
          <div className="space-y-5">
            <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-caption font-medium text-text-secondary">
                  {t("tasks.form.plannedDate")}
                </dt>
                <dd className="mt-1 text-body break-words text-text-primary">
                  {(selected.planned_date ?? selected.due_date)
                    ? formatDate(selected.planned_date ?? selected.due_date!, "medium", locale)
                    : t("tasks.library.notPlanned")}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-caption font-medium text-text-secondary">
                  {t("tasks.form.deadline")}
                </dt>
                <dd className="mt-1 text-body break-words text-text-primary">
                  {selected.deadline
                    ? formatDate(selected.deadline, "medium", locale)
                    : t("tasks.library.noDeadline")}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-caption font-medium text-text-secondary">
                  {t("tasks.form.domain")}
                </dt>
                <dd className="mt-1">
                  <DomainTag domain={selected.domain} size="md" />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-caption font-medium text-text-secondary">
                  {t("tasks.form.priority")}
                </dt>
                <dd className="mt-1 text-body break-words text-text-primary">
                  {t(`inbox.priorities.${selected.priority ?? "normal"}`)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-caption font-medium text-text-secondary">
                  {t("tasks.recurrence.label")}
                </dt>
                <dd className="mt-1 text-body break-words text-text-primary">
                  {!selectedRule
                    ? t("tasks.recurrence.none")
                    : selectedRule.freq === "DAILY"
                      ? t("tasks.recurrence.daily")
                      : t("tasks.recurrence.weekly")}
                </dd>
              </div>
            </dl>

            {selected.goal ? (
              <p className="text-small break-words text-text-secondary">
                {t("tasks.meta.goal", { title: selected.goal.title })}
              </p>
            ) : null}
            {selected.notes ? (
              <p className="text-small break-words whitespace-pre-wrap text-text-secondary">
                {selected.notes}
              </p>
            ) : null}
            <Button type="button" className="w-full" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              {t("common.edit")}
            </Button>
          </div>
        ) : null}
      </ResponsiveDialog>
    </div>
  );
}