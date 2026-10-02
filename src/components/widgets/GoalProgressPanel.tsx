"use client";

import { Check, Flag, Target, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { cn } from "cn";

import { paceDelta } from "@/core/domain/entries";
import { daysLeft, periodContains } from "@/core/domain/periods";
import type { GoalWithProgress } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import type { AppLocale } from "@/i18n/config";
import { isAfterISO, type ISODate } from "@/lib/date";
import { formatNumber, formatPercent, formatValueParts, formatValueWithUnit } from "@/lib/format";
import { Celebration } from "@/components/domain/Celebration";
import { CompassDial } from "@/components/domain/CompassDial";
import { DomainTag } from "@/components/domain/DomainTag";
import { PaceBadge } from "@/components/domain/PaceBadge";
import { periodLabelText } from "@/components/domain/PeriodLabel";
import { ProgressBar } from "@/components/domain/ProgressBar";
import { UpdateValueForm } from "@/components/domain/UpdateValueForm";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIsMobile } from "@/hooks/use-is-mobile";

type Props = {
  goal: GoalWithProgress;
  others: GoalWithProgress[];
  /** เป้าย่อยของเป้าหลัก (สัปดาห์) — tile บน desktop (Claude Design 4a) */
  waypoints?: GoalWithProgress[];
  today: ISODate;
  compact?: boolean;
};

const MAX_TILES = 3;

/**
 * เนื้อหา hero เป้าหลักเดือนนี้ (Claude Design 2a/4a): ชื่อเป้า + pill "เหลือ N วัน" → หน้าปัดเข็มทิศ (196 มือถือ / 240 desktop วางข้างตัวเลข) →
 * ตัวเลขทำได้ (display) + หน่วย · "เป้า X" · PaceBadge + เร็ว/ช้ากว่าแผน → tile waypoint (desktop) → ปุ่มอัปเดตยอด → เป้าอื่นของเดือน
 */
