"use client";

import { CalendarClock, Check, Pencil, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import type { DayTaskItem } from "@/core/domain/dayplan";
import { parseRRule } from "@/core/domain/recurrence";
import type { ParentCandidate } from "@/core/goals/schema";
import { deleteTask, rescheduleTask, toggleTask } from "@/core/tasks/actions";
import type { TaskWithGoal } from "@/core/tasks/schema";
import { addDaysISO, type ISODate } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

import { Celebration } from "./Celebration";
import { DatePicker } from "./DatePicker";
import { DomainTag } from "./DomainTag";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";

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
};

const UNDO_MS = 5000;

/**
 * รายการ task พร้อม optimistic toggle, รายละเอียดใน Sheet (ติ๊ก/เลื่อนวัน/แก้/ลบ) และ undo toast แทน confirm
 * ข้อมูลจริงมาจาก server; override ในเครื่องถูกล้างเมื่อ props เปลี่ยน (หลัง router.refresh)
 */
export function TaskList({ items, today, goalOptions, groupByStatus = true, showGoal = false, emptyState }: TaskListProps) {
  const t = useTranslations();
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setOverrides({});
  }
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [fireKey, setFireKey] = useState(0);
  const [, startTransition] = useTransition();
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const visible = items
    .map((item) => ({ ...item, done: overrides[item.key]?.done ?? item.done, hidden: overrides[item.key]?.hidden ?? false }))
    .filter((item) => !item.hidden);
  const selected = visible.find((i) => i.key === selectedKey) ?? null;

  const setOverride = (key: string, patch: Override) =>
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  function toggle(item: Item, done: boolean) {
    setOverride(item.key, { done });
    startTransition(async () => {
      const result = await toggleTask({ id: item.task.id, date: item.date, done });
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

  function remove(item: Item) {
    setSelectedKey(null);
    setOverride(item.key, { hidden: true });
    const timer = setTimeout(() => {
      deleteTimers.current.delete(item.key);
      startTransition(async () => {
        const result = await deleteTask({ id: item.task.id });
        if (!result.ok) {
          setOverride(item.key, { hidden: false });
          toast.error(t("errors.generic"));
          return;
        }
        router.refresh();
      });
    }, UNDO_MS);
    deleteTimers.current.set(item.key, timer);
    toast(t("tasks.toasts.deleted", { title: item.task.title }), {
      duration: UNDO_MS,
      action: {
        label: t("common.undo"),
        onClick: () => {
          const pending = deleteTimers.current.get(item.key);
          if (pending) clearTimeout(pending);
          deleteTimers.current.delete(item.key);
          setOverride(item.key, { hidden: false });
          toast.success(t("tasks.toasts.restored", { title: item.task.title }));
        },
      },
    });
  }

  function reschedule(item: Item, dueDate: ISODate) {
    startTransition(async () => {
      const result = await rescheduleTask({ id: item.task.id, dueDate });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("tasks.toasts.rescheduled", { date: formatThaiDate(dueDate, "medium") }));
      setSelectedKey(null);
      setPicking(false);
      router.refresh();
    });
  }

  function closeDetail() {
    setSelectedKey(null);
    setEditing(false);
    setPicking(false);
  }

  const sections: { key: string; label: string; items: typeof visible }[] = groupByStatus
    ? [
        { key: "overdue", label: t("tasks.sections.overdue"), items: visible.filter((i) => i.overdue && !i.done) },
        { key: "due", label: t("tasks.sections.due"), items: visible.filter((i) => !i.overdue && !i.done) },
        { key: "done", label: t("tasks.sections.done"), items: visible.filter((i) => i.done) },
      ].filter((s) => s.items.length > 0)
    : [{ key: "all", label: "", items: visible }];

  if (visible.length === 0) return <>{emptyState ?? null}</>;

  const selectedRule = selected ? parseRRule(selected.task.recurrence_rule) : null;

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.key} aria-label={section.label || undefined}>
          {section.label ? (
            <h3 className="mb-1 px-3 text-caption text-text-secondary">
              {section.label} · {section.items.length}
            </h3>
          ) : null}
          <ul className="divide-y divide-border rounded-lg border border-border bg-bg-surface">
            {section.items.map((item) => (
              <TaskRow key={item.key} item={item} today={today} onToggle={toggle} onOpen={(i) => setSelectedKey(i.key)} showGoal={showGoal} />
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
              dueDate: selected.task.due_date,
              domain: selected.task.domain,
              recurrence: selectedRule ? (selectedRule.freq === "DAILY" ? "daily" : "weekly") : "none",
              weekdays: selectedRule?.freq === "WEEKLY" ? selectedRule.byDay : [],
              goalId: selected.task.goal_id,
            }}
            goalOptions={goalOptions}
            onDone={closeDetail}
          />
        ) : selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-small text-text-secondary">
              <DomainTag domain={selected.task.domain} />
              <span>{selected.overdue ? t("tasks.meta.overdueSince", { date: formatThaiDate(selected.date, "medium") }) : t("tasks.meta.due", { date: formatThaiDate(selected.date, "medium") })}</span>
              {selectedRule ? <span>{selectedRule.freq === "DAILY" ? t("tasks.recurrence.daily") : t("tasks.recurrence.weekly")}</span> : null}
              {selected.task.goal ? <span>{t("tasks.meta.goal", { title: selected.task.goal.title })}</span> : null}
            </div>

            <Button size="lg" className="w-full" variant={selected.done ? "outline" : "default"} onClick={() => toggle(selected, !selected.done)}>
              {selected.done ? <Undo2 aria-hidden="true" /> : <Check aria-hidden="true" />}
              {selected.done ? t("tasks.markUndone") : t("tasks.markDone")}
            </Button>

            <div>
              <p className="mb-2 text-caption text-text-secondary">{t("tasks.reschedule.label")}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => reschedule(selected, addDaysISO(today, 1))}>
                  <CalendarClock aria-hidden="true" />
                  {t("tasks.reschedule.tomorrow")}
                </Button>
                <Button variant="outline" onClick={() => reschedule(selected, addDaysISO(today, 7))}>
                  {t("tasks.reschedule.nextWeek")}
                </Button>
                <Button variant="outline" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>
                  {t("tasks.reschedule.pickDate")}
                </Button>
              </div>
              {picking ? (
                <div className="mt-2">
                  <DatePicker value={selected.task.due_date} onChange={(next) => next && reschedule(selected, next)} />
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {t("common.edit")}
              </Button>
              <Button variant="ghost" className="flex-1 text-danger-800 hover:bg-danger-50 hover:text-danger-800" onClick={() => remove(selected)}>
                <Trash2 aria-hidden="true" />
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
