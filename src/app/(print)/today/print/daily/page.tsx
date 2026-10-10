import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { listCalendarEvents } from "@/core/calendar-events/queries";
import { getDailyPlan, getDailyPriorityOrder, getTimeBlocksForDate } from "@/core/planning/queries";
import { getPrintTaskDateStatus } from "@/core/planning/print-task-date-status";
import {
  orderTasksByPriority,
  suggestTopPriorityTaskIds,
} from "@/core/planning/workflow-suggestions";
import { splitPrioritizedDayItems } from "@/core/planning/prioritized-day-items";
import { domainInScope, isScope, type Scope } from "@/core/profile/scope";
import { getMe } from "@/core/profile/queries";
import { ROUTES } from "@/core/profile/onboarding";
import { getDayPlan } from "@/core/tasks/queries";
import type { TaskWithGoal } from "@/core/tasks/schema";
import type { AppLocale } from "@/i18n/config";
import { isISODate, todayBkk, type ISODate } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { PrintPlannerButton } from "@/components/planning/PrintPlannerButton";
import styles from "@/components/planning/PrintPlanner.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plannerPrint");
  return { title: t("dailyTitle") };
}

export default async function DailyPrintPage({ searchParams }: PageProps<"/today/print/daily">) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);
  const params = await searchParams;
  const date: ISODate =
    typeof params.date === "string" && isISODate(params.date) ? params.date : todayBkk();
  const scope: Scope = isScope(params.scope) ? params.scope : me.profile.default_scope;
  const [messages, plan, dailyPlan, priorityOrder, timeBlocks, events, localeValue] =
    await Promise.all([
      getTranslations(),
      getDayPlan(date),
      getDailyPlan(date),
      getDailyPriorityOrder(date),
      getTimeBlocksForDate(date),
      listCalendarEvents(date, date),
      getLocale(),
    ]);
  const t = await getTranslations("plannerPrint");
  const locale = localeValue as AppLocale;
  const openTasks = [...plan.overdue, ...plan.due]
    .filter((item) => isTaskInScope(item.task, scope))
    .map((item) => ({
      id: item.task.id,
      item,
      deadline: item.task.deadline,
      overdue: item.overdue,
      priority: item.task.priority,
      goalId: item.task.goal_id,
      projectId: item.task.project_id,
    }));
  const savedPriorityIds =
    priorityOrder?.priority_task_ids ??
    (dailyPlan?.top_priorities.length ? dailyPlan.top_priorities : null);
  const priorityIsSaved = priorityOrder !== null || (dailyPlan?.top_priorities.length ?? 0) > 0;
  const priorityIds =
    savedPriorityIds ??
    suggestTopPriorityTaskIds(
      openTasks.map(({ item }) => ({
        id: item.task.id,
        deadline: item.task.deadline,
        overdue: item.overdue,
        priority: item.task.priority,
        goalId: item.task.goal_id,
        projectId: item.task.project_id,
      })),
      date,
    );
  const openItems = orderTasksByPriority(openTasks, date, priorityIds).map(({ item }) => item);
  const { prioritized: priorities, remaining: otherTasks } = splitPrioritizedDayItems(
    openItems,
    priorityIds,
  );
  const completed = plan.done.filter((item) => isTaskInScope(item.task, scope));
  const timeline = [
    ...events.map((event) => ({
      id: `event:${event.id}`,
      title: event.title,
      time:
        event.all_day || !event.start_time
          ? t("allDay")
          : [event.start_time.slice(0, 5), event.end_time?.slice(0, 5)].filter(Boolean).join("–"),
      type: t("calendarEvent"),
      sort: event.all_day || !event.start_time ? -1 : clockMinutes(event.start_time),
    })),
    ...timeBlocks.map((block) => ({
      id: `block:${block.id}`,
      title: block.title,
      time: `${formatTime(block.start_at, locale)}–${formatTime(block.end_at, locale)}`,
      type: t("timeBlock"),
      sort: clockMinutes(formatTime(block.start_at, "en")),
    })),
  ].sort((a, b) => a.sort - b.sort);
  const printHref = `/today?date=${date}&scope=${scope}`;

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLinks}>
          <Link className={styles.toolbarLink} href={printHref}>
            {t("backToPlan")}
          </Link>
        </div>
        <PrintPlannerButton />
      </div>
      <main className={styles.sheet}>
        <h1 className={styles.heading}>{t("dailyTitle")}</h1>
        <p className={styles.description}>{t("dailyDescription")}</p>
        <p className={styles.muted}>
          <strong>{t("dateLabel")}:</strong> {formatDate(date, "longWeekday", locale)}
        </p>
        {dailyPlan ? (
          <p className={styles.muted}>
            <strong>{messages("lifePlannerDaily.plannedBudget")}:</strong>{" "}
            {dailyPlan.available_minutes} {messages("today.minutes")}
          </p>
        ) : null}

        <section className={styles.day}>
          <h2 className={styles.sectionHeading}>{t("priorities")}</h2>
          <TaskRows
            items={priorities}
            displayDate={date}
            emptyText={t("noTasks")}
            formatMinutes={(minutes) => messages("planning.minutesShort", { minutes })}
            locale={locale}
            overdueLabel={t("overdue")}
            plannedDateLabel={messages("taskCards.plannedDate")}
          />
          {priorities.length > 0 && !priorityIsSaved ? (
            <p className={styles.muted}>{t("suggested")}</p>
          ) : null}

          {otherTasks.length > 0 ? (
            <>
              <h2 className={styles.sectionHeading}>{t("tasks")}</h2>
              <TaskRows
                items={otherTasks}
                displayDate={date}
                emptyText={t("noTasks")}
                formatMinutes={(minutes) => messages("planning.minutesShort", { minutes })}
                locale={locale}
                overdueLabel={t("overdue")}
                plannedDateLabel={messages("taskCards.plannedDate")}
              />
            </>
          ) : null}
          {completed.length > 0 ? (
            <>
              <h2 className={styles.sectionHeading}>{t("completed")}</h2>
              <TaskRows
                items={completed}
                displayDate={date}
                emptyText={t("noTasks")}
                formatMinutes={(minutes) => messages("planning.minutesShort", { minutes })}
                locale={locale}
                overdueLabel={t("overdue")}
                plannedDateLabel={messages("taskCards.plannedDate")}
                completed
              />
            </>
          ) : null}

          <h2 className={styles.sectionHeading}>{t("schedule")}</h2>
          {timeline.length > 0 ? (
            <ul className={styles.itemList}>
              {timeline.map((item) => (
                <li key={item.id} className={styles.item}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemMeta}>
                    {item.time} · {item.type}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>{t("noSchedule")}</p>
          )}
          {dailyPlan?.notes ? <p className={styles.note}>{dailyPlan.notes}</p> : null}
        </section>
      </main>
    </>
  );
}

