import { ArrowLeft, CheckSquare, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";

import { daysLeft } from "@/core/domain/periods";
import { getGoalDetail, listParentCandidates } from "@/core/goals/queries";
import { getGoalTaskItems } from "@/core/tasks/queries";
import { goalUnit } from "@/core/goals/schema";
import { todayBkk } from "@/lib/date";
import { formatNumber, formatPercent, formatThaiDate, formatValueWithUnit } from "@/lib/format";
import { DomainTag } from "@/components/domain/DomainTag";
import { EmptyState } from "@/components/domain/EmptyState";
import { GoalCascadeTree } from "@/components/domain/GoalCascadeTree";
import { PaceBadge } from "@/components/domain/PaceBadge";
import { PeriodLabel } from "@/components/domain/PeriodLabel";
import { ProgressRing } from "@/components/domain/ProgressRing";
import { StatTile } from "@/components/domain/StatTile";
import { TaskList } from "@/components/domain/TaskList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { GoalDetailActions } from "./goal-detail-actions";

export async function generateMetadata({ params }: PageProps<"/goals/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getGoalDetail(id);
  return { title: detail?.goal.title ?? (await getTranslations("goals"))("notFound") };
}

/** หน้า detail (Design §8.2): hero (ชื่อ, %, target/current) → cascade tree → task ที่ผูก */
export default async function GoalDetailPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  const [detail, candidates, taskItems, t] = await Promise.all([
    getGoalDetail(id),
    listParentCandidates(),
    getGoalTaskItems(id),
    getTranslations(),
  ]);
  if (!detail) notFound();

  const { goal, parent, tree } = detail;
  const unit = goalUnit(goal);
  const today = todayBkk();
  const remainingDays = daysLeft(goal.period, today);
  const isMetric = goal.progress.kind === "metric";
  const remaining = isMetric
    ? Math.max(0, (goal.progress.target ?? 0) - (goal.progress.current ?? 0))
    : null;

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={parent ? `/goals/${parent.id}` : "/goals"}>
            <ArrowLeft aria-hidden="true" />
            {parent ? t("goals.parentLabel", { title: parent.title }) : t("goals.backToList")}
          </Link>
        </Button>
      </div>

      <section
        aria-labelledby="goal-title"
        className={cn(
          "rounded-xl border border-border bg-bg-surface p-5 md:p-8",
          goal.status === "archived" && "opacity-80",
        )}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <ProgressRing
            value={goal.progress.percent}
            domain={goal.domain}
            size={160}
            strokeWidth={12}
            className="mx-auto md:mx-0"
          >
            <span className="text-display text-brand-800">
              {formatPercent(goal.progress.percent / 100)}
            </span>
            <span className="text-caption text-text-secondary">{t("progress.label")}</span>
          </ProgressRing>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <DomainTag domain={goal.domain} size="md" />
              <PeriodLabel period={goal.period} className="text-small text-text-secondary" />
              {goal.status === "archived" ? (
                <Badge variant="outline" className="rounded-full">
                  {t("goals.statusArchived")}
                </Badge>
              ) : goal.status === "completed" ? (
                <Badge className="rounded-full">{t("goals.statusCompleted")}</Badge>
              ) : (
                <PaceBadge status={goal.pace} />
              )}
            </div>
            <h1 id="goal-title" className="text-h1 text-text-primary">
              {goal.title}
            </h1>

            <div className="grid gap-3 sm:grid-cols-3">
              {isMetric ? (
                <>
                  <StatTile
                    label={t("goals.currentValueLabel")}
                    value={formatValueWithUnit(goal.progress.current ?? 0, unit)}
                    hint={t("progress.ofTarget", {
                      current: formatValueWithUnit(goal.progress.current ?? 0, unit),
                      target: formatValueWithUnit(goal.progress.target ?? 0, unit),
                    })}
                  />
                  <StatTile
                    label={t("progress.remaining", { remaining: "" }).trim()}
                    value={formatValueWithUnit(remaining ?? 0, unit)}
                    tone={goal.pace === "behind" ? "warning" : "default"}
                  />
                  <StatTile
                    label={t("progress.daysLeft", { days: remainingDays })}
                    value={
                      remainingDays > 0 && (remaining ?? 0) > 0
                        ? formatValueWithUnit(Math.ceil((remaining ?? 0) / remainingDays), unit)
                        : "—"
                    }
                    hint={
                      remainingDays > 0 && (remaining ?? 0) > 0
                        ? t("progress.perDayNeeded", { amount: "" }).trim()
                        : undefined
                    }
                  />
                </>
              ) : (
                <>
                  <StatTile
                    label={t("goals.tasks")}
                    value={`${formatNumber(goal.progress.tasksDone ?? 0)}/${formatNumber(goal.progress.tasksTotal ?? 0)}`}
                  />
                  <StatTile
                    label={t("goals.children")}
                    value={formatNumber(goal.progress.childCount)}
                  />
                  <StatTile
                    label={t("progress.daysLeft", { days: remainingDays })}
                    value={formatThaiDate(goal.period.end, "medium")}
                  />
                </>
              )}
            </div>

            <GoalDetailActions goal={goal} parentCandidates={candidates} />
          </div>
        </div>
      </section>

      <section aria-labelledby="children-title" className="mt-8">
        <h2 id="children-title" className="mb-3 text-h2 text-text-primary">
          {t("goals.children")}
        </h2>
        {tree.length > 0 ? (
          <GoalCascadeTree nodes={tree} />
        ) : (
          <p className="text-small text-text-secondary">{t("progress.noChildren")}</p>
        )}
      </section>

      <section aria-labelledby="tasks-title" className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="tasks-title" className="text-h2 text-text-primary">
            {t("goals.tasks")}
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href={`?new=task&goal=${goal.id}`} scroll={false}>
              <Plus aria-hidden="true" />
              {t("goals.addTask")}
            </Link>
          </Button>
        </div>
        <TaskList
          items={taskItems}
          today={today}
          goalOptions={candidates}
          groupByStatus={false}
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
    </>
  );
}
