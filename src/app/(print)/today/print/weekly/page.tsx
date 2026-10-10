import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { listCalendarEvents } from "@/core/calendar-events/queries";
import { domainInScope, isScope, type Scope } from "@/core/profile/scope";
import { getMe } from "@/core/profile/queries";
import { ROUTES } from "@/core/profile/onboarding";
import { getDailyPlan, getDailyPriorityOrder, getTimeBlocksForDate } from "@/core/planning/queries";
import { getPrintTaskDateStatus } from "@/core/planning/print-task-date-status";
import {
  orderTasksByPriority,
  suggestTopPriorityTaskIds,
} from "@/core/planning/workflow-suggestions";
import { splitPrioritizedDayItems } from "@/core/planning/prioritized-day-items";
import { getDayPlan } from "@/core/tasks/queries";
import type { TaskWithGoal } from "@/core/tasks/schema";
import type { AppLocale } from "@/i18n/config";
import {
  eachDayISO,
  endOfWeekISO,
  isISODate,
  startOfWeekISO,
  todayBkk,
  type ISODate,
} from "@/lib/date";
import { formatDate } from "@/lib/format";
import { PrintPlannerButton } from "@/components/planning/PrintPlannerButton";
import styles from "@/components/planning/PrintPlanner.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("plannerPrint");
  return { title: t("weeklyTitle") };
}

