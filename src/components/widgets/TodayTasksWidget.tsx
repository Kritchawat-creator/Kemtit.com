import { CheckSquare, Flame } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { listParentCandidates } from "@/core/goals/queries";
import { getDayPlan, getStreak } from "@/core/tasks/queries";
import type { ISODate } from "@/lib/date";
import { EmptyState } from "@/components/domain/EmptyState";
import { TaskList } from "@/components/domain/TaskList";
import { Button } from "@/components/ui/button";

import { WidgetShell } from "./WidgetShell";

/** widget งานวันนี้ (Design §6.3): ค้าง / ต้องทำ / เสร็จ + streak — ติ๊กได้ในที่ */
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
      description={items.length > 0 ? t("summary", { due: plan.due.length, overdue: plan.overdue.length, done: plan.done.length }) : undefined}
      action={
        <div className="flex items-center gap-2">
          {streak > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-caption text-warning-800">
              <Flame className="size-3" aria-hidden="true" />
              {t("streak", { days: streak })}
            </span>
          ) : null}
          <Button variant="ghost" size="sm" asChild>
            <Link href="?new=task" scroll={false}>
              {t("add")}
            </Link>
          </Button>
        </div>
      }
    >
      <TaskList
        items={items}
        today={today}
        goalOptions={goalOptions}
        showGoal
        emptyState={
          <EmptyState
            icon={CheckSquare}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <Button asChild>
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
