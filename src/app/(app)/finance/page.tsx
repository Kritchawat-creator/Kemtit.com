import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { sumAmounts } from "@/core/domain/entries";
import { listGoalEntries } from "@/core/entries/queries";
import {
  getFinanceBudget,
  getFinanceMonthSummary,
  listFinanceBills,
  listFinanceGoalDetails,
} from "@/core/finance/queries";
import type { FinanceGoalType } from "@/core/finance/schema";
import { listGoalsWithProgress } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import type { AppLocale } from "@/i18n/config";
import { endOfMonthISO, startOfMonthISO, todayBkk } from "@/lib/date";
import { formatDate, formatTHB, formatValueWithUnit } from "@/lib/format";
import { GoalCard } from "@/components/domain/GoalCard";
import { FinanceBills } from "@/components/finance/FinanceBills";
import { FinanceBudgetForm } from "@/components/finance/FinanceBudgetForm";
import { FinanceGoalSettings } from "@/components/finance/FinanceGoalSettings";
import { FinanceStarterGuide } from "@/components/finance/FinanceStarterGuide";
import { FinanceTransactionForm } from "@/components/finance/FinanceTransactionForm";
import { PageHeader } from "@/components/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance");
  return { title: t("title") };
}

export default async function FinancePage() {
  const today = todayBkk();
  const monthStart = startOfMonthISO(today);
  const monthEnd = endOfMonthISO(today);
  const [t, allGoals, details, summary, budget, bills] = await Promise.all([
    getTranslations(),
    listGoalsWithProgress({ domainFilter: "life" }),
    listFinanceGoalDetails(),
    getFinanceMonthSummary(monthStart, monthEnd),
    getFinanceBudget(monthStart),
    listFinanceBills(),
  ]);
  const locale = (await getLocale()) as AppLocale;
  const goals = allGoals.filter((goal) => goal.domain === "finance");
  const detailsByGoal = new Map(details.map((detail) => [detail.goal_id, detail]));

  type GoalEntries = Awaited<ReturnType<typeof listGoalEntries>>;
  const entryRows: [string, GoalEntries][] = await Promise.all(
    goals.map(async (goal) => {
      if (goal.goal_kind !== "metric") return [goal.id, [] as GoalEntries];
      return [goal.id, await listGoalEntries(goal.id)];
    }),
  );
  const entriesByGoal = new Map(entryRows);
  const financeTypeLabels: Record<FinanceGoalType, string> = {
    saving: t("finance.types.saving"),
    investment: t("finance.types.investment"),
    debt: t("finance.types.debt"),
  };
  const budgetAmount = budget ? Number(budget.amount) : null;
  const budgetRemaining =
    budgetAmount == null ? null : Math.max(0, budgetAmount - summary.expense);
  const showStarterGuide =
    goals.length === 0 &&
    summary.transactions.length === 0 &&
    bills.length === 0 &&
    budget === null;

  return (
    <>
      <PageHeader title={t("finance.title")} description={t("finance.description")} />

      {showStarterGuide ? <FinanceStarterGuide /> : null}

      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={t("finance.operations.summary")}
      >
        <FinanceMetric label={t("finance.operations.income")} value={formatTHB(summary.income, locale)} />
        <FinanceMetric label={t("finance.operations.expense")} value={formatTHB(summary.expense, locale)} />
        <FinanceMetric label={t("finance.operations.balance")} value={formatTHB(summary.balance, locale)} />
        <FinanceMetric
          label={t("finance.operations.budgetRemaining")}
          value={budgetRemaining == null ? "—" : formatTHB(budgetRemaining, locale)}
        />
      </section>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12 lg:gap-6">
        <section
          className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs lg:col-span-7"
          aria-labelledby="finance-transaction-heading"
        >
          <h2 id="finance-transaction-heading" className="text-h2 text-text-primary">
            {t("finance.operations.addTransaction")}
          </h2>
          <p className="mt-1 mb-4 text-small text-text-secondary">
            {t("finance.operations.transactionHint")}
          </p>
          <FinanceTransactionForm today={today} />
        </section>

        <section
          className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs lg:col-span-5"
          aria-labelledby="finance-budget-heading"
        >
          <h2 id="finance-budget-heading" className="text-h2 text-text-primary">
            {t("finance.operations.monthlyBudget")}
          </h2>
          <p className="mt-1 mb-4 text-small text-text-secondary">
            {t("finance.operations.budgetHint")}
          </p>
          <FinanceBudgetForm
            monthStart={monthStart}
            initialAmount={budgetAmount}
          />
        </section>
      </div>

      <section
        className="mt-4 rounded-xl border border-border bg-bg-surface p-5 shadow-xs lg:mt-6"
        aria-labelledby="finance-bills-heading"
      >
        <h2 id="finance-bills-heading" className="text-h2 text-text-primary">
          {t("finance.operations.bills")}
        </h2>
        <p className="mt-1 mb-4 text-small text-text-secondary">
          {t("finance.operations.billsHint")}
        </p>
        <FinanceBills bills={bills} today={today} />
      </section>

      <section className="mt-4 lg:mt-6" aria-labelledby="finance-recent-heading">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="finance-recent-heading" className="text-h2 text-text-primary">
            {t("finance.operations.recentTransactions")}
          </h2>
          <span className="text-caption text-text-secondary">
            {formatDate(monthStart, "monthYear", locale)}
          </span>
        </div>
        {summary.transactions.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg-surface p-5 text-small text-text-secondary shadow-xs">
            {t("finance.operations.noTransactions")}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-bg-surface px-5 shadow-xs">
            {summary.transactions.slice(0, 20).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-body text-text-primary">{row.title}</p>
                  <p className="text-caption text-text-secondary">
                    {formatDate(row.occurred_on, "medium", locale)}
                  </p>
                </div>
                <span
                  className={
                    row.transaction_type === "income"
                      ? "shrink-0 font-semibold text-success-700"
                      : "shrink-0 font-semibold text-text-primary"
                  }
                >
                  {row.transaction_type === "income" ? "+" : "−"}
                  {formatTHB(Number(row.amount), locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 lg:mt-6" aria-labelledby="finance-goals-heading">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="finance-goals-heading" className="text-h2 text-text-primary">
            {t("finance.operations.goals")}
          </h2>
          <Link
            href="/goals?new=goal&domain=finance&goalKind=metric&unit=THB"
            className="text-small font-medium text-brand-600 hover:underline"
          >
            {t("finance.createGoal")}
          </Link>
        </div>

        {goals.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg-surface p-6 text-small text-text-secondary shadow-xs">
            <p>{t("finance.empty")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const detail = detailsByGoal.get(goal.id) ?? null;
              const unit = goalUnit(goal);
              const monthEntries = (entriesByGoal.get(goal.id) ?? []).filter(
                (entry) => entry.entry_date >= monthStart && entry.entry_date <= today,
              );
              const monthTotal = sumAmounts(monthEntries);
              const monthlyTarget = detail?.monthly_target ?? null;

              return (
                <section
                  key={goal.id}
                  className="grid gap-3 rounded-xl bg-bg-surface p-4 shadow-xs lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)] lg:items-start lg:p-5"
                  aria-label={goal.title}
                >
                  <div className="min-w-0">
                    <GoalCard goal={goal} className="shadow-none" />
                  </div>

                  {goal.goal_kind === "metric" ? (
                    <div className="space-y-4 rounded-xl bg-bg-subtle p-4">
                      <div>
                        <p className="text-caption font-medium text-text-secondary">
                          {t("finance.thisMonth")}
                        </p>
                        <p className="mt-1 text-h2 text-text-primary">
                          {formatValueWithUnit(monthTotal, unit, locale)}
                          {monthlyTarget ? (
                            <span className="ml-1 text-small font-medium text-text-secondary">
                              / {formatValueWithUnit(monthlyTarget, unit, locale)}
                            </span>
                          ) : null}
                        </p>
                        {detail ? (
                          <p className="mt-1 text-caption text-text-secondary">
                            {financeTypeLabels[detail.finance_type as FinanceGoalType]}
                          </p>
                        ) : (
                          <p className="mt-1 text-caption text-text-secondary">
                            {t("finance.configureHint")}
                          </p>
                        )}
                      </div>

                      <FinanceGoalSettings goalId={goal.id} initial={detail} />
                    </div>
                  ) : (
                    <p className="rounded-xl bg-bg-subtle p-4 text-small text-text-secondary">
                      {t("finance.metricRequired")}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function FinanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4 shadow-xs">
      <p className="text-caption text-text-secondary">{label}</p>
      <p className="mt-1 text-h2 text-text-primary">{value}</p>
    </div>
  );
}
