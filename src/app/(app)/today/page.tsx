import {
  CheckCircle2,
  Clock3,
  Gauge,
  HeartPulse,
  Inbox,
  ListTodo,
  NotebookPen,
  ReceiptText,
  Sparkles,
  Target,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { listCalendarEvents } from "@/core/calendar-events/queries";
import { listFinanceBills } from "@/core/finance/queries";
import { listNotes } from "@/core/notes/queries";
import { calculateCapacity, calculateEffectiveAvailableMinutes } from "@/core/planning/capacity";
import { calculateDayAvailability } from "@/core/planning/availability";
import { defaultDailyPlanBudget, orderTasksByPriority } from "@/core/planning/workflow-suggestions";
import {
  getDailyPlan,
  getPlanningPreferences,
  getTimeBlocksForDate,
} from "@/core/planning/queries";
import { domainInScope, isScope, type Scope } from "@/core/profile/scope";
import { getMe } from "@/core/profile/queries";
import { getDayPlan } from "@/core/tasks/queries";
import type { DayPlan, DayTaskItem } from "@/core/domain/dayplan";
import type { Domain } from "@/core/domain/domains";
import type { TaskWithGoal } from "@/core/tasks/schema";
import { ROUTES } from "@/core/profile/onboarding";
import { APP_TIME_ZONE, type AppLocale } from "@/i18n/config";
import { startOfMonthISO, todayBkk } from "@/lib/date";
import { formatDate, formatTHB } from "@/lib/format";
import { QuickTaskInput } from "@/components/domain/QuickTaskInput";
import { NotesList } from "@/components/inbox/NotesList";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskList } from "@/components/domain/TaskList";
import { DailyPlanForm } from "@/components/planning/DailyPlanForm";
import { TimeBlockForm } from "@/components/planning/TimeBlockForm";
import { WorkflowGuide } from "@/components/planning/WorkflowGuide";
import { listGoalsWithProgress, listParentCandidates } from "@/core/goals/queries";
import { getActiveHabits } from "@/core/habits/queries";
import { GoalProgressPanel } from "@/components/widgets/GoalProgressPanel";

