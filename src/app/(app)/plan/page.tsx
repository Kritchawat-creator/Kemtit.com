import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Plus,
  ReceiptText,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { listCalendarEvents } from "@/core/calendar-events/queries";
import { itemsByDay } from "@/core/domain/calendar";
import { overlaps, suggestChildPeriods } from "@/core/domain/periods";
import { listFinanceBills } from "@/core/finance/queries";
import { listGoalsWithProgress, listParentCandidates } from "@/core/goals/queries";
import { parsePlannerView, plannerPeriod, shiftPlannerDate } from "@/core/planning/planner";
import { buildPlannerGoalHref } from "@/core/planning/role-workflow";
import { getMe } from "@/core/profile/queries";
import { getRangeTasks } from "@/core/tasks/queries";
import type { AppLocale } from "@/i18n/config";
import { addMonthsISO, eachDayISO, isISODate, todayBkk } from "@/lib/date";
import { formatDate, formatTHB, formatYear } from "@/lib/format";
import { GoalCard } from "@/components/domain/GoalCard";
import { WorkflowGuide } from "@/components/planning/WorkflowGuide";
import { PeriodSelector } from "@/components/domain/PeriodSelector";
import { TaskList } from "@/components/domain/TaskList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("planner");
  return { title: t("title") };
}