export function GoalProgressPanel({ goal, others, waypoints = [], today, compact = false }: Props) {
  const t = useTranslations("widgets.goalProgress");
  const tg = useTranslations("goals");
  const tp = useTranslations("periods");
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const [fireKey, setFireKey] = useState(0);
  // tile waypoint มีเฉพาะ desktop (Claude Design 4a) — ไม่ render บนมือถือเลย เพื่อไม่ให้ตัวเลขซ้ำใน DOM
  const isMobile = useIsMobile();

  const unit = goalUnit(goal);
  const { progress } = goal;
  const isMetric = progress.kind === "metric";
  const remaining = isMetric ? Math.max(0, (progress.target ?? 0) - (progress.current ?? 0)) : 0;
  const left = daysLeft(goal.period, today);
  const reached = progress.percent >= 100;
  const parts = isMetric
    ? formatValueParts(progress.current ?? 0, unit, locale)
    : {
        value: `${formatNumber(progress.tasksDone ?? 0, locale)}/${formatNumber(progress.tasksTotal ?? 0, locale)}`,
        unit: null,
      };
  // เทียบแผน (Claude Design 4a "เร็วกว่าแผน 1,700 บาท") — สูตรเดียวกับ core/domain/entries.paceDelta
  const delta = isMetric
    ? paceDelta(progress.current ?? 0, progress.target ?? 0, goal.period, today)
    : 0;
  const tiles = [...waypoints]
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .slice(0, MAX_TILES);

  if (compact) {
    return (
      <>
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Target className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
              <Link
                href={`/goals/${goal.id}`}
                className="min-w-0 rounded-md text-h3 font-semibold break-words text-brand-800 hover:underline focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
              >
                {goal.title}
              </Link>
            </div>
            <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-50 px-2.5 text-caption font-medium text-brand-800">
              {t("daysLeft", { days: Math.max(0, left) })}
            </span>
          </div>

          <div className="space-y-2">
            {reached ? (
              <p className="text-small font-medium text-success-800">{t("reached")}</p>
            ) : null}
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-h2 font-semibold text-text-primary">
                {parts.value}
                <span className="ml-1 text-small font-medium text-brand-800">
                  {parts.unit ?? t("tasksUnit")}
                </span>
              </p>
              <p className="text-small text-brand-800">
                {isMetric
                  ? t("target", { target: formatValueWithUnit(progress.target ?? 0, unit, locale) })
                  : (progress.tasksTotal ?? 0) > 0
                    ? t("tasks", { done: progress.tasksDone ?? 0, total: progress.tasksTotal ?? 0 })
                    : t("children", { count: progress.childCount })}
              </p>
            </div>
            <ProgressBar value={progress.percent} size="sm" showValue label={goal.title} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-text-secondary">
              <span>{periodLabelText(goal.period, tp, locale)}</span>
              {isMetric && !reached && remaining > 0 ? (
                <span>
                  {t("remaining", { remaining: formatValueWithUnit(remaining, unit, locale) })}
                </span>
              ) : null}
              {isMetric && !reached && remaining > 0 && left > 0 ? (
                <span>
                  {t("perDay", {
                    amount: formatValueWithUnit(Math.ceil(remaining / left), unit, locale),
                  })}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PaceBadge status={goal.pace} />
              {isMetric && !reached ? (
                <span className="text-caption font-medium text-brand-800">
                  {delta > 0
                    ? tg("aheadOfPlan", { value: formatValueWithUnit(delta, unit, locale) })
                    : delta < 0
                      ? tg("behindPlan", { value: formatValueWithUnit(-delta, unit, locale) })
                      : tg("onPlan")}
                </span>
              ) : null}
            </div>
          </div>

          {!isMobile && tiles.length > 0 ? (
            <ul className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2">
              {tiles.map((wp) => {
                const done = wp.progress.percent >= 100 || wp.status === "completed";
                const current = !done && periodContains(wp.period, today);
                const isWpMetric = wp.progress.kind === "metric";
                const target = isWpMetric
                  ? formatNumber(wp.progress.target ?? 0, locale)
                  : formatNumber(wp.progress.tasksTotal ?? 0, locale);
                const currentValue = isWpMetric
                  ? formatNumber(wp.progress.current ?? 0, locale)
                  : formatNumber(wp.progress.tasksDone ?? 0, locale);
                return (
                  <li key={wp.id} className="min-w-0 py-1">
                    <Link
                      href={`/goals/${wp.id}`}
                      className="block truncate text-caption font-medium text-text-primary hover:underline"
                    >
                      {wp.title}
                    </Link>
                    <p className="truncate text-caption text-text-secondary">
                      {periodLabelText(wp.period, tp, locale)} ·{" "}
                      {current || done ? currentValue + "/" : ""}
                      {target}
                    </p>
                  </li>
                );
              })}
              <li className="min-w-0 py-1">
                <span className="block truncate text-caption font-medium text-text-secondary">
                  {tg("destinationShort")}
                </span>
                <p className="truncate text-caption text-text-secondary">
                  {periodLabelText(goal.period, tp, locale)} ·{" "}
                  {isMetric
                    ? formatNumber(progress.target ?? 0, locale)
                    : formatNumber(progress.tasksTotal ?? 0, locale)}
                </p>
              </li>
            </ul>
          ) : null}

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
            <div className="border-t border-border pt-2">
              <h3 className="mb-1 text-caption font-medium text-text-secondary">
                {t("othersTitle")}
              </h3>
              <ul className="space-y-1.5">
                {others.map((otherGoal) => (
                  <li key={otherGoal.id}>
                    <Link
                      href={`/goals/${otherGoal.id}`}
                      className="flex min-w-0 items-center gap-2 rounded-md focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
                    >
                      <span className="min-w-0 flex-1 truncate text-small text-text-primary">
                        {otherGoal.title}
                      </span>
                      <ProgressBar
                        value={otherGoal.progress.percent}
                        size="sm"
                        className="w-20 shrink-0"
                        label={otherGoal.title}
                      />
                      <span className="w-10 shrink-0 text-right text-caption text-text-secondary">
                        {formatPercent(otherGoal.progress.percent / 100, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <ResponsiveDialog open={open} onOpenChange={setOpen} title={t("updateValue")}>
          <UpdateValueForm
            goal={goal}
            unit={unit}
            onDone={() => setOpen(false)}
            onCompleted={() => setFireKey((key) => key + 1)}
          />
        </ResponsiveDialog>
        <Celebration fireKey={fireKey} />
      </>
    );
  }

  return (
    <div className="@container min-w-0 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/goals/${goal.id}`}
          className="min-w-0 truncate rounded-md text-h3 text-brand-800 hover:underline focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none @lg:text-h2"
        >
          {goal.title}
        </Link>
        <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-50 px-2.5 text-caption font-medium text-brand-800">
          {t("daysLeft", { days: Math.max(0, left) })}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 @lg:flex-nowrap @lg:justify-start">
        <div className="flex w-full justify-center py-1 @lg:w-auto @lg:shrink-0 @lg:py-0">
          <CompassDial
            value={progress.percent}
            className="size-[196px] drop-shadow-dial @lg:size-60"
          />
        </div>

        <div className="w-full min-w-0 @lg:flex-1">
          {reached ? (
            <p className="mt-3 text-center text-h2 text-success-800 @lg:mt-0 @lg:text-left">
              {t("reached")}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 @lg:mt-1 @lg:block">
            <div className="min-w-0">
              <p className="text-display text-text-primary">
                {parts.value}
                <span className="ml-1 text-small font-medium text-brand-800">
                  {parts.unit ?? t("tasksUnit")}
                </span>
              </p>
              <p className="text-small text-brand-800">
                {isMetric
                  ? t("target", { target: formatValueWithUnit(progress.target ?? 0, unit, locale) })
                  : (progress.tasksTotal ?? 0) > 0
                    ? t("tasks", { done: progress.tasksDone ?? 0, total: progress.tasksTotal ?? 0 })
                    : t("children", { count: progress.childCount })}
                <span> · {periodLabelText(goal.period, tp, locale)}</span>
                {isMetric && !reached && remaining > 0
                  ? ` · ${t("remaining", { remaining: formatValueWithUnit(remaining, unit, locale) })}`
                  : ""}
              </p>
              {isMetric && !reached && remaining > 0 && left > 0 ? (
                <p className="text-caption text-text-secondary">
                  {t("perDay", {
                    amount: formatValueWithUnit(Math.ceil(remaining / left), unit, locale),
                  })}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2.5 @lg:mt-2">
              <PaceBadge status={goal.pace} />
              {isMetric && !reached ? (
                <span className="text-caption font-medium text-brand-800">
                  {delta > 0
                    ? tg("aheadOfPlan", { value: formatValueWithUnit(delta, unit, locale) })
                    : delta < 0
                      ? tg("behindPlan", { value: formatValueWithUnit(-delta, unit, locale) })
                      : tg("onPlan")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!isMobile && tiles.length > 0 ? (
        <ul className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
          {tiles.map((wp) => {
            const done = wp.progress.percent >= 100 || wp.status === "completed";
            const current = !done && periodContains(wp.period, today);
            const future = !done && !current && isAfterISO(wp.period.start, today);
            const wpUnit = goalUnit(wp);
            const isWpMetric = wp.progress.kind === "metric";
            const target = isWpMetric
              ? formatNumber(wp.progress.target ?? 0, locale)
              : formatNumber(wp.progress.tasksTotal ?? 0, locale);
            const currentValue = isWpMetric
              ? formatNumber(wp.progress.current ?? 0, locale)
              : formatNumber(wp.progress.tasksDone ?? 0, locale);
            return (
              <li
                key={wp.id}
                className={cn(
                  "rounded-md border-[1.5px] bg-bg-surface px-3.5 py-3",
                  current ? "border-brand-500" : "border-transparent",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full",
                      done && "bg-brand-500 text-neutral-0",
                      current && "border-[3px] border-brand-500 bg-bg-surface",
                      !done && !current && "border-[1.5px] border-border-strong bg-bg-surface",
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check className="size-2.5" strokeWidth={3} /> : null}
                  </span>
                  <Link
                    href={`/goals/${wp.id}`}
                    className={cn(
                      "min-w-0 truncate text-small font-medium hover:underline",
                      future ? "text-text-secondary" : "text-text-primary",
                    )}
                  >
                    {wp.title}
                  </Link>
                  {current ? (
                    <span className="ml-auto inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-brand-500 pr-2 pl-1.5 text-[11px] font-medium text-neutral-0">
                      <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
                        <polygon points="5,0 8,5 5,10 2,5" className="fill-accent-500" />
                      </svg>
                      {tg("waypointHere")}
                    </span>
                  ) : null}
                </div>
                <p className="text-caption text-text-secondary">
                  {periodLabelText(wp.period, tp, locale)}
                </p>
                <p
                  className={cn(
                    "text-h3 font-semibold",
                    future ? "text-text-secondary" : "text-text-primary",
                  )}
                >
                  {current || done ? (
                    <>
                      {currentValue}
                      <span className="text-caption font-medium text-text-secondary">
                        {" "}
                        / {target}
                        {isWpMetric && wpUnit ? "" : ""}
                      </span>
                    </>
                  ) : (
                    target
                  )}
                </p>
              </li>
            );
          })}
          <li className="rounded-md border-[1.5px] border-transparent bg-bg-surface px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span
                className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-800 text-neutral-0"
                aria-hidden="true"
              >
                <Flag className="size-2.5" strokeWidth={2} />
              </span>
              <span className="text-small font-medium text-text-secondary">
                {tg("destinationShort")}
              </span>
            </div>
            <p className="text-caption text-text-secondary">
              {periodLabelText(goal.period, tp, locale)}
            </p>
            <p className="text-h3 font-semibold text-text-secondary">
              {isMetric
                ? formatNumber(progress.target ?? 0, locale)
                : formatNumber(progress.tasksTotal ?? 0, locale)}
            </p>
          </li>
        </ul>
      ) : null}

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
                    {formatPercent(g.progress.percent / 100, locale)}
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
