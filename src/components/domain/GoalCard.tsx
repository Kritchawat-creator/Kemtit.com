import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import type { GoalWithProgress } from "@/core/goals/queries";
import type { AppLocale } from "@/i18n/config";
import { goalUnit } from "@/core/goals/schema";
import { formatNumber, formatPercent, formatValueWithUnit } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

import { DomainTag } from "./DomainTag";
import { PaceBadge } from "./PaceBadge";
import { PeriodLabel } from "./PeriodLabel";
import { ProgressBar } from "./ProgressBar";

type Props = { goal: GoalWithProgress; compact?: boolean; className?: string };

/**
 * การ์ด goal (Claude Design 3h): การ์ดขาวมุม 20px มีเงา · แถวบน = ช่วงเวลา + DomainTag · ชื่อ · ตัวเลข "ทำได้ / เป้า" + PaceBadge
 * แถบ progress มีจุดพีชปลายแถบ = จุดหมาย
 */
export function GoalCard({ goal, compact = false, className }: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const { progress } = goal;
  const unit = goalUnit(goal);

  const current =
    progress.kind === "metric"
      ? formatNumber(progress.current ?? 0, locale)
      : (progress.tasksTotal ?? 0) > 0
        ? formatNumber(progress.tasksDone ?? 0, locale)
        : formatPercent(progress.percent / 100, locale);
  const target =
    progress.kind === "metric"
      ? formatValueWithUnit(progress.target ?? 0, unit, locale)
      : (progress.tasksTotal ?? 0) > 0
        ? t("goals.tasksUnit", { count: formatNumber(progress.tasksTotal ?? 0, locale) })
        : progress.childCount > 0
          ? t("progress.children", { count: progress.childCount })
          : t("progress.noChildren");

  return (
    <Link
      href={`/goals/${goal.id}`}
      className={cn(
        "block min-w-0 rounded-xl border border-border bg-bg-surface shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-xs focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none",
        compact ? "px-4 py-3" : "px-5 py-4",
        goal.status === "archived" && "opacity-70",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <PeriodLabel period={goal.period} className="truncate text-caption text-text-secondary" />
        {goal.status === "archived" ? (
          <Badge variant="outline" className="rounded-full">
            {t("goals.statusArchived")}
          </Badge>
        ) : (
          <DomainTag domain={goal.domain} />
        )}
      </div>
      <h3
        className={cn(
          "mt-2 truncate text-text-primary",
          compact ? "text-body font-medium" : "text-h3 font-medium",
        )}
      >
        {goal.title}
      </h3>
      <div className="mt-2 flex min-w-0 flex-wrap items-end justify-between gap-3">
        <p className={cn("min-w-0 truncate text-text-primary", compact ? "text-h2" : "text-h1")}>
          {current}
          <span className="text-small font-medium text-text-secondary"> / {target}</span>
        </p>
        {goal.status === "archived" ? null : <PaceBadge status={goal.pace} />}
      </div>
      <ProgressBar value={progress.percent} size={compact ? "sm" : "md"} marker className="mt-3" />
    </Link>
  );
}