export default async function PlannerPage({ searchParams }: PageProps<"/plan">) {
  const params = await searchParams;
  const today = todayBkk();
  const view = parsePlannerView(params.view);
  const date = typeof params.date === "string" && isISODate(params.date) ? params.date : today;
  const period = plannerPeriod(view, date);
  const [t, goals, goalOptions, me] = await Promise.all([
    getTranslations(),
    listGoalsWithProgress(),
    listParentCandidates(),
    getMe(),
  ]);
  const locale = (await getLocale()) as AppLocale;
  const periodGoals = goals.filter((goal) => overlaps(goal.period, period));
  const currentPeriodGoal =
    goals.find((goal) => goal.period_type === view && goal.period_start === period.start) ?? null;
  const previous = shiftPlannerDate(view, date, -1);
  const next = shiftPlannerDate(view, date, 1);
  const label =
    view === "year"
      ? formatYear(period.start, locale)
      : view === "month"
        ? formatDate(period.start, "monthYear", locale)
        : `${formatDate(period.start, "short", locale)} – ${formatDate(period.end, "medium", locale)}`;

  return (
    <>
      <PageHeader
        title={t("planner.title")}
        description={t("planner.description")}
        meta={label}
        toolbarStart={
          <PeriodSelector
            label={t("planner.viewLabel")}
            items={(["year", "month", "week"] as const).map((candidate) => ({
              key: candidate,
              href: `/plan?view=${candidate}&date=${date}`,
              label: t(`planner.views.${candidate}`),
              active: candidate === view,
            }))}
          />
        }
        toolbarEnd={
          currentPeriodGoal ? (
            <Button asChild variant="outline">
              <Link href={buildPlannerGoalHref(view, date)} scroll={false}>
                <Plus aria-hidden="true" />
                {t("workflowGuide.addAnotherGoal")}
              </Link>
            </Button>
          ) : null
        }
      />

      <WorkflowGuide
        roleCode={me?.profile.role_code}
        horizon={view}
        selectedDate={date}
        primaryAction={
          currentPeriodGoal
            ? {
                kind: "goal",
                href: "/goals/" + currentPeriodGoal.id,
                title: currentPeriodGoal.title,
              }
            : { kind: "choose-goal", href: buildPlannerGoalHref(view, date) }
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-surface p-3 shadow-xs">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/plan?view=${view}&date=${previous}`}>
            <ArrowLeft aria-hidden="true" />
            <span className="sr-only">{t("planner.previous")}</span>
          </Link>
        </Button>
        <div className="text-center">
          <p className="text-body font-semibold text-brand-800">{label}</p>
          <Link
            href={`/plan?view=${view}&date=${today}`}
            className="text-caption text-brand-600 hover:underline"
          >
            {t("planner.today")}
          </Link>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/plan?view=${view}&date=${next}`}>
            <ArrowRight aria-hidden="true" />
            <span className="sr-only">{t("planner.next")}</span>
          </Link>
        </Button>
      </div>

      {view === "year" ? (
        <YearPlanner date={period.start} goals={periodGoals} />
      ) : view === "month" ? (
        <MonthPlanner date={period.start} goals={periodGoals} />
      ) : (
        <WeekPlanner
          from={period.start}
          to={period.end}
          today={today}
          goals={periodGoals}
          goalOptions={goalOptions}
        />
      )}
    </>
  );
}

async function YearPlanner({
  date,
  goals,
}: {
  date: string;
  goals: Awaited<ReturnType<typeof listGoalsWithProgress>>;
}) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const yearGoals = goals.filter((goal) => goal.period_type === "year");
  const months = Array.from({ length: 12 }, (_, index) => addMonthsISO(date, index));

  return (
    <div className="space-y-6">
      {yearGoals.length > 0 ? (
        <section aria-labelledby="planner-year-goals">
          <h2 id="planner-year-goals" className="mb-2 text-h2 text-text-primary">
            {t("planner.yearGoals")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {yearGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="planner-months">
        <h2 id="planner-months" className="mb-2 text-h2 text-text-primary">
          {t("planner.months")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {months.map((monthStart) => {
            const monthGoals = goals.filter(
              (goal) => goal.period_type === "month" && goal.period_start === monthStart,
            );
            return (
              <Link
                key={monthStart}
                href={`/plan?view=month&date=${monthStart}`}
                className="rounded-xl border border-border bg-bg-surface p-4 shadow-xs transition-transform hover:-translate-y-0.5"
              >
                <p className="text-body font-semibold text-brand-800">
                  {formatDate(monthStart, "monthYear", locale)}
                </p>
                <p className="mt-1 text-small text-text-secondary">
                  {t("planner.goalCount", { count: monthGoals.length })}
                </p>
                {monthGoals.slice(0, 2).map((goal) => (
                  <p key={goal.id} className="mt-2 truncate text-small text-text-primary">
                    {goal.title}
                  </p>
                ))}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

async function MonthPlanner({
  date,
  goals,
}: {
  date: string;
  goals: Awaited<ReturnType<typeof listGoalsWithProgress>>;
}) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const monthPeriod = plannerPeriod("month", date);
  const monthGoals = goals.filter(
    (goal) => goal.period_type === "month" && goal.period_start === monthPeriod.start,
  );
  const weeks = suggestChildPeriods(monthPeriod, "week");

  return (
    <div className="space-y-6">
      {monthGoals.length > 0 ? (
        <section aria-labelledby="planner-month-goals">
          <h2 id="planner-month-goals" className="mb-2 text-h2 text-text-primary">
            {t("planner.monthGoals")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {monthGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="planner-weeks">
        <h2 id="planner-weeks" className="mb-2 text-h2 text-text-primary">
          {t("planner.weeks")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {weeks.map((week) => {
            const weekGoals = goals.filter(
              (goal) => goal.period_type === "week" && overlaps(goal.period, week),
            );
            return (
              <Link
                key={week.start}
                href={`/plan?view=week&date=${week.start}`}
                className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-body font-semibold text-brand-800">
                      {formatDate(week.start, "short", locale)} –{" "}
                      {formatDate(week.end, "short", locale)}
                    </p>
                    <p className="mt-1 text-small text-text-secondary">
                      {t("planner.goalCount", { count: weekGoals.length })}
                    </p>
                  </div>
                  <CalendarDays className="size-5 text-brand-500" aria-hidden="true" />
                </div>
                {weekGoals.slice(0, 3).map((goal) => (
                  <p key={goal.id} className="mt-2 truncate text-small text-text-primary">
                    {goal.title}
                  </p>
                ))}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

async function WeekPlanner({
  from,
  to,
  today,
  goals,
  goalOptions,
}: {
  from: string;
  to: string;
  today: string;
  goals: Awaited<ReturnType<typeof listGoalsWithProgress>>;
  goalOptions: Awaited<ReturnType<typeof listParentCandidates>>;
}) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const [{ tasks, completions, occurrences }, events, bills] = await Promise.all([
    getRangeTasks(from, to),
    listCalendarEvents(from, to),
    listFinanceBills(from, to),
  ]);
  const byDay = itemsByDay(tasks, completions, from, to, occurrences);
  const weekGoals = goals.filter(
    (goal) => goal.period_type === "week" && overlaps(goal.period, plannerPeriod("week", from)),
  );
  const days = eachDayISO(from, to);

  return (
    <div className="space-y-6">
      {weekGoals.length > 0 ? (
        <section aria-labelledby="planner-week-goals">
          <h2 id="planner-week-goals" className="mb-2 text-h2 text-text-primary">
            {t("planner.weekGoals")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {weekGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="planner-week-days">
        <h2 id="planner-week-days" className="mb-2 text-h2 text-text-primary">
          {t("planner.weekPlan")}
        </h2>
        <div className="grid min-w-0 items-start gap-4 min-[761px]:grid-cols-2 min-[1200px]:grid-cols-3">
          {days.map((day) => {
            const items = byDay[day] ?? [];
            const dayEvents = events.filter((event) => event.event_date === day);
            const dayBills = bills.filter((bill) => bill.due_date === day);
            const previewEvents = dayEvents.slice(0, 5);
            const previewBills = dayBills.slice(0, 5 - previewEvents.length);
            const previewItems = items.slice(0, 5 - previewEvents.length - previewBills.length);
            const total = dayEvents.length + dayBills.length + items.length;
            const remaining =
              total - previewEvents.length - previewBills.length - previewItems.length;
            return (
              <section
                key={day}
                className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
              >
                <div className="mb-3 flex min-h-14 min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body font-semibold break-words text-brand-800">
                      {formatDate(day, "weekday", locale)}
                    </p>
                    <p className="text-caption text-text-secondary">
                      {t("planner.taskCount", { count: items.length })}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="min-h-11" asChild>
                    <Link href={day === today ? "/today" : `/calendar?view=day&date=${day}`}>
                      {day === today ? t("planner.openToday") : t("planner.openDay")}
                    </Link>
                  </Button>
                </div>
                <div className="max-h-[22rem] min-w-0 overflow-y-auto overscroll-contain pr-1">
                  {previewEvents.length > 0 || previewBills.length > 0 ? (
                    <div className="mb-3 space-y-2">
                      {previewEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex min-h-11 min-w-0 items-start gap-2 rounded-lg bg-brand-50 p-2.5"
                        >
                          <CalendarClock
                            className="mt-0.5 size-4 shrink-0 text-brand-600"
                            aria-hidden="true"
                          />
                          <span
                            title={event.title}
                            className="min-w-0 flex-1 truncate text-small text-text-primary"
                          >
                            {event.title}
                          </span>
                        </div>
                      ))}
                      {previewBills.map((bill) => (
                        <div
                          key={bill.id}
                          className="flex min-h-11 min-w-0 items-start gap-2 rounded-lg bg-bg-subtle p-2.5"
                        >
                          <ReceiptText
                            className="mt-0.5 size-4 shrink-0 text-brand-600"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              title={bill.title}
                              className="block truncate text-small text-text-primary"
                            >
                              {bill.title}
                            </span>
                            {bill.amount != null ? (
                              <span className="text-caption text-text-secondary">
                                {formatTHB(Number(bill.amount), locale)}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {previewItems.length > 0 ? (
                    <TaskList
                      items={previewItems}
                      today={today}
                      goalOptions={goalOptions}
                      groupByStatus={false}
                      showGoal
                      variant="plain"
                    />
                  ) : null}
                  {total === 0 ? (
                    <div className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg bg-bg-subtle px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-small font-medium break-words text-text-primary">
                          {t("planner.emptyDay")}
                        </p>
                        <p className="text-caption break-words text-text-secondary">
                          {t("planner.emptyDayDescription")}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="min-h-11 shrink-0" asChild>
                        <Link href={`/plan?view=week&date=${day}&new=task`} scroll={false}>
                          {t("planner.addTask")}
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
                {remaining > 0 ? (
                  <div className="mt-3 flex min-h-11 items-center border-t border-border pt-2">
                    <Link
                      href={`/calendar?view=day&date=${day}`}
                      aria-label={t("calendar.openDay", { date: formatDate(day, "long", locale) })}
                      className="inline-flex min-h-11 items-center rounded-md text-small font-medium text-brand-600 hover:underline focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
                    >
                      {t("calendar.more", { count: remaining })}
                    </Link>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