const SCHEDULE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: APP_TIME_ZONE,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("today");
  return { title: t("title") };
}

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const params = await searchParams;
  const serverNow = new Date();
  const nowAt = serverNow.getTime();
  const today = todayBkk(serverNow);
  const scope: Scope = isScope(params.scope) ? params.scope : me.profile.default_scope;
  const [
    t,
    plan,
    dailyPlan,
    planningPreferences,
    timeBlocks,
    goalOptions,
    goals,
    habits,
    events,
    bills,
    notes,
  ] = await Promise.all([
    getTranslations(),
    getDayPlan(today),
    getDailyPlan(today),
    getPlanningPreferences(),
    getTimeBlocksForDate(today),
    listParentCandidates(),
    listGoalsWithProgress({ domainFilter: scope }),
    getActiveHabits(today),
    listCalendarEvents(today, today),
    listFinanceBills(today, today),
    listNotes(today),
  ]);
  const locale = (await getLocale()) as AppLocale;
  const scopedPlan = filterPlan(plan, scope);
  const scopedHabits = habits.filter((habit) => domainInScope(habit.domain as Domain, scope));
  const eligibleTopPriorityTaskIds = [
    ...new Set([...plan.overdue, ...plan.due].map((item) => item.task.id)),
  ];
  const openItems = orderTasksByPriority(
    [...scopedPlan.overdue, ...scopedPlan.due].map((item) => ({
      id: item.task.id,
      item,
      deadline: item.task.deadline,
      overdue: item.overdue,
      priority: item.task.priority,
      goalId: item.task.goal_id,
      projectId: item.task.project_id,
    })),
    today,
    dailyPlan?.top_priorities ?? [],
  ).map(({ item }) => item);
  const monthStart = startOfMonthISO(today);
  const monthGoals = goals.filter(
    (goal) => goal.period_type === "month" && goal.period_start === monthStart,
  );
  const mainGoal = monthGoals.find((goal) => goal.goal_kind === "metric") ?? monthGoals[0] ?? null;
  const waypoints = mainGoal ? goals.filter((goal) => goal.parent_id === mainGoal.id) : [];
  const financeGoals = goals.filter((goal) => goal.domain === "finance");
  const financeGoal =
    financeGoals.find((goal) => goal.period_type === "month" && goal.period_start === monthStart) ??
    financeGoals[0] ??
    null;
  const routineDone = scopedHabits.filter((habit) => habit.done).length;
  const dueBills = bills.filter((bill) => bill.status === "due");
  const showLifeContext = scope !== "work";
  const hasSuggestions =
    openItems.length === 0 ||
    goals.length === 0 ||
    (timeBlocks.length === 0 && events.length === 0) ||
    (showLifeContext && scopedHabits.length === 0) ||
    (showLifeContext && financeGoals.length === 0 && dueBills.length === 0);
  const availability = calculateDayAvailability({
    date: today,
    timezone: planningPreferences.timezone,
    workingWindows: planningPreferences.workingWindows,
    breakWindows: planningPreferences.breakWindows,
    events: events.map((event) => ({
      eventDate: event.event_date,
      allDay: event.all_day,
      startTime: event.start_time,
      endTime: event.end_time,
      blocksTime: event.blocks_time,
    })),
    timeBlocks: timeBlocks.map((block) => ({
      id: block.id,
      startAt: block.start_at,
      endAt: block.end_at,
      taskId: block.task_id,
    })),
    tasks: [...new Map(openItems.map((item) => [item.task.id, item.task])).values()].map(
      (task) => ({
        id: task.id,
        estimatedMinutes: task.estimated_minutes,
      }),
    ),
  });
  const availableMinutes = calculateEffectiveAvailableMinutes(
    dailyPlan?.available_minutes,
    availability.availableMinutes,
    availability.plannedBlockMinutes,
  );
  const capacity = calculateCapacity(
    availableMinutes,
    openItems.map((item) => item.task),
    { linkedTaskMinutes: availability.linkedTaskMinutes },
  );
  const capacityUsagePercent = Math.min(
    100,
    capacity.availableMinutes > 0
      ? (capacity.unscheduledTaskMinutes / capacity.availableMinutes) * 100
      : capacity.unscheduledTaskMinutes > 0
        ? 100
        : 0,
  );
  const hasCapacityInputs =
    capacity.estimatedTaskCount > 0 ||
    availability.busyMinutes > 0 ||
    availability.plannedBlockMinutes > 0;
  const greeting = me.profile.display_name?.trim()
    ? t("today.greeting", { name: me.profile.display_name.trim() })
    : t("today.greetingNoName");
  const timelineItems = [
    ...events.map((event) => {
      const time =
        event.all_day || !event.start_time
          ? t("today.allDay")
          : [event.start_time.slice(0, 5), event.end_time?.slice(0, 5)].filter(Boolean).join("–");
      return {
        id: "event:" + event.id,
        title: event.title,
        time,
        kind: "event" as const,
        sortMinutes: event.all_day || !event.start_time ? -1 : clockMinutes(event.start_time),
      };
    }),
    ...timeBlocks.map((block) => ({
      id: "block:" + block.id,
      title: block.title,
      time: formatTime(block.start_at, locale) + "–" + formatTime(block.end_at, locale),
      kind: "block" as const,
      sortMinutes: timestampClockMinutes(block.start_at),
    })),
  ].sort((left, right) => left.sortMinutes - right.sortMinutes);
  const showContextUtility = showLifeContext || hasSuggestions;

  return (
    <>
      <PageHeader
        eyebrow={greeting}
        title={t("today.title")}
        description={t("today.daySummary")}
        meta={formatDate(today, "longWeekday", locale)}
        actions={
          <span className="inline-flex h-7 items-center rounded-md border border-border bg-bg-surface px-2.5 text-caption font-medium text-text-secondary shadow-xs">
            {formatDate(today, "weekday", locale)}
          </span>
        }
      />

      <div className="mb-6 grid min-w-0 grid-cols-2 gap-3 min-[1151px]:grid-cols-4">
        <TodayMetric
          icon={ListTodo}
          value={`${scopedPlan.done.length}/${openItems.length + scopedPlan.done.length}`}
          label={t("widgets.todayTasks.title")}
        />
        <TodayMetric
          icon={Clock3}
          value={timelineItems.length > 0 ? String(timelineItems.length) : "—"}
          label={t("today.scheduleHeading")}
        />
        <TodayMetric
          icon={Target}
          value={mainGoal ? `${Math.round(mainGoal.progress.percent)}%` : "—"}
          label={t("widgets.goalProgress.title")}
        />
        <TodayMetric
          icon={Gauge}
          value={`${Math.max(0, capacity.remainingMinutes)} ${t("today.minutes")}`}
          label={t("today.capacityHeading")}
        />
      </div>

      <div className="grid min-w-0 items-start gap-4 min-[1151px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.7fr)]">
        <div className="today-column order-1 grid min-w-0 content-start gap-4 max-[1150px]:contents min-[1151px]:col-start-1">
          <section
            className="order-1 min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs min-[1151px]:order-none"
            aria-labelledby="today-plan-heading"
          >
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <ListTodo className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 id="today-plan-heading" className="text-h3 font-semibold text-text-primary">
                    {t("today.planHeading")}
                  </h2>
                  <p className="text-small text-text-secondary">{t("today.planDescription")}</p>
                </div>
              </div>
              <Link
                href="/inbox"
                className="inline-flex items-center gap-1 text-small font-medium text-brand-600 hover:underline"
              >
                <Inbox className="size-4" aria-hidden="true" />
                {t("today.openInbox")}
              </Link>
            </div>

            <TaskList
              items={openItems.concat(scopedPlan.done)}
              today={today}
              goalOptions={goalOptions}
              showGoal
              groupByStatus={false}
              variant="plain"
              emptyState={
                <div className="flex min-w-0 items-start gap-3 rounded-lg bg-brand-50 p-4">
                  <Target className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
                  <div className="min-w-0">
                    <h3 className="text-small font-semibold text-text-primary">
                      {t("today.emptyTitle")}
                    </h3>
                    <p className="mt-1 text-small break-words text-text-secondary">
                      {t("today.emptyDescription")}
                    </p>
                  </div>
                </div>
              }
            />
            <QuickTaskInput today={today} defaultDomain={scope === "life" ? null : "work"} />
          </section>
          {mainGoal ? (
            <section
              className="order-4 min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs min-[1151px]:order-none"
              aria-label={mainGoal.title}
            >
              <GoalProgressPanel
                goal={mainGoal}
                others={monthGoals.filter((goal) => goal.id !== mainGoal.id)}
                waypoints={waypoints}
                today={today}
                compact
              />
            </section>
          ) : null}
        </div>

        <div className="today-column order-2 grid min-w-0 content-start gap-4 max-[1150px]:contents min-[1151px]:col-start-2">
          <section
            className="order-2 min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs min-[1151px]:order-none"
            aria-labelledby="today-schedule-heading"
          >
            <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <Clock3 className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
                <div className="min-w-0">
                  <h2
                    id="today-schedule-heading"
                    className="text-h3 font-semibold text-text-primary"
                  >
                    {t("today.scheduleHeading")}
                  </h2>
                  <p className="text-small text-text-secondary">{t("today.scheduleDescription")}</p>
                </div>
              </div>
              <Link
                href="/calendar?view=day"
                className="text-small font-medium text-brand-600 hover:underline"
              >
                {t("today.openCalendar")}
              </Link>
            </div>
            {timelineItems.length > 0 ? (
              <div className="relative mb-4">
                <span
                  aria-hidden="true"
                  className="absolute top-3 bottom-3 left-[6rem] w-px bg-border"
                />
                <ul className="max-h-[36rem] space-y-0 overflow-y-auto overscroll-contain pr-1">
                  {timelineItems.map((item) => (
                    <li
                      key={item.id}
                      className="grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-3 py-3"
                    >
                      <span className="pt-0.5 text-right text-caption text-text-secondary">
                        {item.time}
                      </span>
                      <div className="relative min-w-0 py-0.5 pl-4">
                        <span
                          aria-hidden="true"
                          className="absolute top-1.5 left-[-0.3125rem] size-2.5 rounded-full border border-border bg-bg-surface"
                        />
                        <p className="text-small font-medium break-words text-text-primary">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-caption text-text-secondary">
                          {item.kind === "event" ? t("today.calendarEvent") : t("today.timeBlock")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mb-5 text-small text-text-secondary">{t("today.noTimeBlocks")}</p>
            )}
            <TimeBlockForm
              date={today}
              tasks={openItems}
              freeIntervals={availability.freeIntervals}
              suggestionNow={nowAt}
            />
          </section>
          <div className="order-3 grid min-w-0 content-start gap-4 min-[1151px]:order-none">
            {showLifeContext ? (
              <section
                className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
                aria-labelledby="today-routine-heading"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="size-5 text-brand-500" aria-hidden="true" />
                    <h2
                      id="today-routine-heading"
                      className="text-h3 font-semibold text-text-primary"
                    >
                      {t("today.routineHeading")}
                    </h2>
                  </div>
                  <Link
                    href="/life"
                    className="text-small font-medium text-brand-600 hover:underline"
                  >
                    {t("today.openRoutine")}
                  </Link>
                </div>
                {scopedHabits.length > 0 ? (
                  <>
                    <p className="mt-2 text-small text-text-secondary">
                      {t("today.routineProgress", {
                        done: routineDone,
                        total: scopedHabits.length,
                      })}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {scopedHabits.slice(0, 3).map((habit) => (
                        <li
                          key={habit.id}
                          className="flex min-w-0 items-start gap-2 text-small text-text-primary"
                        >
                          <CheckCircle2
                            className={`size-4 shrink-0 ${
                              habit.done ? "text-brand-600" : "text-text-muted"
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className={
                              habit.done
                                ? "min-w-0 break-words text-text-secondary line-through"
                                : "min-w-0 break-words"
                            }
                          >
                            {habit.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2 text-small text-text-secondary">{t("today.routineEmpty")}</p>
                )}
              </section>
            ) : null}

            <section
              className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
              aria-labelledby="today-capacity-heading"
            >
              <div className="mb-3 flex items-center gap-2">
                <Gauge className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
                <h2 id="today-capacity-heading" className="text-h3 font-semibold text-text-primary">
                  {t("today.capacityHeading")}
                </h2>
              </div>
              {hasCapacityInputs ? (
                <>
                  <p className="mt-1 text-small text-text-secondary">
                    {capacity.overCapacityMinutes > 0
                      ? t("today.overCapacity", { minutes: capacity.overCapacityMinutes })
                      : t("today.capacityRemaining", { minutes: capacity.remainingMinutes })}
                  </p>
                  <div
                    role="progressbar"
                    aria-label={t("today.capacityBar")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(capacityUsagePercent)}
                    className="mt-4 h-2 overflow-hidden rounded-full bg-brand-50"
                  >
                    <div
                      className={
                        capacity.overCapacityMinutes > 0
                          ? "h-full rounded-full bg-danger-500"
                          : "h-full rounded-full bg-brand-500"
                      }
                      style={{ width: capacityUsagePercent + "%" }}
                    />
                  </div>
                  <p className="mt-2 text-caption text-text-secondary">
                    {t("today.estimateHint", { count: capacity.estimatedTaskCount })}
                  </p>
                  <p className="mt-1 text-caption text-text-secondary">
                    {t("today.capacityBreakdown", {
                      busy: availability.busyMinutes,
                      blocks: availability.plannedBlockMinutes,
                    })}
                  </p>
                  <Link
                    href={"/rescue?date=" + today}
                    className="mt-3 inline-flex text-small font-medium text-brand-600 hover:underline"
                  >
                    {t("today.openRescue")}
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-small break-words text-text-secondary">
                  {t("today.capacityNeedsData")}
                </p>
              )}
            </section>
          </div>
        </div>

        <div className="today-column order-5 grid min-w-0 content-start gap-4 max-[1150px]:contents min-[1151px]:col-start-3">
          <div className="order-4 min-w-0 min-[1151px]:order-first">
            <WorkflowGuide
              roleCode={me.profile.role_code}
              horizon="day"
              selectedDate={today}
              primaryAction={{ kind: "today-priorities", href: "#today-plan-heading" }}
            />
          </div>
          <section
            className="order-5 min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs min-[1151px]:order-none"
            aria-labelledby="today-plan-settings-heading"
          >
            <div className="mb-3 flex items-start gap-2">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
              <div className="min-w-0">
                <h2
                  id="today-plan-settings-heading"
                  className="text-h3 font-semibold text-text-primary"
                >
                  {t("today.planSettings")}
                </h2>
                <p className="mt-0.5 text-caption text-text-secondary">
                  {t("today.planDescription")}
                </p>
              </div>
            </div>
            <DailyPlanForm
              planDate={today}
              initial={dailyPlan}
              eligibleTopPriorityTaskIds={eligibleTopPriorityTaskIds}
              defaultAvailableMinutes={defaultDailyPlanBudget(
                availability.availableMinutes,
                availability.plannedBlockMinutes,
              )}
              tasks={openItems.map((item) => ({
                id: item.task.id,
                title: item.task.title,
                estimatedMinutes: item.task.estimated_minutes,
                deadline: item.task.deadline,
                overdue: item.overdue,
                priority: item.task.priority,
                goalId: item.task.goal_id,
                projectId: item.task.project_id,
              }))}
            />
          </section>
          {showContextUtility ? (
            <div className="order-6 grid min-w-0 content-start gap-4 min-[1151px]:order-none">
              {showLifeContext ? (
                <section
                  className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
                  aria-labelledby="today-finance-heading"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <WalletCards className="size-5 text-brand-500" aria-hidden="true" />
                      <h2
                        id="today-finance-heading"
                        className="text-h3 font-semibold text-text-primary"
                      >
                        {t("today.financeHeading")}
                      </h2>
                    </div>
                    <Link
                      href="/finance"
                      className="text-small font-medium text-brand-600 hover:underline"
                    >
                      {t("today.openFinance")}
                    </Link>
                  </div>
                  {dueBills.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {dueBills.slice(0, 3).map((bill) => (
                        <li
                          key={bill.id}
                          className="flex items-start gap-2 rounded-lg bg-bg-subtle p-3"
                        >
                          <ReceiptText
                            className="mt-0.5 size-4 shrink-0 text-brand-600"
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-small font-medium break-words text-text-primary">
                              {bill.title}
                            </p>
                            <p className="text-caption text-text-secondary">
                              {bill.amount == null
                                ? t("today.billDue")
                                : t("today.billDueAmount", {
                                    amount: formatTHB(Number(bill.amount), locale),
                                  })}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {financeGoal ? (
                    <div
                      className={dueBills.length > 0 ? "mt-3 border-t border-border pt-3" : "mt-3"}
                    >
                      <p className="text-body font-medium text-text-primary">{financeGoal.title}</p>
                      <p className="mt-1 text-small text-text-secondary">
                        {t("today.financeGoalProgress", {
                          percent: Math.round(financeGoal.progress.percent),
                        })}
                      </p>
                    </div>
                  ) : dueBills.length === 0 ? (
                    <p className="mt-2 text-small text-text-secondary">{t("today.financeEmpty")}</p>
                  ) : null}
                </section>
              ) : null}

              {hasSuggestions ? (
                <section
                  className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
                  aria-labelledby="today-suggestions-heading"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-brand-500" aria-hidden="true" />
                    <h2
                      id="today-suggestions-heading"
                      className="text-h3 font-semibold text-text-primary"
                    >
                      {t("today.suggestionsHeading")}
                    </h2>
                  </div>
                  <p className="mt-1 text-small text-text-secondary">
                    {t("today.suggestionsDescription")}
                  </p>
                  <div className="mt-3 space-y-2">
                    {openItems.length === 0 ? (
                      <TodaySuggestion href="?new=task" label={t("today.suggestAddPriority")} />
                    ) : null}
                    {timeBlocks.length === 0 ? (
                      <TodaySuggestion
                        href="/calendar?view=day"
                        label={t("today.suggestPlanTime")}
                      />
                    ) : null}
                    {showLifeContext && scopedHabits.length === 0 ? (
                      <TodaySuggestion href="/life" label={t("today.suggestRoutine")} />
                    ) : null}
                    {showLifeContext && financeGoals.length === 0 ? (
                      <TodaySuggestion href="/finance" label={t("today.suggestFinance")} />
                    ) : null}
                    {goals.length === 0 ? (
                      <TodaySuggestion href="/goals?new=goal" label={t("today.startGoal")} />
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
          <section
            className="order-7 min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs min-[1151px]:order-none"
            aria-labelledby="today-notes-heading"
          >
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <NotebookPen className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
              <h2 id="today-notes-heading" className="text-h3 font-semibold text-text-primary">
                {t("inbox.notesTitle")}
              </h2>
              {notes.length > 0 ? (
                <span className="ml-auto rounded-full bg-brand-50 px-2 py-1 text-caption font-medium text-brand-700">
                  {t("inbox.notesCount", { count: notes.length })}
                </span>
              ) : null}
            </div>
            <NotesList notes={notes} date={today} />
          </section>
        </div>
      </div>
    </>
  );
}

function TodayMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <strong className="block text-xl font-semibold tracking-[-0.02em] break-words text-text-primary">
            {value}
          </strong>
          <span className="mt-0.5 block min-h-8 text-caption leading-4 break-words text-text-secondary">
            {label}
          </span>
        </div>
      </div>
    </section>
  );
}

function filterPlan(plan: DayPlan<TaskWithGoal>, scope: Scope): DayPlan<TaskWithGoal> {
  const filter = (items: DayTaskItem<TaskWithGoal>[]) =>
    items.filter((item) => domainInScope(item.task.domain, scope));
  return {
    date: plan.date,
    overdue: filter(plan.overdue),
    due: filter(plan.due),
    done: filter(plan.done),
  };
}

function TodaySuggestion({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-small font-medium text-brand-800 transition-colors hover:bg-brand-100"
    >
      <Sparkles className="size-4 shrink-0 text-brand-500" aria-hidden="true" />
      <span className="min-w-0 break-words">{label}</span>
    </Link>
  );
}

function formatTime(timestamp: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function clockMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function timestampClockMinutes(value: string) {
  const parts = SCHEDULE_TIME_FORMATTER.formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}
