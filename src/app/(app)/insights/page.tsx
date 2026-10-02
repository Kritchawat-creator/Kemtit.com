import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { DOMAINS } from "@/core/domain/domains";
import { getInsightsSnapshot } from "@/core/insights/queries";
import type { AppLocale } from "@/i18n/config";
import { todayBkk } from "@/lib/date";
import { formatDate, formatNumber, formatPercent, formatTHB } from "@/lib/format";
import { InsightCard } from "@/components/domain/InsightCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { SegmentedNav } from "@/components/ui/segmented-nav";

const INSIGHT_TABS = [
  "overview",
  "productivity",
  "time",
  "finance",
  "goals",
  "routine",
  "lifeBalance",
] as const;
type InsightTab = (typeof INSIGHT_TABS)[number];

function parseTab(value: string | string[] | undefined): InsightTab {
  return typeof value === "string" && (INSIGHT_TABS as readonly string[]).includes(value)
    ? (value as InsightTab)
    : "overview";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("insights");
  return { title: t("title") };
}

export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
  const params = await searchParams;
  const tab = parseTab(params.tab);
  const today = todayBkk();
  const [t, snapshot] = await Promise.all([
    getTranslations(),
    getInsightsSnapshot(today),
  ]);
  const locale = (await getLocale()) as AppLocale;

  const nav = (
    <SegmentedNav
      scrollable
      label={t("insights.tabsLabel")}
      items={INSIGHT_TABS.map((candidate) => ({
        key: candidate,
        href: candidate === "overview" ? "/insights" : `/insights?tab=${candidate}`,
        label: t(`insights.tabs.${candidate}`),
        active: candidate === tab,
      }))}
    />
  );

  return (
    <>
      <PageHeader
        title={t("insights.title")}
        description={t("insights.description")}
        meta={formatDate(snapshot.ranges.weekStart, "medium", locale)}
      />

      <div className="mb-4">{nav}</div>

      {tab === "overview" ? <Overview snapshot={snapshot} /> : null}
      {tab === "productivity" ? <Productivity snapshot={snapshot} /> : null}
      {tab === "time" ? <TimeReport snapshot={snapshot} /> : null}
      {tab === "finance" ? <FinanceReport snapshot={snapshot} /> : null}
      {tab === "goals" ? <GoalsReport snapshot={snapshot} /> : null}
      {tab === "routine" ? <RoutineReport snapshot={snapshot} /> : null}
      {tab === "lifeBalance" ? <LifeBalanceReport snapshot={snapshot} /> : null}
    </>
  );
}

type Snapshot = Awaited<ReturnType<typeof getInsightsSnapshot>>;

async function Overview({ snapshot }: { snapshot: Snapshot }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InsightCard
          label={t("insights.metrics.tasks")}
          value={`${snapshot.productivity.tasksDone}/${snapshot.productivity.tasksTotal}`}
          helper={t("insights.metrics.thisWeek")}
        />
        <InsightCard
          label={t("insights.metrics.time")}
          value={formatDuration(snapshot.time.minutes)}
          helper={t("insights.metrics.plannedTime")}
        />
        <InsightCard
          label={t("insights.metrics.routine")}
          value={
            snapshot.routine.target > 0
              ? `${snapshot.routine.done}/${snapshot.routine.target}`
              : "—"
          }
          helper={t("insights.metrics.habitTarget")}
        />
        <InsightCard
          label={t("insights.metrics.finance")}
          value={formatTHB(snapshot.finance.balance, locale)}
          helper={t("insights.metrics.netThisMonth")}
        />
      </div>

      <section className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs">
        <h2 className="text-h2 text-text-primary">{t("insights.overview.direction")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MiniMetric
            label={t("insights.overview.activeGoals")}
            value={formatNumber(snapshot.goals.active, locale)}
          />
          <MiniMetric
            label={t("insights.overview.averageGoalProgress")}
            value={formatPercent(snapshot.goals.averageProgress / 100, locale)}
          />
          <MiniMetric
            label={t("insights.overview.streak")}
            value={t("insights.values.days", { count: snapshot.productivity.streakDays })}
          />
        </div>
      </section>
    </div>
  );
}

async function Productivity({ snapshot }: { snapshot: Snapshot }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  return (
    <ReportGrid>
      <InsightCard
        label={t("insights.productivity.completionRate")}
        value={
          snapshot.productivity.tasksTotal > 0
            ? formatPercent(snapshot.productivity.completionRate, locale)
            : "—"
        }
        helper={t("insights.metrics.thisWeek")}
      />
      <InsightCard
        label={t("insights.productivity.tasksDone")}
        value={formatNumber(snapshot.productivity.tasksDone, locale)}
        helper={t("insights.productivity.ofTasks", {
          total: snapshot.productivity.tasksTotal,
        })}
      />
      <InsightCard
        label={t("insights.productivity.streak")}
        value={t("insights.values.days", { count: snapshot.productivity.streakDays })}
        helper={t("insights.productivity.streakHint")}
      />
    </ReportGrid>
  );
}