function TaskRows({
  items,
  displayDate,
  emptyText,
  formatMinutes,
  completed = false,
  locale,
  overdueLabel,
  plannedDateLabel,
}: {
  items: { key: string; task: TaskWithGoal }[];
  displayDate: ISODate;
  emptyText: string;
  formatMinutes: (minutes: number) => string;
  completed?: boolean;
  locale: AppLocale;
  overdueLabel: string;
  plannedDateLabel: string;
}) {
  if (items.length === 0) return <p className={styles.muted}>{emptyText}</p>;
  return (
    <ul className={styles.itemList}>
      {items.map((item) => {
        const dateStatus = completed ? null : getPrintTaskDateStatus(item.task, displayDate);
        const metadata = [
          dateStatus?.kind === "overdue"
            ? overdueLabel
            : dateStatus?.kind === "planned"
              ? `${plannedDateLabel}: ${formatDate(dateStatus.date as ISODate, "medium", locale)}`
              : null,
          item.task.estimated_minutes != null ? formatMinutes(item.task.estimated_minutes) : null,
        ].filter(Boolean);

        return (
          <li key={item.key} className={styles.item}>
            <span className={styles.itemTitle}>
              {completed ? "✓ " : "□ "}
              {item.task.title}
            </span>
            {metadata.length > 0 ? (
              <span className={styles.itemMeta}>{metadata.join(" · ")}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function isTaskInScope(task: TaskWithGoal, scope: Scope) {
  return domainInScope(task.domain, scope);
}

function formatTime(timestamp: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function clockMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}