export default async function WeeklyPrintPage({ searchParams }: PageProps<"/today/print/weekly">) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);
  const params = await searchParams;
  const requestedDate: ISODate =
    typeof params.date === "string" && isISODate(params.date) ? params.date : todayBkk();
  const weekStart = startOfWeekISO(requestedDate);
  const weekEnd = endOfWeekISO(requestedDate);
  const days = eachDayISO(weekStart, weekEnd);
  const scope: Scope = isScope(params.scope) ? params.scope : me.profile.default_scope;
  const [messages, events, localeValue] = await Promise.all([
    getTranslations(),
    listCalendarEvents(weekStart, weekEnd),
    getLocale(),
  ]);
  const t = await getTranslations("plannerPrint");
  const locale = localeValue as AppLocale;
  const printDays = await Promise.all(
    days.map(async (date) => {
      const [plan, dailyPlan, priorityOrder, timeBlocks] = await Promise.all([
        getDayPlan(date),
        getDailyPlan(date),
        getDailyPriorityOrder(date),
        getTimeBlocksForDate(date),
      ]);
      const openTasks = [...plan.overdue, ...plan.due]
        .filter((item) => domainInScope(item.task.domain, scope))
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
      const separatedItems = splitPrioritizedDayItems(openItems, priorityIds);
      const completed = plan.done.filter((item) => domainInScope(item.task.domain, scope));
      const skipped = plan.skipped.filter((item) => domainInScope(item.task.domain, scope));
      const dayEvents = events.filter((event) => event.event_date === date);
      const schedule = [
        ...dayEvents.map((event) => {
          const startMinutes =
            event.all_day || !event.start_time ? -1 : clockMinutes(event.start_time);
          const endClockMinutes = event.end_time ? clockMinutes(event.end_time) : startMinutes;
          return {
            id: `event:${event.id}`,
            title: event.title,
            time:
              startMinutes < 0
                ? t("allDay")
                : [event.start_time?.slice(0, 5), event.end_time?.slice(0, 5)]
                    .filter(Boolean)
                    .join("–"),
            type: t("calendarEvent"),
            sort: startMinutes,
            endSort:
              startMinutes >= 0 && endClockMinutes <= startMinutes
                ? endClockMinutes + 24 * 60
                : endClockMinutes,
          };
        }),
        ...timeBlocks.map((block) => ({
          id: `block:${block.id}`,
          title: block.title,
          time: `${formatTime(block.start_at, locale)}–${formatTime(block.end_at, locale)}`,
          type: t("timeBlock"),
          sort: dateClockMinutes(block.start_at, date),
          endSort: dateClockMinutes(block.end_at, date),
        })),
      ].sort((left, right) => left.sort - right.sort);

      return {
        date,
        dailyPlan,
        priorityIsSaved,
        priorities: separatedItems.prioritized,
        tasks: separatedItems.remaining,
        completed,
        skipped,
        schedule,
      };
    }),
  );
  const backHref = `/today?date=${requestedDate}&scope=${scope}`;

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLinks}>
          <Link className={styles.toolbarLink} href={backHref}>
            {t("backToPlan")}
          </Link>
        </div>
        <PrintPlannerButton />
      </div>
      <main className={styles.sheet}>
        <h1 className={styles.heading}>{t("weeklyTitle")}</h1>
        <p className={styles.description}>{t("weeklyDescription")}</p>
        <p className={styles.muted}>
          {t("weekOf", { date: formatDate(weekStart, "long", locale) })}:{" "}
          {formatDate(weekStart, "short", locale)} – {formatDate(weekEnd, "short", locale)}
        </p>

        {printDays.map((day) => (
          <section className={styles.day} key={day.date}>
            <header className={styles.dayLead}>
              <h2 className={styles.dayHeading}>{formatDate(day.date, "longWeekday", locale)}</h2>
              {day.dailyPlan ? (
                <p className={styles.muted}>
                  <strong>{messages("lifePlannerDaily.plannedBudget")}:</strong>{" "}
                  {day.dailyPlan.available_minutes} {messages("today.minutes")}
                </p>
              ) : null}
            </header>

            <h3 className={styles.sectionHeading}>{t("priorities")}</h3>
            <TaskRows
              items={day.priorities}
              displayDate={day.date}
              emptyText={t("noTasks")}
              formatMinutes={(minutes) => messages("planning.minutesShort", { minutes })}
              locale={locale}
              overdueLabel={t("overdue")}
              plannedDateLabel={messages("taskCards.plannedDate")}
            />
            {day.priorities.length > 0 && !day.priorityIsSaved ? (
              <p className={styles.muted}>{t("suggested")}</p>
            ) : null}
            {day.tasks.length > 0 ? (
              <>
                <h3 className={styles.sectionHeading}>{t("tasks")}</h3>
                <TaskRows
                  items={day.tasks}
                  displayDate={day.date}
                  emptyText={t("noTasks")}
                  formatMinutes={(minutes) => messages("planning.minutesShort", { minutes })}
                  locale={locale}
                  overdueLabel={t("overdue")}
                  plannedDateLabel={messages("taskCards.plannedDate")}
                />
              </>
            ) : null}
            {day.completed.length > 0 ? (
              <>
                <h3 className={styles.sectionHeading}>{t("completed")}</h3>
                <TaskRows
                  items={day.completed}
                  displayDate={day.date}
                  emptyText={t("noTasks")}
                  formatMinutes={(minutes) => messages("planning.minutesShort", { minutes })}
                  locale={locale}
                  overdueLabel={t("overdue")}
                  plannedDateLabel={messages("taskCards.plannedDate")}
                  completed
                />
              </>
            ) : null}
            {day.skipped.length > 0 ? (
              <>
                <h3 className={styles.sectionHeading}>{t("skipped")}</h3>
                <TaskRows
                  items={day.skipped}
                  displayDate={day.date}
                  emptyText={t("noTasks")}
                  formatMinutes={(minutes) => messages("planning.minutesShort", { minutes })}
                  locale={locale}
                  overdueLabel={t("overdue")}
                  plannedDateLabel={messages("taskCards.plannedDate")}
                  skipped
                />
              </>
            ) : null}

            <h3 className={styles.sectionHeading}>{t("schedule")}</h3>
            {day.schedule.length > 0 ? (
              <ul className={styles.itemList}>
                {day.schedule.map((item) => (
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
            {day.dailyPlan?.notes ? <p className={styles.note}>{day.dailyPlan.notes}</p> : null}
          </section>
        ))}
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
  skipped = false,
  locale,
  overdueLabel,
  plannedDateLabel,
}: {
  items: { key: string; task: TaskWithGoal }[];
  displayDate: ISODate;
  emptyText: string;
  formatMinutes: (minutes: number) => string;
  completed?: boolean;
  skipped?: boolean;
  locale: AppLocale;
  overdueLabel: string;
  plannedDateLabel: string;
}) {
  if (items.length === 0) return <p className={styles.muted}>{emptyText}</p>;
  return (
    <ul className={styles.itemList}>
      {items.map((item) => {
        const dateStatus = completed || skipped ? null : getPrintTaskDateStatus(item.task, displayDate);
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
              {completed ? "✓ " : skipped ? "– " : "□ "}
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

function dateClockMinutes(value: string, date: ISODate) {
  const dateStart = Date.parse(`${date}T00:00:00+07:00`);
  return Math.floor((Date.parse(value) - dateStart) / 60_000);
}
