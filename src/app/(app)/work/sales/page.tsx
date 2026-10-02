import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { listEntries } from "@/core/entries/queries";
import { listGoalsWithProgress } from "@/core/goals/queries";
import { goalUnit } from "@/core/goals/schema";
import { getMe } from "@/core/profile/queries";
import { workModeFromProfile } from "@/core/profile/work-modes";
import { startOfMonthISO, todayBkk } from "@/lib/date";
import { EntriesTable } from "@/components/domain/EntriesTable";
import { EmptyState } from "@/components/domain/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { GoalProgressPanel } from "@/components/widgets/GoalProgressPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("workSales") };
}

export default async function SalesPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  const workMode = workModeFromProfile(me.profile.work_mode, me.profile.active_persona);
  if (workMode === "professional") redirect("/work/projects");

  const today = todayBkk();
  const monthStart = startOfMonthISO(today);
  const [t, workGoals] = await Promise.all([
    getTranslations(),
    listGoalsWithProgress({ domainFilter: "work" }),
  ]);
  const monthGoals = workGoals.filter(
    (candidate) => candidate.period_type === "month" && candidate.period_start === monthStart,
  );
  const goal = monthGoals.find((candidate) => candidate.goal_kind === "metric") ?? null;
  const recent = goal ? await listEntries({ goalId: goal.id, limit: 10 }) : { rows: [], total: 0 };
  const goalOptions = goal
    ? [
        {
          id: goal.id,
          title: goal.title,
          unit: goalUnit(goal),
          period_type: goal.period_type,
          period_start: goal.period_start,
          target_value: goal.target_value,
        },
      ]
    : [];

  return (
    <>
      <PageHeader title={t("nav.workSales")} meta={t("entries.recent.title")} />

      {goal ? (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
          <section className="min-w-0 rounded-xl border border-border bg-bg-surface p-5 shadow-xs lg:col-span-5">
            <GoalProgressPanel goal={goal} others={[]} today={today} />
          </section>
          <section
            className="min-w-0 rounded-xl border border-border bg-bg-surface p-5 shadow-xs lg:col-span-7"
            aria-labelledby="sales-history-heading"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="sales-history-heading" className="text-h2 text-text-primary">
                {t("entries.recent.title")}
              </h2>
              <Button variant="outline" size="sm" asChild>
                <Link href={`?new=entry&goal=${goal.id}`} scroll={false}>
                  {t("entries.new")}
                </Link>
              </Button>
            </div>
            <EntriesTable
              rows={recent.rows}
              today={today}
              goalOptions={goalOptions}
              emptyState={
                <p className="py-5 text-small text-text-secondary">{t("entries.recent.empty")}</p>
              }
            />
          </section>
        </div>
      ) : (
        <EmptyState
          illustration="compass"
          title={t("widgets.goalProgress.empty.title")}
          description={t("widgets.goalProgress.empty.description")}
          action={
            <Button asChild>
              <Link href="?new=goal&domain=work" scroll={false}>
                {t("widgets.goalProgress.empty.cta")}
              </Link>
            </Button>
          }
        />
      )}
    </>
  );
}
