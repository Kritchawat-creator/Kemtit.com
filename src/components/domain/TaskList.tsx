"use client";

import { Archive, CalendarClock, Check, Pencil, Undo2 } from "@/components/icons/ui-icons";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import type { DayTaskItem } from "@/core/domain/dayplan";
import { parseRRule } from "@/core/domain/recurrence";
import type { ParentCandidate } from "@/core/goals/schema";
import { listProjectOptions } from "@/core/projects/actions";
import {
  archiveTask,
  rescheduleTask,
  rescheduleTaskOccurrence,
  restoreTask,
  skipTaskOccurrence,
  toggleTask,
  toggleTaskOccurrence,
} from "@/core/tasks/actions";
import type { TaskWithGoal } from "@/core/tasks/schema";
import type { AppLocale } from "@/i18n/config";
import { addDaysISO, type ISODate } from "@/lib/date";
import { UPLOADS_ENABLED } from "@/lib/flags";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

import { Celebration } from "./Celebration";
import { DatePicker } from "./DatePicker";
import { DomainTag } from "./DomainTag";
import { TaskForm } from "./TaskForm";
import { TaskPhotoStrip } from "./TaskPhotos";
import { TaskRow, type TaskAttachmentsMode } from "./TaskRow";
import { TaskSubtaskList } from "./TaskSubtaskList";
import { getTaskDateDisplay } from "./task-date-display";

type Item = DayTaskItem<TaskWithGoal>;
type Override = { done?: boolean; hidden?: boolean };

export type TaskListProps = {
  items: Item[];
  today: ISODate;
  goalOptions: ParentCandidate[];
  /** แยกกลุ่ม ค้าง / ต้องทำ / เสร็จแล้ว (Design §8.5) */
  groupByStatus?: boolean;
  showGoal?: boolean;
  emptyState?: ReactNode;
  /** card = การ์ดขาวมีเงาของตัวเอง · plain = แถวเปล่า ๆ สำหรับวางใน widget ที่เป็นการ์ดอยู่แล้ว */
  variant?: "card" | "plain";
  /** รูปแนบท้ายแถว (Design §6A.3): icon = dashboard/ปฏิทิน (ค่าเริ่มต้น) · stack = goal detail — ซ่อนทั้งหมดเมื่อ flag uploads ปิด */
  attachments?: Exclude<TaskAttachmentsMode, "none">;
};

const UNDO_MS = 5000;

/**
 * รายการ task พร้อม optimistic toggle, รายละเอียดใน Sheet (ติ๊ก/เลื่อนวัน/แก้/ลบ) และ undo toast แทน confirm
 * ข้อมูลจริงมาจาก server; override ในเครื่องถูกล้างเมื่อ props เปลี่ยน (หลัง router.refresh)
 */
