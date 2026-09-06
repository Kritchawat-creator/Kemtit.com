"use client";

import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { daysLeft } from "@/core/domain/periods";
import type { GoalWithProgress } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import type { ISODate } from "@/lib/date";
import { formatNumber, formatPercent, formatValueParts, formatValueWithUnit } from "@/lib/format";
import { Celebration } from "@/components/domain/Celebration";
import { CompassDial } from "@/components/domain/CompassDial";
import { DomainTag } from "@/components/domain/DomainTag";
import { PaceBadge } from "@/components/domain/PaceBadge";
import { ProgressBar } from "@/components/domain/ProgressBar";
import { UpdateValueForm } from "@/components/domain/UpdateValueForm";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type Props = { goal: GoalWithProgress; others: GoalWithProgress[]; today: ISODate };

/**
 * เนื้อหา hero เป้าหลักเดือนนี้ (Claude Design 2a): ชื่อเป้า + pill "เหลือ N วัน" → หน้าปัดเข็มทิศ 196px →
 * ตัวเลขทำได้ (display) + หน่วย · "เป้า X" · PaceBadge → ถึงจุดหมาย = ข้อความ success · ปุ่มอัปเดตยอด · เป้าอื่นของเดือน
 */
export function GoalProgressPanel({ goal, others, today }: Props) {
  const t = useTranslations("widgets.goalProgress");
  const [open, setOpen] = useState(false);
  const [fireKey, setFireKey] = useState(0);

  const unit = goalUnit(goal);
  const { progress } = goal;
  const isMetric = progress.kind === "metric";
  const remaining = isMetric ? Math.max(0, (progress.target ?? 0) - (progress.current ?? 0)) : 0;
  const left = daysLeft(goal.period, today);
  const reached = progress.percent >= 100;
  const parts = isMetric
    ? formatValueParts(progress.current ?? 0, unit)
    : {
        value: `${formatNumber(progress.tasksDone ?? 0)}/${formatNumber(progress.tasksTotal ?? 0)}`,
        unit: null,
      };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/goals/${goal.id}`}
          className="min-w-0 truncate rounded-md text-h3 text-brand-800 hover:underline focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
        >
          {goal.title}
        </Link>
        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-50 px-2.5 text-caption font-medium text-brand-800">
          {t("daysLeft", { days: Math.max(0, left) })}
        </span>
      </div>

      <div className="flex justify-center py-1">
        <CompassDial value={progress.percent} size={196} className="drop-shadow-dial" />
      </div>

      {reached ? <p className="text-center text-h2 text-success-800">{t("reached")}</p> : null}

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-display text-text-primary">
            {parts.value}
            {parts.unit ? (
              <span className="ml-1 text-small font-medium text-brand-800">{parts.unit}</span>
            ) : (
              <span className="ml-1 text-small font-medium text-brand-800">{t("tasksUnit")}</span>
            )}
          </p>
          <p className="text-small text-brand-800">
            {isMetric
              ? t("target", { target: formatValueWithUnit(progress.target ?? 0, unit) })
              : (progress.tasksTotal ?? 0) > 0
                ? t("tasks", { done: progress.tasksDone ?? 0, total: progress.tasksTotal ?? 0 })
                : t("children", { count: progress.childCount })}
            {isMetric && !reached && remaining > 0
              ? ` · ${t("remaining", { remaining: formatValueWithUnit(remaining, unit) })}`
              : ""}
          </p>
          {isMetric && !reached && remaining > 0 && left > 0 ? (
            <p className="text-caption text-text-secondary">
              {t("perDay", { amount: formatValueWithUnit(Math.ceil(remaining / left), unit) })}
            </p>
          ) : null}
        </div>
        <PaceBadge status={goal.pace} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isMetric && goal.status !== "archived" ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <TrendingUp aria-hidden="true" />
            {t("updateValue")}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/goals/${goal.id}`}>{t("viewGoal")}</Link>
        </Button>
        <DomainTag domain={goal.domain} className="ml-auto" />
      </div>

      {others.length > 0 ? (
        <div className="rounded-lg bg-bg-surface/70 px-4 py-3">
          <h3 className="mb-2 text-caption font-medium text-text-secondary">{t("othersTitle")}</h3>
          <ul className="space-y-2">
            {others.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/goals/${g.id}`}
                  className="flex items-center gap-3 rounded-md focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                    {g.title}
                  </span>
                  <ProgressBar value={g.progress.percent} size="sm" className="w-24 shrink-0" />
                  <span className="w-10 shrink-0 text-right text-small text-text-secondary">
                    {formatPercent(g.progress.percent / 100)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("updateValue")}>
        <UpdateValueForm
          goal={goal}
          unit={unit}
          onDone={() => setOpen(false)}
          onCompleted={() => setFireKey((k) => k + 1)}
        />
      </ResponsiveDialog>
      <Celebration fireKey={fireKey} />
    </div>
  );
}
