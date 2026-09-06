"use client";

import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { daysLeft } from "@/core/domain/periods";
import type { GoalWithProgress } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import type { ISODate } from "@/lib/date";
import { formatPercent, formatValueWithUnit } from "@/lib/format";
import { Celebration } from "@/components/domain/Celebration";
import { DomainTag } from "@/components/domain/DomainTag";
import { PaceBadge } from "@/components/domain/PaceBadge";
import { ProgressBar } from "@/components/domain/ProgressBar";
import { ProgressRing } from "@/components/domain/ProgressRing";
import { UpdateValueForm } from "@/components/domain/UpdateValueForm";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type Props = { goal: GoalWithProgress; others: GoalWithProgress[]; today: ISODate };

/** เนื้อหา widget เป้าหลักเดือนนี้: % ใหญ่ (display) + ตัวเลข + อัปเดตยอด + เป้าอื่นของเดือน (Design §8.4) */
export function GoalProgressPanel({ goal, others, today }: Props) {
  const t = useTranslations("widgets.goalProgress");
  const [open, setOpen] = useState(false);
  const [fireKey, setFireKey] = useState(0);

  const unit = goalUnit(goal);
  const { progress } = goal;
  const isMetric = progress.kind === "metric";
  const remaining = isMetric ? Math.max(0, (progress.target ?? 0) - (progress.current ?? 0)) : 0;
  const left = daysLeft(goal.period, today);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5">
        <ProgressRing
          value={progress.percent}
          domain={goal.domain}
          size={124}
          strokeWidth={11}
          className="shrink-0"
        >
          <span className="text-display text-brand-800">
            {formatPercent(progress.percent / 100)}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-2">
          <Link
            href={`/goals/${goal.id}`}
            className="block truncate rounded-md text-h3 text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {goal.title}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <DomainTag domain={goal.domain} />
            <PaceBadge status={goal.pace} />
          </div>
          <p className="text-small text-text-secondary">
            {isMetric
              ? progress.percent >= 100
                ? t("reached")
                : `${t("remaining", { remaining: formatValueWithUnit(remaining, unit) })} · ${
                    left > 0
                      ? t("perDay", {
                          amount: formatValueWithUnit(Math.ceil(remaining / left), unit),
                        })
                      : t("daysLeft", { days: 0 })
                  }`
              : (progress.tasksTotal ?? 0) > 0
                ? t("tasks", { done: progress.tasksDone ?? 0, total: progress.tasksTotal ?? 0 })
                : t("children", { count: progress.childCount })}
          </p>
          {isMetric && goal.status !== "archived" ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <TrendingUp aria-hidden="true" />
              {t("updateValue")}
            </Button>
          ) : null}
        </div>
      </div>

      {others.length > 0 ? (
        <div>
          <h3 className="mb-2 text-caption text-text-secondary">{t("othersTitle")}</h3>
          <ul className="space-y-2">
            {others.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/goals/${g.id}`}
                  className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                    {g.title}
                  </span>
                  <ProgressBar
                    value={g.progress.percent}
                    domain={g.domain}
                    size="sm"
                    className="w-24 shrink-0"
                  />
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