export function TaskList({
  items,
  today,
  goalOptions,
  groupByStatus = true,
  showGoal = false,
  emptyState,
  variant = "card",
  attachments = "icon",
}: TaskListProps) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const attachmentsMode: TaskAttachmentsMode = UPLOADS_ENABLED ? attachments : "none";
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setOverrides({});
  }
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [projectOptions, setProjectOptions] = useState<{ id: string; title: string }[]>([]);
  const [projectOptionsLoaded, setProjectOptionsLoaded] = useState(false);
  const [picking, setPicking] = useState(false);
  const [fireKey, setFireKey] = useState(0);
  const [, startTransition] = useTransition();

  const visible = items
    .map((item) => ({
      ...item,
      done: overrides[item.key]?.done ?? item.done,
      hidden: overrides[item.key]?.hidden ?? false,
    }))
    .filter((item) => !item.hidden);
  const selected = visible.find((i) => i.key === selectedKey) ?? null;
  const selectedDateDisplay = selected ? getTaskDateDisplay(selected, today) : null;

  const setOverride = (key: string, patch: Override) =>
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  function toggle(item: Item, done: boolean) {
    setOverride(item.key, { done });
    startTransition(async () => {
      const result = item.recurring
        ? await toggleTaskOccurrence({
            id: item.task.id,
            occurrenceDate: item.occurrenceDate ?? item.date,
            date: item.date,
            done,
          })
        : await toggleTask({ id: item.task.id, date: item.date, done });
      if (!result.ok) {
        setOverride(item.key, { done: !done });
        toast.error(t("errors.generic"));
        return;
      }
      for (const goal of result.data.completedGoals) {
        toast.success(t("tasks.toasts.goalCompleted", { title: goal.title }));
        setFireKey((k) => k + 1);
      }
      router.refresh();
    });
  }

  function archive(item: Item) {
    setSelectedKey(null);
    setOverride(item.key, { hidden: true });
    startTransition(async () => {
      const result = await archiveTask({ id: item.task.id });
      if (!result.ok) {
        setOverride(item.key, { hidden: false });
        toast.error(t("errors.generic"));
        return;
      }
      router.refresh();
      toast(t("tasks.toasts.archived", { title: item.task.title }), {
        duration: UNDO_MS,
        action: {
          label: t("common.undo"),
          onClick: () =>
            startTransition(async () => {
              const restored = await restoreTask({ id: item.task.id });
              if (!restored.ok) {
                toast.error(t("errors.generic"));
                router.refresh();
                return;
              }
              toast.success(t("tasks.toasts.restored", { title: item.task.title }));
              router.refresh();
            }),
        },
      });
    });
  }

  function reschedule(item: Item, dueDate: ISODate) {
    startTransition(async () => {
      const result = item.recurring
        ? await rescheduleTaskOccurrence({
            id: item.task.id,
            occurrenceDate: item.occurrenceDate ?? item.date,
            newDate: dueDate,
          })
        : await rescheduleTask({ id: item.task.id, dueDate });
      if (!result.ok) {
        const errorMessage =
          result.error === "occurrenceConflict"
            ? t("errors.occurrenceConflict")
            : result.error === "timeBlockConflict"
              ? t("errors.timeBlockConflict")
              : result.error === "timeBlockLocked"
                ? t("errors.timeBlockLocked")
                : result.error === "timeBlockAnchorMissing"
                  ? t("errors.timeBlockAnchorMissing")
                  : result.error === "timeBlockAnchorMismatch"
                    ? t("errors.timeBlockAnchorMismatch")
                    : t("errors.generic");
        toast.error(errorMessage);
        return;
      }
      toast.success(t("tasks.toasts.rescheduled", { date: formatDate(dueDate, "medium", locale) }));
      setSelectedKey(null);
      setPicking(false);
      router.refresh();
    });
  }

  function skip(item: Item) {
    if (!item.recurring) return;
    startTransition(async () => {
      const result = await skipTaskOccurrence({
        id: item.task.id,
        occurrenceDate: item.occurrenceDate ?? item.date,
        date: item.date,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("tasks.reschedule.skipped"));
      setSelectedKey(null);
      router.refresh();
    });
  }

  function beginEditing() {
    startTransition(async () => {
      if (!projectOptionsLoaded) {
        const result = await listProjectOptions();
        if (!result.ok) {
          toast.error(t("errors.generic"));
          return;
        }
        setProjectOptions(result.data);
        setProjectOptionsLoaded(true);
      }
      setEditing(true);
    });
  }

  function closeDetail() {
    setSelectedKey(null);
    setEditing(false);
    setPicking(false);
  }

  const sections: { key: string; label: string; items: typeof visible }[] = groupByStatus
    ? [
        {
          key: "overdue",
          label: t("tasks.sections.overdue"),
          items: visible.filter((i) => i.overdue && !i.done && !i.skipped),
        },
        {
          key: "due",
          label: t("tasks.sections.due"),
          items: visible.filter((i) => !i.overdue && !i.done && !i.skipped),
        },
        {
          key: "done",
          label: t("tasks.sections.done"),
          items: visible.filter((i) => i.done || i.skipped),
        },
      ].filter((s) => s.items.length > 0)
    : [{ key: "all", label: "", items: visible }];

  if (visible.length === 0) return <>{emptyState ?? null}</>;

  const selectedRule = selected ? parseRRule(selected.task.recurrence_rule) : null;

  return (
    <div className={variant === "card" ? "space-y-4" : "space-y-3"}>
      {sections.map((section) => (
        <section key={section.key} aria-label={section.label || undefined}>
          {section.label ? (
            <h3 className="mb-1 text-caption font-medium text-text-secondary">
              {section.label} · {section.items.length}
            </h3>
          ) : null}
          <ul
            className={
              variant === "card"
                ? "divide-y divide-border rounded-xl border border-border bg-bg-surface px-5 shadow-md"
                : "divide-y divide-border"
            }
          >
            {section.items.map((item) => (
              <TaskRow
                key={item.key}
                item={item}
                today={today}
                onToggle={toggle}
                onOpen={(i) => setSelectedKey(i.key)}
                showGoal={showGoal}
                attachments={attachmentsMode}
              />
            ))}
          </ul>
        </section>
      ))}

      <ResponsiveDialog
        open={selected !== null}
        onOpenChange={(open) => !open && closeDetail()}
        title={editing ? t("tasks.edit") : (selected?.task.title ?? t("tasks.detail"))}
      >
        {selected && editing ? (
          <TaskForm
            mode="edit"
            taskId={selected.task.id}
            initial={{
              title: selected.task.title,
              dueDate: selected.task.due_date ?? today,
              plannedDate: selected.task.planned_date ?? selected.task.due_date ?? today,
              deadline: selected.task.deadline,
              domain: selected.task.domain,
              recurrence: selectedRule
                ? selectedRule.freq === "DAILY"
                  ? "daily"
                  : "weekly"
                : "none",
              weekdays: selectedRule?.freq === "WEEKLY" ? selectedRule.byDay : [],
              goalId: selected.task.goal_id,
              projectId: selected.task.project_id ?? null,
              priority: selected.task.priority ?? "normal",
              estimatedMinutes: selected.task.estimated_minutes ?? null,
              notes: selected.task.notes ?? null,
            }}
            goalOptions={goalOptions}
            projectOptions={projectOptions}
            existingPhotoCount={selected.task.photos?.length ?? 0}
            onDone={closeDetail}
          />
        ) : selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-small text-text-secondary">
              <DomainTag domain={selected.task.domain} size="md" />
              <span>
                {t("tasks.library.plannedDate")}:{" "}
                {selectedDateDisplay?.plannedDate
                  ? formatDate(selectedDateDisplay.plannedDate, "medium", locale)
                  : t("tasks.library.notPlanned")}
              </span>
              <span>
                {t("tasks.library.deadline")}:{" "}
                {selectedDateDisplay?.deadline
                  ? formatDate(selectedDateDisplay.deadline, "medium", locale)
                  : t("tasks.library.noDeadline")}
              </span>
              {selectedDateDisplay?.overdueSince ? (
                <span className="text-danger-800">
                  {t("tasks.meta.overdueSince", {
                    date: formatDate(selectedDateDisplay.overdueSince, "medium", locale),
                  })}
                </span>
              ) : null}
              {selectedRule ? (
                <span>
                  {selectedRule.freq === "DAILY"
                    ? t("tasks.recurrence.daily")
                    : t("tasks.recurrence.weekly")}
                </span>
              ) : null}
              {selected.task.goal ? (
                <span>{t("tasks.meta.goal", { title: selected.task.goal.title })}</span>
              ) : null}
            </div>

            {selected.actionable !== false ? (
              <Button
                size="lg"
                className="w-full"
                variant={selected.done ? "outline" : "default"}
                onClick={() => toggle(selected, !selected.done)}
              >
                {selected.done ? <Undo2 aria-hidden="true" /> : <Check aria-hidden="true" />}
                {selected.done ? t("tasks.markUndone") : t("tasks.markDone")}
              </Button>
            ) : null}

            {selectedRule && selected.actionable !== false && !selected.done ? (
              <div>
                <p className="mb-1 text-caption font-medium text-text-secondary">
                  {t("tasks.reschedule.label")}
                </p>
                <p className="text-small text-text-secondary">
                  {t("tasks.reschedule.recurringHint")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.date !== today ? (
                    <Button variant="outline" onClick={() => reschedule(selected, today)}>
                      <CalendarClock aria-hidden="true" />
                      {t("tasks.reschedule.today")}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => reschedule(selected, addDaysISO(selected.date, 1))}
                  >
                    <CalendarClock aria-hidden="true" />
                    {t("tasks.reschedule.tomorrow")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => reschedule(selected, addDaysISO(selected.date, 7))}
                  >
                    {t("tasks.reschedule.nextWeek")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPicking((v) => !v)}
                    aria-expanded={picking}
                  >
                    {t("tasks.reschedule.pickDate")}
                  </Button>
                  <Button variant="ghost" onClick={() => skip(selected)}>
                    {t("tasks.reschedule.skip")}
                  </Button>
                </div>
                {picking ? (
                  <div className="mt-2">
                    <DatePicker
                      value={selected.date}
                      onChange={(next) => next && reschedule(selected, next)}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <p className="mb-2 text-caption font-medium text-text-secondary">
                  {t("tasks.reschedule.label")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.date !== today && !selected.done ? (
                    <Button variant="outline" onClick={() => reschedule(selected, today)}>
                      <CalendarClock aria-hidden="true" />
                      {t("tasks.reschedule.today")}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => reschedule(selected, addDaysISO(today, 1))}
                  >
                    <CalendarClock aria-hidden="true" />
                    {t("tasks.reschedule.tomorrow")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => reschedule(selected, addDaysISO(today, 7))}
                  >
                    {t("tasks.reschedule.nextWeek")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPicking((v) => !v)}
                    aria-expanded={picking}
                  >
                    {t("tasks.reschedule.pickDate")}
                  </Button>
                </div>
                {picking ? (
                  <div className="mt-2">
                    <DatePicker
                      value={selected.task.due_date ?? today}
                      onChange={(next) => next && reschedule(selected, next)}
                    />
                  </div>
                ) : null}
              </div>
            )}

            {UPLOADS_ENABLED ? (
              <TaskPhotoStrip taskId={selected.task.id} photos={selected.task.photos ?? []} />
            ) : null}

            <TaskSubtaskList taskId={selected.task.id} />

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={beginEditing}>
                <Pencil aria-hidden="true" />
                {t("common.edit")}
              </Button>
              <Button
                variant="ghost"
                className="flex-1 text-danger-800 hover:bg-danger-50 hover:text-danger-800"
                onClick={() => archive(selected)}
              >
                <Archive aria-hidden="true" />
                {t("tasks.deleteTask")}
              </Button>
            </div>
          </div>
        ) : null}
      </ResponsiveDialog>

      <Celebration fireKey={fireKey} />
    </div>
  );
}
