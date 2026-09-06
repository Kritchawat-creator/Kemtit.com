import { CheckSquare, Flame, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { listParentCandidates } from "@/core/goals/queries";
import { getDayPlan, getStreak } from "@/core/tasks/queries";
import type { ISODate } from "@/lib/date";
import { EmptyState } from "@/components/domain/EmptyState";
import { TaskList } from "@/components/domain/TaskList";
import { Button } from "@/components/ui/button";

import { WidgetShell } from "./WidgetShell";

/** widget งานวันนี้ (Design §6.3 + Claude Design 2a): การ์ดขาว · pill "เสร็จ x/y" + streak · แถวงานติ๊กได้ในที่ */
export async function TodayTasksWidget({ today }: { today: ISODate }) {
  const [t, plan, streak, goalOptions] = await Promise.all([
    getTranslations("widgets.todayTasks"),
    getDayPlan(today),
    getStreak(today),
    listParentCandidates(),
  ]);
  const items = [...plan.overdue, ...plan.due, ...plan.done];

  return (
    <WidgetShell
      title={t("title")}
      description={
        plan.overdue.length > 0 ? t("overdueHint", { overdue: plan.overdue.length }) : undefined
      }
      action={
        <>
          {streak > 0 ? (
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-50 px-2.5 text-caption font-medium text-warning-800">
              <Flame className="size-3" aria-hidden="true" />
              {t("streak", { days: streak })}
            </span>
          ) : null}
          {items.length > 0 ? (
            <span className="inline-flex h-6 items-center rounded-full bg-brand-50 px-2.5 text-caption font-medium text-brand-800">
              {t("doneCount", { done: plan.done.length, total: items.length })}
            </span>
          ) : null}
          <Button variant="ghost" size="icon-sm" className="-mr-2" asChild>
            <Link href="?new=task" scroll={false} aria-label={t("add")}>
              <Plus className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </>
      }
    >
      <TaskList
        items={items}
        today={today}
        goalOptions={goalOptions}
        showGoal
        variant="plain"
        emptyState={
          <EmptyState
            icon={CheckSquare}
            title={t("empty.title")}
            description={t("empty.description")}
            className="py-5 shadow-none"
            action={
              <Button variant="outline" asChild>
                <Link href="?new=task" scroll={false}>
                  {t("empty.cta")}
                </Link>
              </Button>
            }
          />
        }
      />
    </WidgetShell>
  );
}
