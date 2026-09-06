"use client";

import { Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import type { DayTaskItem } from "@/core/domain/dayplan";
import { parseRRule } from "@/core/domain/recurrence";
import type { TaskWithGoal } from "@/core/tasks/schema";
import type { ISODate } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";

import { DomainTag } from "./DomainTag";

export type TaskRowProps = {
  item: DayTaskItem<TaskWithGoal>;
  today: ISODate;
  onToggle: (item: DayTaskItem<TaskWithGoal>, done: boolean) => void;
  onOpen?: (item: DayTaskItem<TaskWithGoal>) => void;
  showGoal?: boolean;
};

/**
 * 1 บรรทัด task (Claude Design 3o TaskRow): checkbox วงกลม 24px ในพื้นที่แตะ 44px · ชื่อ + meta · DomainTag ขวา
 * ติ๊กแล้ว = วงกลม success-500 มีถูก ชื่อขีดฆ่า · เลยกำหนด = meta สี danger · แตะแถวเพื่อเปิดรายละเอียด (Design §8.5)
 */
export function TaskRow({ item, today, onToggle, onOpen, showGoal = false }: TaskRowProps) {
  const t = useTranslations();
  const { task } = item;
  const rule = parseRRule(task.recurrence_rule);
  const checkboxId = `task-${item.key}`;

  return (
    <li className="flex min-h-14 items-center gap-2 py-1.5">
      <span className="-ml-2.5 flex size-11 shrink-0 items-center justify-center">
        <Checkbox
          id={checkboxId}
          checked={item.done}
          onCheckedChange={(value) => onToggle(item, value === true)}
          aria-label={t("a11y.toggleTask", { title: task.title })}
          className="size-6 rounded-full border-[1.5px] border-brand-200 transition-all duration-150 data-[state=checked]:border-success-500 data-[state=checked]:bg-success-500 data-[state=checked]:text-neutral-0"
        />
      </span>
      <button
        type="button"
        onClick={onOpen ? () => onOpen(item) : undefined}
        disabled={!onOpen}
        aria-label={onOpen ? t("a11y.openTask", { title: task.title }) : undefined}
        className="min-w-0 flex-1 rounded-md text-left focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:cursor-default"
      >
        <span
          className={cn(
            "block truncate text-body transition-all duration-150",
            item.done ? "text-text-muted line-through" : "text-text-primary",
          )}
        >
          {task.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-text-secondary">
          {rule ? (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3" aria-hidden="true" />
              {rule.freq === "DAILY"
                ? t("tasks.recurrence.badgeDaily")
                : t("tasks.recurrence.badgeWeekly")}
            </span>
          ) : null}
          {item.overdue ? (
            <span className="text-danger-800">
              {t("tasks.meta.overdueSince", { date: formatThaiDate(item.date, "short") })}
            </span>
          ) : item.date !== today ? (
            <span>{formatThaiDate(item.date, "weekday")}</span>
          ) : null}
          {showGoal && task.goal ? (
            <span className="truncate">{t("tasks.meta.goal", { title: task.goal.title })}</span>
          ) : null}
        </span>
      </button>
      <DomainTag domain={task.domain} />
    </li>
  );
}
