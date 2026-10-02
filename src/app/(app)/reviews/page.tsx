import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { getHabitWeekStats } from "@/core/habits/queries";
import { getReviewCarryoverTasks, getTimeBlockStatsForRange, getWeeklyReview } from "@/core/planning/queries";
import { getWeekTaskStats } from "@/core/tasks/queries";
import type { AppLocale } from "@/i18n/config";
import { addDaysISO, endOfWeekISO, isISODate, startOfWeekISO, todayBkk } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { WeeklyReviewForm } from "@/components/reviews/WeeklyReviewForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reviews");
  return { title: t("title") };
}

export default async function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  const params = await searchParams;
  const today = todayBkk();
  const requestedWeek = typeof params.weekStart === "string" && isISODate(params.weekStart)
    ? params.weekStart
    : today;
  const weekStart = startOfWeekISO(requestedWeek);
  const selectedWeekEnd = endOfWeekISO(weekStart);
  const previousWeekStart = addDaysISO(weekStart, -7);
  const nextWeekStart = addDaysISO(weekStart, 7);

  const [t, review, previousReview, taskStats, habitStats, timeStats, carryoverTasks] = await Promise.all([
    getTranslations(),
    getWeeklyReview(weekStart),
    getWeeklyReview(previousWeekStart),
    getWeekTaskStats(weekStart),
    getHabitWeekStats(weekStart, selectedWeekEnd),
    getTimeBlockStatsForRange(weekStart, selectedWeekEnd),
    getReviewCarryoverTasks(weekStart),
  ]);
  const locale = (await getLocale()) as AppLocale;

  return (
    <>
      <PageHeader
        title={t("reviews.title")}
        description={t("reviews.description")}
        meta={formatDate(weekStart, "medium", locale)}
      />
      <nav className="mb-4 flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4 py-3 shadow-xs" aria-label={t("reviews.weekNavigation")}>
        <Link className="text-small font-medium text-brand-700 hover:underline" href={`/reviews?weekStart=${addDaysISO(weekStart, -7)}`}>
          {t("reviews.previousWeek")}
        </Link>
        <span className="text-small text-text-secondary">
          {formatDate(weekStart, "short", locale)} – {formatDate(selectedWeekEnd, "short", locale)}
        </span>
        <Link className="text-small font-medium text-brand-700 hover:underline" href={`/reviews?weekStart=${nextWeekStart}`}>
          {t("reviews.nextWeek")}
        </Link>
      </nav>
      {previousReview ? (
        <p className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-small text-brand-800">
          {t("reviews.previousReference")}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <section className="space-y-3 lg:col-span-4" aria-labelledby="review-stats-heading">
          <h2 id="review-stats-heading" className="sr-only">
            {t("reviews.statsHeading")}
          </h2>

          <ReviewMetric
            value={`${taskStats.done}/${taskStats.total}`}
            label={t("reviews.tasksCompleted")}
          />
          <ReviewMetric
            value={habitStats.target > 0 ? `${habitStats.done}/${habitStats.target}` : "—"}
            label={t("reviews.habitsCompleted")}
          />
          <ReviewMetric
            value={formatMinutes(timeStats.minutes)}
            label={t("reviews.plannedTime")}
          />

          <p className="px-1 text-caption text-text-secondary">
            {t("reviews.weekOf", { date: formatDate(weekStart, "medium", locale) })}
          </p>
        </section>

        <section className="lg:col-span-8" aria-labelledby="review-form-heading">
          <h2 id="review-form-heading" className="sr-only">
            {t("reviews.form.title")}
          </h2>
          <WeeklyReviewForm
            weekStart={weekStart}
            initial={review}
            carryoverTasks={carryoverTasks}
            nextWeekStart={nextWeekStart}
          />
        </section>
      </div>
    </>
  );
}

function ReviewMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs">
      <p className="text-4xl font-semibold text-brand-800">{value}</p>
      <p className="mt-1 text-small text-text-secondary">{label}</p>
    </div>
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}