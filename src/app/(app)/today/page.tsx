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
} from "@/components/icons/ui-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { listCalendarEvents } from "@/core/calendar-events/queries";
import { listFinanceBills } from "@/core/finance/queries";
import { listNotes } from "@/core/notes/queries";
import { calculateDayAvailability } from "@/core/planning/availability";
import {
  defaultDailyPlanBudget,
  orderTasksByPriority,
  suggestTopPriorityTaskIds,
} from "@/core/planning/workflow-suggestions";
import {
  getDailyPlan,
  getDailyPriorityOrder,
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
import { isISODate, startOfMonthISO, todayBkk, type ISODate } from "@/lib/date";
import { formatDate, formatTHB } from "@/lib/format";
import { QuickTaskInput } from "@/components/domain/QuickTaskInput";
import { NotesList } from "@/components/inbox/NotesList";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskList } from "@/components/domain/TaskList";
import { DailyPlanForm } from "@/components/planning/DailyPlanForm";
import { DailyPriorityList } from "@/components/planning/DailyPriorityList";
import { TimeBlockForm } from "@/components/planning/TimeBlockForm";
import { WorkflowGuide } from "@/components/planning/WorkflowGuide";
import { TodayDateNavigation } from "@/components/planning/TodayDateNavigation";
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
  const now = new Date();
  const nowAt = now.getTime();
  const today = todayBkk(now);
  const selectedDate: ISODate =
    typeof params.date === "string" && isISODate(params.date) ? params.date : today;
  const scope: Scope = isScope(params.scope) ? params.scope : me.profile.default_scope;
  const [
    t,
    daily,
    plan,
    dailyPlan,
    priorityOrder,
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
    getTranslations("lifePlannerDaily"),
    getDayPlan(selectedDate),
    getDailyPlan(selectedDate),
    getDailyPriorityOrder(selectedDate),
    getPlanningPreferences(),
    getTimeBlocksForDate(selectedDate),
    listParentCandidates(),
    listGoalsWithProgress({ domainFilter: scope }),
    getActiveHabits(selectedDate),
    listCalendarEvents(selectedDate, selectedDate),
    listFinanceBills(selectedDate, selectedDate),
    listNotes(selectedDate),
  ]);
  const locale = (await getLocale()) as AppLocale;
  const scopedPlan = filterPlan(plan, scope);
  const scopedHabits = habits.filter((habit) => domainInScope(habit.domain as Domain, scope));
  const eligiblePriorityTaskIds = [
    ...new Set([...plan.overdue, ...plan.due].map((item) => item.task.id)),
  ];
  const savedPriorityTaskIds =
    priorityOrder?.priority_task_ids ??
    (dailyPlan?.top_priorities.length ? dailyPlan.top_priorities : null);
  const priorityIsSaved = priorityOrder !== null || (dailyPlan?.top_priorities.length ?? 0) > 0;
  const selectedPriorityTaskIds = (
    savedPriorityTaskIds ??
    suggestTopPriorityTaskIds(
      [...scopedPlan.overdue, ...scopedPlan.due].map((item) => ({
        id: item.task.id,
        deadline: item.task.deadline,
        overdue: item.overdue,
        priority: item.task.priority,
        goalId: item.task.goal_id,
        projectId: item.task.project_id,
      })),
      selectedDate,
    )
  ).filter((id) => eligiblePriorityTaskIds.includes(id));
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
    selectedDate,
    selectedPriorityTaskIds,
  ).map(({ item }) => item);
  const monthStart = startOfMonthISO(selectedDate);
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
  const availability = calculateDayAvailability({
    date: selectedDate,
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
      (task) => ({ id: task.id, estimatedMinutes: task.estimated_minutes }),
    ),
  });
  const timelineItems = [
    ...events.map((event) => {
      const startMinutes = event.all_day || !event.start_time ? -1 : clockMinutes(event.start_time);
      const endClockMinutes = event.end_time ? clockMinutes(event.end_time) : startMinutes;
      const endMinutes =
        startMinutes >= 0 && endClockMinutes <= startMinutes
          ? endClockMinutes + 24 * 60
          : endClockMinutes;
      return {
        id: `event:${event.id}`,
        title: event.title,
        time:
          startMinutes < 0
            ? t("today.allDay")
            : [event.start_time?.slice(0, 5), event.end_time?.slice(0, 5)]
                .filter(Boolean)
                .join("–"),
        kind: "event" as const,
        startMinutes,
        endMinutes,
      };
    }),
    ...timeBlocks.map((block) => ({
      id: `block:${block.id}`,
      title: block.title,
      time: `${formatTime(block.start_at, locale)}–${formatTime(block.end_at, locale)}`,
      kind: "block" as const,
      startMinutes: dateClockMinutes(block.start_at, selectedDate),
      endMinutes: dateClockMinutes(block.end_at, selectedDate),
    })),
  ].sort((left, right) => left.startMinutes - right.startMinutes);
  const selectedDateIsToday = selectedDate === today;
  const formattedSelectedDate = formatDate(selectedDate, "medium", locale);
  const planHeading = selectedDateIsToday
    ? t("today.planHeading")
    : daily("tasksForDay", { date: formattedSelectedDate });
  const scheduleHeading = selectedDateIsToday
    ? t("today.scheduleHeading")
    : daily("scheduleForDay", { date: formattedSelectedDate });
  const emptySelectedTitle = selectedDateIsToday
    ? t("today.emptyTitle")
    : daily("noTasksSelectedDay");
  const emptySelectedDescription = selectedDateIsToday ? t("today.emptyDescription") : "";
  const selectedDateStart = Date.parse(`${selectedDate}T00:00:00+07:00`);
  const nowTime = Math.floor((nowAt - selectedDateStart) / 60_000);
  const scheduledNow = selectedDateIsToday
    ? timelineItems.find(
        (item) =>
          item.startMinutes >= 0 && item.startMinutes <= nowTime && item.endMinutes > nowTime,
      )
    : undefined;
  const nextScheduled = selectedDateIsToday
    ? (scheduledNow ??
      timelineItems.find((item) => item.startMinutes >= 0 && item.startMinutes >= nowTime))
    : (timelineItems.find((item) => item.startMinutes >= 0) ?? timelineItems[0]);
  const currentMarkerIndex = selectedDateIsToday
    ? timelineItems.findIndex((item) => item.startMinutes >= 0 && item.endMinutes > nowTime)
    : -1;
  const allTasks = [...scopedPlan.overdue, ...scopedPlan.due, ...scopedPlan.done];
  const taskEmptyState =
    allTasks.length === 0
      ? emptyTaskState(t("today.noEligibleTasks"), "")
      : emptyTaskState(emptySelectedTitle, emptySelectedDescription);
  const hasCapacityInputs =
    openItems.some((item) => item.task.estimated_minutes != null) ||
    availability.busyMinutes > 0 ||
    availability.plannedBlockMinutes > 0;
  const greeting = selectedDateIsToday
    ? me.profile.display_name?.trim()
      ? t("today.greeting", { name: me.profile.display_name.trim() })
      : t("today.greetingNoName")
    : daily("selectedDay");

  return (
    <>
      <PageHeader
        eyebrow={greeting}
        title={selectedDateIsToday ? t("today.title") : daily("selectedDay")}
        description={daily("selectedDayDescription")}
        meta={formatDate(selectedDate, "longWeekday", locale)}
      />

      <TodayDateNavigation
        selectedDate={selectedDate}
        today={today}
        scope={scope}
        locale={locale}
      />

      <div className={`mb-4 grid min-w-0 grid-cols-2 gap-3 ${dailyPlan ? "lg:grid-cols-3" : ""}`}>
        <TodayMetric
          icon={ListTodo}
          value={`${scopedPlan.done.length}/${allTasks.length}`}
          label={daily("taskProgress", { done: scopedPlan.done.length, total: allTasks.length })}
        />
        <TodayMetric
          icon={Clock3}
          value={nextScheduled ? nextScheduled.time : "—"}
          label={nextScheduled ? `${daily("nextUp")}: ${nextScheduled.title}` : daily("noUpcoming")}
        />
        {dailyPlan ? (
          <TodayMetric
            icon={Gauge}
            value={`${dailyPlan.available_minutes} ${t("today.minutes")}`}
            label={daily("plannedBudget")}
            className="col-span-full lg:col-span-1"
          />
        ) : null}
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
        <section
          className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs sm:p-5"
          aria-labelledby="today-plan-heading"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <ListTodo className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="today-plan-heading" className="text-h3 font-semibold text-text-primary">
                  {planHeading}
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

          <DailyPriorityList
            key={`${me.userId}:${selectedDate}`}
            userId={me.userId}
            planDate={selectedDate}
            items={openItems}
            eligiblePriorityTaskIds={eligiblePriorityTaskIds}
            priorityTaskIds={selectedPriorityTaskIds}
            version={priorityOrder?.version ?? 0}
            priorityIsSaved={priorityIsSaved}
            goalOptions={goalOptions}
            emptyState={taskEmptyState}
          />

          <QuickTaskInput
            today={selectedDate}
            defaultDomain={scope === "life" ? null : "work"}
            placeholder={daily("quickTaskPlaceholder")}
          />
        </section>

        <section
          className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs sm:p-5"
          aria-labelledby="today-schedule-heading"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="today-schedule-heading" className="text-h3 font-semibold text-text-primary">
                  {scheduleHeading}
                </h2>
                <p className="text-small text-text-secondary">{t("today.scheduleDescription")}</p>
              </div>
            </div>
            <Link
              href={`/calendar?view=day&date=${selectedDate}`}
              className="text-small font-medium text-brand-600 hover:underline"
            >
              {t("today.openCalendar")}
            </Link>
          </div>

          {timelineItems.length > 0 ? (
            <ol className="relative space-y-0" aria-label={scheduleHeading}>
              {timelineItems.map((item, index) => (
                <li key={item.id}>
                  {selectedDateIsToday && currentMarkerIndex === index ? (
                    <CurrentTimeMarker
                      label={daily("nowAt", { time: SCHEDULE_TIME_FORMATTER.format(now) })}
                    />
                  ) : null}
                  <TimelineRow
                    item={item}
                    eventLabel={t("today.calendarEvent")}
                    blockLabel={t("today.timeBlock")}
                  />
                </li>
              ))}
              {selectedDateIsToday && currentMarkerIndex < 0 ? (
                <li>
                  <CurrentTimeMarker
                    label={daily("nowAt", { time: SCHEDULE_TIME_FORMATTER.format(now) })}
                  />
                </li>
              ) : null}
            </ol>
          ) : (
            <p className="mb-4 rounded-lg bg-bg-subtle px-3 py-4 text-small text-text-secondary">
              {selectedDateIsToday ? t("today.noTimeBlocks") : daily("noScheduleForDate")}
            </p>
          )}

          {scheduledNow ? (
            <p className="mt-3 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-small text-text-secondary">
              {daily("currentBlock", { title: scheduledNow.title })}
            </p>
          ) : null}
          <details className="mt-4 border-t border-border pt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-small font-semibold text-brand-700 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none">
              {daily("addTimeBlock")}
            </summary>
            <TimeBlockForm
              date={selectedDate}
              tasks={openItems}
              freeIntervals={availability.freeIntervals}
              suggestionNow={nowAt}
            />
          </details>
        </section>
      </div>

      <details className="mt-4 rounded-xl border border-border bg-bg-surface shadow-xs">
        <summary className="min-h-12 cursor-pointer px-4 py-3 text-small font-semibold text-brand-700 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none">
          {daily("moreDetails")}
        </summary>
        <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2">
          <section
            className="min-w-0 rounded-lg border border-border p-4"
            aria-labelledby="today-plan-settings-heading"
          >
            <div className="mb-3 flex items-start gap-2">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden="true" />
              <div>
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
              planDate={selectedDate}
              initial={dailyPlan}
              defaultAvailableMinutes={defaultDailyPlanBudget(
                availability.availableMinutes,
                availability.plannedBlockMinutes,
              )}
            />
          </section>

          {scopedPlan.done.length > 0 ? (
            <section
              className="min-w-0 rounded-lg border border-border p-4"
              aria-labelledby="today-completed-heading"
            >
              <h2
                id="today-completed-heading"
                className="mb-2 text-h3 font-semibold text-text-primary"
              >
                {t("plannerPrint.completed")}
              </h2>
              <TaskList
                items={scopedPlan.done}
                today={selectedDate}
                goalOptions={goalOptions}
                showGoal
                groupByStatus={false}
                variant="plain"
              />
            </section>
          ) : null}

          {scopedPlan.skipped.length > 0 ? (
            <section
              className="min-w-0 rounded-lg border border-border p-4"
              aria-labelledby="today-skipped-heading"
            >
              <h2
                id="today-skipped-heading"
                className="mb-2 text-h3 font-semibold text-text-primary"
              >
                {t("plannerPrint.skipped")}
              </h2>
              <TaskList
                items={scopedPlan.skipped}
                today={selectedDate}
                goalOptions={goalOptions}
                showGoal
                groupByStatus={false}
                variant="plain"
              />
            </section>
          ) : null}

          {showLifeContext ? (
            <section
              className="min-w-0 rounded-lg border border-border p-4"
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
                    {t("today.routineProgress", { done: routineDone, total: scopedHabits.length })}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {scopedHabits.slice(0, 3).map((habit) => (
                      <li
                        key={habit.id}
                        className="flex min-w-0 items-start gap-2 text-small text-text-primary"
                      >
                        <CheckCircle2
                          className={`size-4 shrink-0 ${habit.done ? "text-brand-600" : "text-text-muted"}`}
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

          {mainGoal ? (
            <section
              className="min-w-0 rounded-lg border border-border p-4"
              aria-label={mainGoal.title}
            >
              <GoalProgressPanel
                goal={mainGoal}
                others={monthGoals.filter((goal) => goal.id !== mainGoal.id)}
                waypoints={waypoints}
                today={selectedDate}
                compact
              />
            </section>
          ) : null}

          <section
            className="min-w-0 rounded-lg border border-border p-4"
            aria-labelledby="today-capacity-heading"
          >
            <div className="mb-2 flex items-center gap-2">
              <Gauge className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
              <h2 id="today-capacity-heading" className="text-h3 font-semibold text-text-primary">
                {t("today.capacityHeading")}
              </h2>
            </div>
            {hasCapacityInputs ? (
              <>
                <p className="text-small text-text-secondary">{daily("freeWindowNote")}</p>
                {dailyPlan ? (
                  <p className="mt-2 text-small text-text-secondary">
                    {daily("plannedBudget")}: {dailyPlan.available_minutes} {t("today.minutes")}
                  </p>
                ) : null}
                <p className="mt-1 text-caption text-text-secondary">
                  {t("today.capacityBreakdown", {
                    busy: availability.busyMinutes,
                    blocks: availability.plannedBlockMinutes,
                  })}
                </p>
                <Link
                  href={`/rescue?date=${selectedDate}`}
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

          {showLifeContext ? (
            <section
              className="min-w-0 rounded-lg border border-border p-4"
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
                <div className={dueBills.length > 0 ? "mt-3 border-t border-border pt-3" : "mt-3"}>
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

          <section
            className="min-w-0 rounded-lg border border-border p-4"
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
            <NotesList notes={notes} date={selectedDate} />
          </section>

          <section className="min-w-0 rounded-lg border border-border p-4">
            <WorkflowGuide
              roleCode={me.profile.role_code}
              horizon="day"
              selectedDate={selectedDate}
              primaryAction={{ kind: "today-priorities", href: "#today-plan-heading" }}
            />
          </section>
        </div>
      </details>
    </>
  );
}

function TodayMetric({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-border bg-bg-surface px-3 py-3 shadow-xs sm:p-4 ${className ?? ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <strong className="block text-lg font-semibold tracking-[-0.02em] break-words text-text-primary sm:text-xl">
            {value}
          </strong>
          <span className="mt-0.5 block text-caption leading-4 break-words text-text-secondary">
            {label}
          </span>
        </div>
      </div>
    </section>
  );
}

function TimelineRow({
  item,
  eventLabel,
  blockLabel,
}: {
  item: { id: string; title: string; time: string; kind: "event" | "block" };
  eventLabel: string;
  blockLabel: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-border/70 py-3 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)]">
      <span className="pt-0.5 text-right text-caption text-text-secondary">{item.time}</span>
      <div className="relative min-w-0 border-l border-border pl-4">
        <span
          aria-hidden="true"
          className="absolute top-1 left-[-0.3125rem] size-2.5 rounded-full border border-border bg-bg-surface"
        />
        <p className="text-small font-medium break-words text-text-primary">{item.title}</p>
        <p className="mt-0.5 text-caption text-text-secondary">
          {item.kind === "event" ? eventLabel : blockLabel}
        </p>
      </div>
    </div>
  );
}

function CurrentTimeMarker({ label }: { label: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3 py-1 text-caption font-semibold text-brand-700 sm:grid-cols-[5rem_minmax(0,1fr)]">
      <span aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-2 border-l-2 border-brand-600 pl-3">
        <span className="size-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
        <span className="break-words">{label}</span>
      </div>
    </div>
  );
}

function emptyTaskState(title: string, description: string) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg bg-brand-50 p-4">
      <Target className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
      <div className="min-w-0">
        <h3 className="text-small font-semibold text-text-primary">{title}</h3>
        {description ? (
          <p className="mt-1 text-small break-words text-text-secondary">{description}</p>
        ) : null}
      </div>
    </div>
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
    skipped: filter(plan.skipped),
  };
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

function dateClockMinutes(value: string, date: ISODate) {
  const dateStart = Date.parse(`${date}T00:00:00+07:00`);
  return Math.floor((Date.parse(value) - dateStart) / 60_000);
}
