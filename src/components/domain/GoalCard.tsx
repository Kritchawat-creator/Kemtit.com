import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import type { GoalWithProgress } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import { formatPercent, formatValueWithUnit } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

import { DOMAIN_STYLES, DomainTag } from "./DomainTag";
import { PaceBadge } from "./PaceBadge";
import { PeriodLabel } from "./PeriodLabel";
import { ProgressBar } from "./ProgressBar";

type Props = { goal: GoalWithProgress; compact?: boolean; className?: string };

/** การ์ด goal: ชื่อ + domain + ช่วงเวลา + % เด่น + แถบ progress (Design §6.2) พื้น tint อ่อนตาม domain (§5.4) */
export function GoalCard({ goal, compact = false, className }: Props) {
  const t = useTranslations();
  const { progress } = goal;
  const unit = goalUnit(goal);

  const detail =
    progress.kind === "metric"
      ? t("progress.ofTarget", {
          current: formatValueWithUnit(progress.current ?? 0, unit),
          target: formatValueWithUnit(progress.target ?? 0, unit),
        })
      : (progress.tasksTotal ?? 0) > 0
        ? t("progress.tasksDone", {
            done: progress.tasksDone ?? 0,
            total: progress.tasksTotal ?? 0,
          })
        : progress.childCount > 0
          ? t("progress.children", { count: progress.childCount })
          : t("progress.noChildren");

  return (
    <Link
      href={`/goals/${goal.id}`}
      className={cn(
        "block rounded-lg border border-border p-4 transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        goal.status === "archived" ? "bg-bg-subtle opacity-70" : DOMAIN_STYLES[goal.domain].tint,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={cn(
              "truncate text-text-primary",
              compact ? "text-body font-medium" : "text-h3",
            )}
          >
            {goal.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <DomainTag domain={goal.domain} />
            <PeriodLabel period={goal.period} className="text-caption text-text-secondary" />
            {goal.status === "archived" ? (
              <Badge variant="outline" className="rounded-full">
                {t("goals.statusArchived")}
              </Badge>
            ) : (
              <PaceBadge status={goal.pace} />
            )}
          </div>
        </div>
        <span className={cn("shrink-0 text-brand-800", compact ? "text-h3" : "text-h2")}>
          {formatPercent(progress.percent / 100)}
        </span>
      </div>
      <ProgressBar
        value={progress.percent}
        domain={goal.domain}
        size={compact ? "sm" : "md"}
        className="mt-3"
      />
      {!compact ? <p className="mt-2 text-small text-text-secondary">{detail}</p> : null}
    </Link>
  );
}
