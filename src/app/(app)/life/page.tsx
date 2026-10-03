import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { cn } from "cn";

import { getActiveHabits, getHabitWeekStats } from "@/core/habits/queries";
import { listGoalsWithProgress } from "@/core/goals/queries";
import { endOfWeekISO, startOfWeekISO, todayBkk } from "@/lib/date";
import { GoalCard } from "@/components/domain/GoalCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { HabitCreateForm } from "@/components/habits/HabitCreateForm";
import { HabitList } from "@/components/habits/HabitList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("life");
  return { title: t("title") };
}

export default async function LifePage() {
  const today = todayBkk();
  const [t, goals, habits, habitStats] = await Promise.all([
    getTranslations(),
    listGoalsWithProgress({ domainFilter: "life" }),
    getActiveHabits(today),
    getHabitWeekStats(startOfWeekISO(today), endOfWeekISO(today)),
  ]);
  const hasGoals = goals.length > 0;

  return (
    <>
      <PageHeader title={t("life.title")} description={t("life.description")} />
      <div className={cn("grid gap-4", hasGoals && "lg:grid-cols-12 lg:gap-6")}>
        <section
          className={cn("space-y-3", hasGoals && "lg:col-span-7")}
          aria-labelledby="life-goals-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="life-goals-heading" className="text-h2 text-text-primary">
              {t("life.goalsHeading")}
            </h2>
            <Link
              href="/goals?domain=life"
              className="text-small font-medium text-brand-600 hover:underline"
            >
              {t("life.viewGoals")}
            </Link>
          </div>
          {goals.length === 0 ? (
            <p className="rounded-xl border border-border bg-bg-surface p-6 text-small text-text-secondary shadow-xs">
              {t("life.emptyGoals")}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {goals.slice(0, 6).map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </section>
        <section
          className={cn(
            "rounded-xl border border-border bg-bg-surface p-5 shadow-xs",
            hasGoals && "lg:col-span-5",
          )}
          aria-labelledby="life-habits-heading"
        >
          <h2 id="life-habits-heading" className="text-h2 text-text-primary">
            {t("life.habitsHeading")}
          </h2>
          <p className="mt-1 text-small text-text-secondary">{t("life.habitsDescription")}</p>
          <div className="mt-4 rounded-lg bg-brand-50 p-4" aria-label={t("life.habitProgress")}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-caption text-text-secondary">{t("life.habitProgress")}</p>
                <p className="text-h2 text-text-primary">
                  {habitStats.done} / {habitStats.target}
                  <span className="ml-1 text-small font-medium text-text-secondary">
                    {t("life.thisWeek")}
                  </span>
                </p>
              </div>
              <span className="text-h2 text-text-primary">
                {habitStats.target > 0
                  ? Math.round((habitStats.done / habitStats.target) * 100)
                  : 0}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-surface">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{
                  width: `${habitStats.target > 0 ? Math.min(100, (habitStats.done / habitStats.target) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="mt-4">
            <HabitCreateForm
              goalOptions={goals.map((goal) => ({
                id: goal.id,
                title: goal.title,
                domain: goal.domain,
              }))}
            />
          </div>
          <div className="mt-4">
            <HabitList habits={habits} date={today} />
          </div>
        </section>
      </div>
    </>
  );
}
