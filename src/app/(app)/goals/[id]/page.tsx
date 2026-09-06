import { ArrowLeft, CheckSquare, ChevronLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";

import { childPeriodType, daysLeft } from "@/core/domain/periods";
import { getGoalDetail, listParentCandidates } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import { getGoalTaskItems } from "@/core/tasks/queries";
import { todayBkk } from "@/lib/date";
import { formatNumber, formatThaiDate, formatValueParts, formatValueWithUnit } from "@/lib/format";
import { CompassDial } from "@/components/domain/CompassDial";
import { DomainTag } from "@/components/domain/DomainTag";
import { EmptyState } from "@/components/domain/EmptyState";
import { GoalCascadeTree } from "@/components/domain/GoalCascadeTree";
import { PaceBadge } from "@/components/domain/PaceBadge";
import { PeriodLabel } from "@/components/domain/PeriodLabel";
import { TaskList } from "@/components/domain/TaskList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { GoalDetailActions } from "./goal-detail-actions";

export async function generateMetadata({ params }: PageProps<"/goals/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getGoalDetail(id);
  return { title: detail?.goal.title ?? (await getTranslations("goals"))("notFound") };
}

/**
 * หน้า detail (Design §8.2 + Claude Design 3k/4c/5a/5c)
 * มือถือ: แถว ‹ ชื่อแม่ → ชื่อ + DomainTag → hero brand-100 (ภาพเป้าหมาย + หน้าปัด) → ปุ่ม → รูปความคืบหน้า → เส้นทาง → งานที่ผูก
 * desktop: header + toolbar (กลับ | แก้ไข/อัปเดตยอด) → hero 4 คอลัมน์ | gallery + เส้นทาง + งาน 8 คอลัมน์
 */
export default async function GoalDetailPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  const [detail, candidates, taskItems, t, tp] = await Promise.all([
    getGoalDetail(id),
    listParentCandidates(),
    getGoalTaskItems(id),
    getTranslations(),
    getTranslations("periods"),
  ]);
  if (!detail) notFound();

  const { goal, parent, tree } = detail;
  const unit = goalUnit(goal);
  const today = todayBkk();
  const remainingDays = Math.max(0, daysLeft(goal.period, today));
  const isMetric = goal.progress.kind === "metric";
  const remaining = isMetric
    ? Math.max(0, (goal.progress.target ?? 0) - (goal.progress.current ?? 0))
    : 0;
  const reached = goal.progress.percent >= 100;
  const parts = isMetric
    ? formatValueParts(goal.progress.current ?? 0, unit)
    : {
        value: `${formatNumber(goal.progress.tasksDone ?? 0)}/${formatNumber(goal.progress.tasksTotal ?? 0)}`,
        unit: t("goals.tasksUnitShort"),
      };
  const childType = childPeriodType(goal.period_type);
  const tasksDone = taskItems.filter((i) => i.done).length;
  const backHref = parent ? `/goals/${parent.id}` : "/goals";
  const backLabel = parent
    ? t("goals.parentLabel", { title: parent.title })
    : t("goals.backToList");

  return (
    <>
      <div className="-mx-2 mb-1 flex items-center justify-between gap-2 lg:hidden">
        <Button variant="ghost" size="icon" className="text-brand-800" asChild>
          <Link href={backHref} aria-label={backLabel}>
            <ArrowLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </Button>
        <span className="min-w-0 truncate text-base font-medium text-brand-800">
          {parent ? parent.title : t("goals.title")}
        </span>
        <span className="size-11" aria-hidden="true" />
      </div>

      <PageHeader
        title={goal.title}
        titleId="goal-title"
        titleAddon={<DomainTag domain={goal.domain} size="md" className="mt-1 self-start" />}
        toolbarStart={
          <Button variant="outline" className="hidden lg:inline-flex" asChild>
            <Link href={backHref}>
              <ChevronLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
              {parent ? parent.title : t("goals.backToList")}
            </Link>
          </Button>
        }
        toolbarEnd={<GoalDetailActions goal={goal} parentCandidates={candidates} />}
      />

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="lg:col-span-4">
          <section
            aria-labelledby="goal-title"
            className={cn(
              "space-y-4 rounded-2xl bg-brand-100 p-5 shadow-lg lg:p-6",
              goal.status === "archived" && "opacity-80",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <PeriodLabel period={goal.period} className="text-h3 text-brand-800 lg:text-h2" />
              {goal.status === "archived" ? (
                <Badge variant="outline" className="rounded-full bg-bg-surface">
                  {t("goals.statusArchived")}
                </Badge>
              ) : goal.status === "completed" ? (
                <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-500 px-2.5 text-caption font-medium text-neutral-0">
                  {t("goals.statusCompleted")}
                </span>
              ) : (
                <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-50 px-2.5 text-caption font-medium text-brand-800">
                  {t("progress.daysLeft", { days: remainingDays })}
                </span>
              )}
            </div>

            <div className="flex justify-center py-1">
              <CompassDial
                value={goal.progress.percent}
                className="size-[196px] drop-shadow-dial lg:size-56"
              />
            </div>

            {reached ? (
              <p className="text-center text-h2 text-success-800">
                {t("widgets.goalProgress.reached")}
              </p>
            ) : null}

            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-display text-text-primary">
                  {parts.value}
                  {parts.unit ? (
                    <span className="ml-1 text-small font-medium text-brand-800">{parts.unit}</span>
                  ) : null}
                </p>
                <p className="text-small text-brand-800">
                  {isMetric
                    ? t("widgets.goalProgress.target", {
                        target: formatValueWithUnit(goal.progress.target ?? 0, unit),
                      })
                    : `${t("progress.endsOn")} ${formatThaiDate(goal.period.end, "medium")}`}
                  {isMetric && !reached && remaining > 0
                    ? ` · ${t("progress.remaining", { remaining: formatValueWithUnit(remaining, unit) })}`
                    : ""}
                  {isMetric && reached && (goal.progress.current ?? 0) > (goal.progress.target ?? 0)
                    ? ` · ${t("goals.over", {
                        value: formatValueWithUnit(
                          (goal.progress.current ?? 0) - (goal.progress.target ?? 0),
                          unit,
                        ),
                      })}`
                    : ""}
                </p>
                {isMetric && !reached && remaining > 0 && remainingDays > 0 ? (
                  <p className="text-caption text-text-secondary">
                    {t("progress.perDayNeeded", {
                      amount: formatValueWithUnit(Math.ceil(remaining / remainingDays), unit),
                    })}
                  </p>
                ) : null}
              </div>
              <PaceBadge status={goal.pace} />
            </div>
          </section>

          <div className="mt-4 lg:hidden">
            <GoalDetailActions goal={goal} parentCandidates={candidates} />
          </div>
        </div>

        <div className="mt-6 space-y-6 lg:col-span-8 lg:mt-0">
          <section aria-labelledby="children-title">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="children-title" className="text-h2 text-brand-800">
                {t("goals.route")}
              </h2>
              {tree.length > 0 && childType ? (
                <span className="text-small text-text-secondary">
                  {t("goals.routeCount", { count: tree.length, period: tp(childType) })}
                </span>
              ) : null}
            </div>
            {tree.length > 0 ? (
              <GoalCascadeTree
                nodes={tree}
                today={today}
                destination={{
                  label: t("goals.destination", {
                    date: formatThaiDate(goal.period.end, "short"),
                  }),
                  value: isMetric
                    ? formatValueWithUnit(goal.progress.target ?? 0, unit)
                    : undefined,
                }}
              />
            ) : (
              <div className="rounded-xl bg-bg-surface px-5 py-4 shadow-md">
                <p className="text-small text-text-secondary">{t("progress.noChildren")}</p>
              </div>
            )}
          </section>

          <section aria-labelledby="tasks-title">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="tasks-title" className="text-h2 text-brand-800">
                {t("goals.tasks")}
              </h2>
              <div className="flex items-center gap-2">
                {taskItems.length > 0 ? (
                  <span className="text-small text-text-secondary">
                    {t("goals.tasksDoneCount", { done: tasksDone, total: taskItems.length })}
                  </span>
                ) : null}
                <Button variant="ghost" size="sm" className="-mr-3" asChild>
                  <Link href={`?new=task&goal=${goal.id}`} scroll={false}>
                    <Plus aria-hidden="true" />
                    {t("goals.addTask")}
                  </Link>
                </Button>
              </div>
            </div>
            <TaskList
              items={taskItems}
              today={today}
              goalOptions={candidates}
              groupByStatus={false}
              attachments="stack"
              emptyState={
                <EmptyState
                  icon={CheckSquare}
                  title={t("tasks.empty.goal.title")}
                  description={t("tasks.empty.goal.description")}
                  action={
                    <Button asChild>
                      <Link href={`?new=task&goal=${goal.id}`} scroll={false}>
                        {t("tasks.empty.goal.cta")}
                      </Link>
                    </Button>
                  }
                />
              }
            />
          </section>
        </div>
      </div>
    </>
  );
}