async function TimeReport({ snapshot }: { snapshot: Snapshot }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  return (
    <ReportGrid>
      <InsightCard
        label={t("insights.time.blocks")}
        value={formatNumber(snapshot.time.blocks, locale)}
        helper={t("insights.metrics.thisWeek")}
      />
      <InsightCard
        label={t("insights.time.planned")}
        value={formatDuration(snapshot.time.minutes)}
        helper={t("insights.time.plannedHint")}
      />
      <InsightCard
        label={t("insights.time.average")}
        value={
          snapshot.time.blocks > 0
            ? formatDuration(Math.round(snapshot.time.minutes / snapshot.time.blocks))
            : "—"
        }
        helper={t("insights.time.averageHint")}
      />
    </ReportGrid>
  );
}

async function FinanceReport({ snapshot }: { snapshot: Snapshot }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  return (
    <div className="space-y-6">
      <ReportGrid desktopColumns={4}>
        <InsightCard
          label={t("insights.finance.income")}
          value={formatTHB(snapshot.finance.income, locale)}
          helper={t("insights.metrics.thisMonth")}
        />
        <InsightCard
          label={t("insights.finance.expense")}
          value={formatTHB(snapshot.finance.expense, locale)}
          helper={t("insights.metrics.thisMonth")}
        />
        <InsightCard
          label={t("insights.finance.balance")}
          value={formatTHB(snapshot.finance.balance, locale)}
          helper={t("insights.finance.net")}
        />
        <InsightCard
          label={t("insights.finance.budgetRemaining")}
          value={
            snapshot.finance.budgetRemaining == null
              ? "—"
              : formatTHB(snapshot.finance.budgetRemaining, locale)
          }
          helper={
            snapshot.finance.budget == null
              ? t("insights.finance.noBudget")
              : t("insights.finance.ofBudget", {
                  amount: formatTHB(snapshot.finance.budget, locale),
                })
          }
        />
      </ReportGrid>
      <section className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs">
        <h2 className="text-h2 text-text-primary">{t("insights.finance.bills")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MiniMetric
            label={t("insights.finance.dueBills")}
            value={formatNumber(snapshot.finance.dueBills, locale)}
          />
          <MiniMetric
            label={t("insights.finance.paidBills")}
            value={formatNumber(snapshot.finance.paidBills, locale)}
          />
        </div>
      </section>
    </div>
  );
}

async function GoalsReport({ snapshot }: { snapshot: Snapshot }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  return (
    <ReportGrid>
      <InsightCard
        label={t("insights.goals.active")}
        value={formatNumber(snapshot.goals.active, locale)}
        helper={t("insights.goals.activeHint")}
      />
      <InsightCard
        label={t("insights.goals.completed")}
        value={formatNumber(snapshot.goals.completed, locale)}
        helper={t("insights.goals.completedHint")}
      />
      <InsightCard
        label={t("insights.goals.averageProgress")}
        value={
          snapshot.goals.active > 0
            ? formatPercent(snapshot.goals.averageProgress / 100, locale)
            : "—"
        }
        helper={t("insights.goals.averageHint")}
      />
    </ReportGrid>
  );
}

async function RoutineReport({ snapshot }: { snapshot: Snapshot }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  return (
    <ReportGrid>
      <InsightCard
        label={t("insights.routine.today")}
        value={
          snapshot.routine.todayTotal > 0
            ? `${snapshot.routine.todayDone}/${snapshot.routine.todayTotal}`
            : "—"
        }
        helper={t("insights.routine.todayHint")}
      />
      <InsightCard
        label={t("insights.routine.week")}
        value={
          snapshot.routine.target > 0
            ? `${snapshot.routine.done}/${snapshot.routine.target}`
            : "—"
        }
        helper={t("insights.routine.weekHint")}
      />
      <InsightCard
        label={t("insights.routine.habits")}
        value={formatNumber(snapshot.routine.habits, locale)}
        helper={t("insights.routine.habitsHint")}
      />
    </ReportGrid>
  );
}

async function LifeBalanceReport({ snapshot }: { snapshot: Snapshot }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const total = snapshot.lifeBalance.reduce((sum, row) => sum + row.items, 0);

  return (
    <section className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs">
      <h2 className="text-h2 text-text-primary">{t("insights.lifeBalance.title")}</h2>
      <p className="mt-1 text-small text-text-secondary">
        {t("insights.lifeBalance.description")}
      </p>
      <div className="mt-5 space-y-4">
        {DOMAINS.map((domain) => {
          const items = snapshot.lifeBalance.find((row) => row.domain === domain)?.items ?? 0;
          const ratio = total > 0 ? items / total : 0;
          return (
            <div key={domain}>
              <div className="mb-1 flex items-center justify-between gap-3 text-small">
                <span className="font-medium text-text-primary">
                  {t(`domains.${domain}`)}
                </span>
                <span className="text-text-secondary">
                  {t("insights.lifeBalance.items", { count: items })}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={t(`domains.${domain}`)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(ratio * 100)}
                className="h-2 overflow-hidden rounded-full bg-brand-50"
              >
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-caption text-text-secondary">
        {t("insights.lifeBalance.disclaimer")}
      </p>
    </section>
  );
}

function ReportGrid({
  children,
  desktopColumns = 3,
}: {
  children: ReactNode;
  desktopColumns?: 3 | 4;
}) {
  const desktopColumnClass = desktopColumns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return <div className={`grid gap-3 sm:grid-cols-2 ${desktopColumnClass}`}>{children}</div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg-subtle p-4">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 text-h2 text-text-primary">{value}</p>
    </div>
  );
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}
