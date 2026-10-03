"use client";

import { Archive, CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { archiveTask, planInboxTask, restoreTask } from "@/core/tasks/actions";
import type { TaskWithGoal } from "@/core/tasks/schema";
import type { AppLocale } from "@/i18n/config";
import type { ISODate } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { DatePicker } from "@/components/domain/DatePicker";
import { Button } from "@/components/ui/button";
import { DomainTag } from "@/components/domain/DomainTag";

const UNDO_MS = 5000;

export function InboxList({
  tasks,
  today,
  embedded = false,
}: {
  tasks: TaskWithGoal[];
  today: ISODate;
  embedded?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();

  function plan(id: string, dueDate: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await planInboxTask({ id, dueDate });
      setPendingId(null);
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("inbox.planned"));
      router.refresh();
    });
  }

  function archive(task: TaskWithGoal) {
    setHiddenIds((current) => {
      const next = new Set(current);
      next.add(task.id);
      return next;
    });

    setPendingId(task.id);
    startTransition(async () => {
      const result = await archiveTask({ id: task.id });
      setPendingId(null);
      if (!result.ok) {
        setHiddenIds((current) => {
          const next = new Set(current);
          next.delete(task.id);
          return next;
        });
        toast.error(t("errors.generic"));
        return;
      }
      router.refresh();
      toast(t("tasks.toasts.archived", { title: task.title }), {
        duration: UNDO_MS,
        action: {
          label: t("common.undo"),
          onClick: () =>
            startTransition(async () => {
              const restored = await restoreTask({ id: task.id });
              if (!restored.ok) {
                toast.error(t("errors.generic"));
                router.refresh();
                return;
              }
              toast.success(t("tasks.toasts.restored", { title: task.title }));
              router.refresh();
            }),
        },
      });
    });
  }

  const visibleTasks = tasks.filter((task) => !hiddenIds.has(task.id));

  if (visibleTasks.length === 0) {
    return (
      <p
        className={
          embedded
            ? "rounded-lg bg-bg-subtle p-4 text-small text-text-secondary"
            : "rounded-xl border border-border bg-bg-surface p-4 text-small text-text-secondary shadow-xs"
        }
      >
        {t("inbox.empty")}
      </p>
    );
  }

  return (
    <ul
      className={
        embedded
          ? "@container/inbox-list divide-y divide-border"
          : "@container/inbox-list divide-y divide-border rounded-xl border border-border bg-bg-surface px-4 shadow-xs"
      }
    >
      {visibleTasks.map((task) => (
        <li
          key={task.id}
          data-task-id={task.id}
          className="flex min-w-0 flex-col gap-3 py-4 @min-[42rem]/inbox-list:flex-row @min-[42rem]/inbox-list:items-center"
        >
          <div className="min-w-0 @min-[42rem]/inbox-list:flex-1">
            <p className="text-body font-medium break-words text-text-primary">{task.title}</p>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <DomainTag domain={task.domain} />
              <span className="text-caption text-text-secondary">
                {t("inbox.prioritiesLabel", {
                  value: t(`inbox.priorities.${task.priority ?? "normal"}`),
                })}
              </span>
            </div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-1 gap-2 @min-[26rem]/inbox-list:flex @min-[26rem]/inbox-list:flex-wrap @min-[26rem]/inbox-list:items-center @min-[42rem]/inbox-list:w-auto">
            <label className="sr-only" htmlFor={`inbox-date-${task.id}`}>
              {t("inbox.planDate")}
            </label>
            <DatePicker
              id={`inbox-date-${task.id}`}
              value={today}
              disabled={pendingId === task.id}
              className="h-12 w-full @min-[26rem]/inbox-list:h-11 @min-[26rem]/inbox-list:w-[170px]"
              onChange={(next) => next && plan(task.id, next)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full @min-[26rem]/inbox-list:w-auto"
              disabled={pendingId === task.id}
              onClick={() => plan(task.id, today)}
            >
              <CalendarDays aria-hidden="true" />
              {t("inbox.planToday")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-label={t("tasks.deleteTask")}
              className="w-full @min-[26rem]/inbox-list:w-auto"
              disabled={pendingId === task.id}
              onClick={() => archive(task)}
            >
              <Archive aria-hidden="true" />
              {t("tasks.deleteTask")}
            </Button>
          </div>
          <span className="sr-only">{formatDate(today, "medium", locale)}</span>
        </li>
      ))}
    </ul>
  );
}
