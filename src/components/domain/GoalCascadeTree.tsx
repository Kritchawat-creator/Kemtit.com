import { Check, Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { cn } from "cn";

import { periodContains } from "@/core/domain/periods";
import type { GoalTreeNode } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import { isAfterISO, type ISODate, todayBkk } from "@/lib/date";
import { formatNumber, formatPercent, formatValueWithUnit } from "@/lib/format";

import { periodLabelText } from "./PeriodLabel";

type Destination = { label: string; value?: string };

type Props = {
  nodes: GoalTreeNode[];
  /** แถวบนสุด = จุดหมายของเป้าแม่ (Claude Design 3k "จุดหมาย · 30 ก.ย.  50,000") */
  destination?: Destination;
  today?: ISODate;
  depth?: number;
};

type WaypointState = "done" | "current" | "past" | "future";

function stateOf(node: GoalTreeNode, today: ISODate): WaypointState {
  const { goal } = node;
  if (goal.progress.percent >= 100 || goal.status === "completed") return "done";
  if (periodContains(goal.period, today)) return "current";
  if (isAfterISO(today, goal.period.end)) return "past";
  return "future";
}

const MARKER: Record<WaypointState, string> = {
  done: "bg-success-500 text-neutral-0",
  current: "border-[3px] border-brand-500 bg-bg-surface",
  past: "border-[1.5px] border-warning-500 bg-warning-50",
  future: "border-[1.5px] border-border-strong bg-bg-surface",
};

/**
 * "เส้นทาง" ของเป้าหมาย (Claude Design 3k): waypoint เรียงจากปลายทางบนสุดลงมาตามเวลา (ช่วงล่าสุดอยู่บน)
 * เส้นประแนวตั้งเชื่อมทุกจุด · จุดเสร็จ = success · จุดที่วันนี้อยู่ = วงแหวน brand-500 + pill "คุณอยู่ตรงนี้" · อนาคต = จาง
 * ชั้นลึกกว่า 1 (ปี → เดือน → สัปดาห์) ซ้อนเป็นรายการย่อยใต้ waypoint แม่
 */
export function GoalCascadeTree({ nodes, destination, today = todayBkk(), depth = 0 }: Props) {
  const t = useTranslations();
  const tp = useTranslations("periods");
  const sorted = [...nodes].sort((a, b) => b.goal.period_start.localeCompare(a.goal.period_start));

  return (
    <ol
      className={cn(
        "relative",
        depth === 0 ? "rounded-xl bg-bg-surface px-5 py-1.5 shadow-md" : "mt-1 ml-10",
      )}
    >
      {depth === 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-8 bottom-8 left-[31px] border-l-[1.5px] border-dashed border-border-strong"
        />
      ) : null}
      {destination && depth === 0 ? (
        <li className="relative flex items-center gap-4 py-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-800 text-neutral-0">
            <Flag className="size-3" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-base font-medium text-text-primary">
            {destination.label}
          </span>
          {destination.value ? (
            <span className="text-base font-semibold whitespace-nowrap text-text-primary">
              {destination.value}
            </span>
          ) : null}
        </li>
      ) : null}
      {sorted.map((node) => {
        const { goal } = node;
        const state = stateOf(node, today);
        const unit = goalUnit(goal);
        const isMetric = goal.progress.kind === "metric";
        const value = isMetric
          ? formatValueWithUnit(goal.progress.target ?? 0, unit)
          : (goal.progress.tasksTotal ?? 0) > 0
            ? `${formatNumber(goal.progress.tasksDone ?? 0)}/${formatNumber(goal.progress.tasksTotal ?? 0)}`
            : formatPercent(goal.progress.percent / 100);
        const achieved = isMetric
          ? (goal.progress.current ?? 0) > 0
            ? t("goals.achieved", { value: formatValueWithUnit(goal.progress.current ?? 0, unit) })
            : null
          : (goal.progress.tasksTotal ?? 0) > 0
            ? t("goals.tasksDoneCount", {
                done: goal.progress.tasksDone ?? 0,
                total: goal.progress.tasksTotal ?? 0,
              })
            : null;
        const muted = state === "future";
        return (
          <li key={goal.id} className="relative">
            <Link
              href={`/goals/${goal.id}`}
              className="flex items-start gap-4 rounded-md py-2.5 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            >
              <span
                className={cn(
                  "mt-px flex size-6 shrink-0 items-center justify-center rounded-full",
                  MARKER[state],
                )}
                aria-hidden="true"
              >
                {state === "done" ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-base",
                      state === "current" ? "font-medium text-text-primary" : "",
                      muted ? "text-text-secondary" : "text-text-primary",
                    )}
                  >
                    {goal.title}
                  </span>
                  {state === "current" ? (
                    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-brand-500 pr-2.5 pl-1.5 text-caption font-medium text-neutral-0">
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <polygon points="5,0 8,5 5,10 2,5" className="fill-accent-500" />
                      </svg>
                      {t("goals.youAreHere")}
                    </span>
                  ) : null}
                </span>
                <span className="block text-caption text-text-secondary">
                  {periodLabelText(goal.period, tp)}
                  {achieved ? ` · ${achieved}` : ""}
                </span>
              </span>
              <span
                className={cn(
                  "text-base font-semibold whitespace-nowrap",
                  muted ? "text-text-secondary" : "text-text-primary",
                )}
              >
                {value}
              </span>
            </Link>
            {node.children.length > 0 ? (
              <GoalCascadeTree nodes={node.children} today={today} depth={depth + 1} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
