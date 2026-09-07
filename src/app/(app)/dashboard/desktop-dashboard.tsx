import { CircleDollarSign, Flame, Plus, ShoppingBag, SquareCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import {
  averagePerDay,
  cumulativeSeries,
  percentChange,
  perDayNeeded,
  sumAmounts,
} from "@/core/domain/entries";
import { daysLeft } from "@/core/domain/periods";
import {
  getEntryStreak,
  listEntries,
  listGoalEntries,
  sumEntriesBetween,
} from "@/core/entries/queries";
import { getMainMonthGoal } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import { getDayPlan, getWeekTaskStats } from "@/core/tasks/queries";
import { addDaysISO, addMonthsISO, endOfMonthISO, type ISODate, startOfMonthISO } from "@/lib/date";
import { formatThaiDate, formatValueParts } from "@/lib/format";
import { CompassDial } from "@/components/domain/CompassDial";
import { EmptyState } from "@/components/domain/EmptyState";
import { EntriesTable } from "@/components/domain/EntriesTable";
import { PaceBadge } from "@/components/domain/PaceBadge";
import { QuickEntryForm } from "@/components/domain/QuickEntryForm";
import { SalesChart } from "@/components/domain/SalesChart";
import { StatTile } from "@/components/domain/StatTile";
import { Button } from "@/components/ui/button";
import { SegmentedNav } from "@/components/ui/segmented-nav";
import { TodayTasksWidget } from "@/components/widgets/TodayTasksWidget";

const STREAK_GOAL_DAYS = 7;
const RECENT_LIMIT = 5;

export type ChartRange = "week" | "month";

type Props = { today: ISODate; chart: ChartRange };

/** การ์ดขาวมุม 20px ของ dashboard v3 (Claude Design turn 7) */
function Card({
  span,
  title,
  action,
  children,
}: {
  span: "4" | "8" | "12";
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const spanClass =
    span === "4" ? "lg:col-span-4" : span === "8" ? "lg:col-span-8" : "lg:col-span-12";
  return (
    <section
      aria-label={title}
      className={`${spanClass} flex flex-col gap-3 rounded-lg bg-bg-surface px-6 py-5 shadow-md`}
    >
      {title ? (
        <div className="flex min-h-8 items-center justify-between gap-3">
          <h2 className="truncate text-h3 text-brand-800">{title}</h2>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * แดชบอร์ด desktop v3 (Claude Design turn 7 "7a"): แถว KPI 4 ใบ → กราฟสะสม 8 คอลัมน์ + การ์ดเข็มทิศ 4 คอลัมน์
 * (บันทึกยอดได้ในที่) → ตารางบันทึกยอดล่าสุด 8 คอลัมน์ + งานวันนี้ 4 คอลัมน์ (เพิ่มงานได้ในบรรทัดท้าย)
 * มือถือใช้ widget grid เดิม — สลับด้วย ResponsiveSwitch ไม่ใช่ CSS (§1.10)
 */
export async function DesktopDashboard({ today, chart }: Props) {
  const monthStart = startOfMonthISO(today);
  const [t, goal, plan, weekTasks, entryStreak, recent] = await Promise.all([
    getTranslations(),
    getMainMonthGoal(monthStart),
    getDayPlan(today),
    getWeekTaskStats(today),
    getEntryStreak(today),
    listEntries({ limit: RECENT_LIMIT }),
  ]);

  const isMetric = goal?.goal_kind === "metric";
  const unit = goal ? goalUnit(goal) : null;
  const isTHB = unit === "THB" || unit === "บาท";

  const [entries, prevMonthToDate, yesterday] = await Promise.all([
    goal && isMetric ? listGoalEntries(goal.id) : Promise.resolve([]),
    sumEntriesBetween(
      startOfMonthISO(addMonthsISO(monthStart, -1)),
      // เทียบ "ถึงวันเดียวกันของเดือนก่อน" ไม่ใช่ทั้งเดือน — ไม่งั้นต้นเดือนจะดูตกเสมอ
      addMonthsISO(today, -1) > endOfMonthISO(addMonthsISO(monthStart, -1))
        ? endOfMonthISO(addMonthsISO(monthStart, -1))
        : addMonthsISO(today, -1),
    ),
    sumEntriesBetween(addDaysISO(today, -1), addDaysISO(today, -1)),
  ]);

  const total = goal && isMetric ? (goal.progress.current ?? 0) : 0;
  const target = goal && isMetric ? (goal.progress.target ?? 0) : 0;
  const todayTotal = sumAmounts(entries.filter((e) => e.entry_date === today));
  const left = goal ? Math.max(0, daysLeft(goal.period, today)) : 0;
  const remaining = Math.max(0, target - total);
  const monthDelta = percentChange(total, prevMonthToDate);
  const todayDelta = percentChange(todayTotal, yesterday);
  const overdue = plan.overdue.length;
  const prevMonthLabel = formatThaiDate(addMonthsISO(monthStart, -1), "monthShort");

  const totalParts = formatValueParts(total, unit);
  const todayParts = formatValueParts(todayTotal, unit);

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
      <StatTile
        className="lg:col-span-3"
        icon={CircleDollarSign}
        label={isTHB ? t("entries.kpi.monthTotal") : t("entries.kpi.monthTotalGeneric")}
        value={totalParts.value}
        unit={totalParts.unit ?? undefined}
        badge={
          monthDelta === null
            ? undefined
            : {
                tone: monthDelta >= 0 ? "success" : "danger",
                icon: monthDelta >= 0 ? "up" : "down",
                text: `${monthDelta > 0 ? "+" : ""}${monthDelta}%`,
              }
        }
        hint={
          monthDelta === null
            ? t("entries.kpi.noCompare")
            : t("entries.kpi.vsLastMonth", { month: prevMonthLabel })
        }
      />
      <StatTile
        className="lg:col-span-3"
        icon={ShoppingBag}
        label={isTHB ? t("entries.kpi.todayTotal") : t("entries.kpi.todayTotalGeneric")}
        value={todayParts.value}
        unit={todayParts.unit ?? undefined}
        badge={
          todayDelta === null
            ? undefined
            : {
                tone: todayDelta >= 0 ? "success" : "danger",
                icon: todayDelta >= 0 ? "up" : "down",
                text: `${todayDelta > 0 ? "+" : ""}${todayDelta}%`,
              }
        }
        hint={todayDelta === null ? t("entries.kpi.noCompare") : t("entries.kpi.vsYesterday")}
      />
      <StatTile
        className="lg:col-span-3"
        icon={SquareCheck}
        label={t("entries.kpi.weekTasks")}
        value={`${weekTasks.done}/${weekTasks.total}`}
        unit={t("widgets.goalProgress.tasksUnit")}
        badge={
          overdue > 0
            ? { tone: "danger", icon: "down", text: `-${overdue}` }
            : { tone: "success", text: t("entries.kpi.noOverdue") }
        }
        hint={overdue > 0 ? t("entries.kpi.overdue") : undefined}
      />
      <StatTile
        className="lg:col-span-3"
        icon={Flame}
        label={t("entries.kpi.entryStreak")}
        value={String(entryStreak)}
        unit={t("periods.day")}
        badge={
          entryStreak >= STREAK_GOAL_DAYS
            ? { tone: "success", icon: "up", text: t("entries.kpi.streakHit") }
            : entryStreak > 0
              ? {
                  tone: "neutral",
                  text: t("entries.kpi.streakToGo", { days: STREAK_GOAL_DAYS - entryStreak }),
                }
              : // ยังไม่เคยบันทึกเลย — "อีก 7 วันครบ 7 วัน" อ่านแล้วงง ใช้ข้อความชวนอย่างเดียว
                undefined
        }
        hint={t("entries.kpi.streakHint")}
      />

      {goal && isMetric ? (
        <>
          <Card
            span="8"
            title={isTHB ? t("entries.chart.title") : t("entries.chart.titleGeneric")}
            action={
              <SegmentedNav
                label={t("calendar.views.label")}
                className="w-auto"
                items={[
                  {
                    key: "week",
                    href: "/dashboard?chart=week",
                    label: t("calendar.views.week"),
                    active: chart === "week",
                  },
                  {
                    key: "month",
                    href: "/dashboard?chart=month",
                    label: t("calendar.views.month"),
                    active: chart === "month",
                  },
                  {
                    key: "year",
                    href: "/dashboard",
                    label: t("periods.year"),
                    active: false,
                    disabled: true,
                    title: t("nav.proSoon"),
                  },
                ]}
              />
            }
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex gap-6">
                <Figure label={t("entries.chart.total")} value={totalParts} />
                <Figure
                  label={t("entries.chart.avgPerDay")}
                  value={formatValueParts(averagePerDay(total, goal.period, today), unit)}
                />
                <Figure
                  label={t("entries.chart.needPerDay")}
                  value={formatValueParts(perDayNeeded(remaining, left), unit)}
                />
              </div>
              <div className="flex gap-4 text-caption font-medium text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-[3px] w-3.5 rounded-full bg-brand-500" aria-hidden="true" />
                  {t("entries.chart.legendTotal")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 border-t-2 border-dashed border-brand-200"
                    aria-hidden="true"
                  />
                  {t("entries.chart.legendPlan")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-accent-500" aria-hidden="true" />
                  {t("entries.chart.legendToday")}
                </span>
              </div>
            </div>
            <SalesChart
              series={cumulativeSeries(entries, goal.period, today)}
              target={target}
              period={goal.period}
              today={today}
              range={chart}
              unit={unit}
              className="-mx-1"
            />
          </Card>

          <Card
            span="4"
            title={t("entries.compass.title")}
            action={<PaceBadge status={goal.pace} />}
          >
            <Link
              href={`/goals/${goal.id}`}
              className="truncate rounded-md text-small text-text-secondary hover:underline focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            >
              {goal.title}
            </Link>
            <div className="flex justify-center py-1">
              <CompassDial
                value={goal.progress.percent}
                className="size-[168px] drop-shadow-dial"
              />
            </div>
            {goal.progress.percent >= 100 ? (
              <p className="text-center text-h3 text-success-800">
                {t("widgets.goalProgress.reached")}
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2">
                <Tile value={String(left)} label={t("entries.compass.daysLeft")} />
                <Tile
                  value={formatValueParts(remaining, unit).value}
                  label={
                    totalParts.unit
                      ? t("entries.compass.remaining", { unit: totalParts.unit })
                      : t("entries.compass.remainingPlain")
                  }
                />
                <Tile
                  value={formatValueParts(perDayNeeded(remaining, left), unit).value}
                  label={
                    totalParts.unit
                      ? t("entries.compass.perDay", { unit: totalParts.unit })
                      : t("entries.compass.perDayPlain")
                  }
                />
              </ul>
            )}
            <QuickEntryForm goal={{ id: goal.id, title: goal.title, unit }} layout="compact" />
          </Card>

          <Card
            span="8"
            title={t("entries.recent.title")}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/entries">{t("entries.recent.viewAll")}</Link>
              </Button>
            }
          >
            <EntriesTable
              rows={recent.rows}
              today={today}
              goalOptions={[
                {
                  id: goal.id,
                  title: goal.title,
                  unit,
                  period_type: goal.period_type,
                  period_start: goal.period_start,
                  target_value: goal.target_value,
                },
              ]}
              compact
              emptyState={
                <p className="py-4 text-body text-text-secondary">{t("entries.recent.empty")}</p>
              }
            />
          </Card>
        </>
      ) : (
        <div className="lg:col-span-12">
          <EmptyState
            illustration="compass"
            eyebrow={t("widgets.goalProgress.empty.eyebrow")}
            title={t("widgets.goalProgress.empty.title")}
            description={t("widgets.goalProgress.empty.description")}
            action={
              <Button asChild>
                <Link href="?new=goal" scroll={false}>
                  <Plus aria-hidden="true" />
                  {t("widgets.goalProgress.empty.cta")}
                </Link>
              </Button>
            }
          />
        </div>
      )}

      <div className="lg:col-span-4">
        <TodayTasksWidget today={today} quickAdd />
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
}: {
  label: string;
  value: { value: string; unit: string | null };
}) {
  return (
    <div>
      <p className="text-caption font-medium text-text-secondary">{label}</p>
      <p className="text-h2 text-text-primary">
        {value.value}
        {value.unit ? (
          <span className="ml-1 text-caption font-medium text-text-secondary">{value.unit}</span>
        ) : null}
      </p>
    </div>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <li className="rounded-md bg-brand-50 px-2 py-2.5 text-center">
      <p className="text-h2 text-brand-800">{value}</p>
      <p className="text-[11px] font-medium text-text-secondary">{label}</p>
    </li>
  );
}
