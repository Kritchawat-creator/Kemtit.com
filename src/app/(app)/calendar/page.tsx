import { CalendarClock, CalendarDays, NotebookPen, Plus, ReceiptText } from "@/components/icons/ui-icons";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";

import { calendarRange, itemsByDay, monthGrid, parseCalendarView } from "@/core/domain/calendar";
import { calendarContextByDay } from "@/core/domain/calendar-context";
import { listCalendarEvents } from "@/core/calendar-events/queries";
import { listFinanceBills } from "@/core/finance/queries";
import { listParentCandidates } from "@/core/goals/queries";
import { getMe } from "@/core/profile/queries";
import { domainInScope, isScope, type Scope } from "@/core/profile/scope";
import { ROUTES } from "@/core/profile/onboarding";
import { listNotes } from "@/core/notes/queries";
import { calculateDayAvailability } from "@/core/planning/availability";
import { getTimeBlocksForCalendarRange } from "@/core/planning/calendar-queries";
import { getPlanningPreferences, getTimeBlocksForDate } from "@/core/planning/queries";
import { getDayPlan, getRangeTasks } from "@/core/tasks/queries";
import { getTimelineBoardItems } from "@/core/tasks/timeline-queries";
import { APP_TIME_ZONE, type AppLocale } from "@/i18n/config";
import { addDaysISO, eachDayISO, isISODate, todayBkk, toBkkDate, type ISODate } from "@/lib/date";
import { formatDate, formatTHB } from "@/lib/format";
import { CalendarMonth } from "@/components/domain/CalendarMonth";
import { calendarHref, CalendarRangeNav, CalendarViewNav } from "@/components/domain/CalendarNav";
import { CalendarWeek } from "@/components/domain/CalendarWeek";
import { EmptyState } from "@/components/domain/EmptyState";
import { TaskList } from "@/components/domain/TaskList";
import { NotesList } from "@/components/inbox/NotesList";
import { PageHeader } from "@/components/layout/PageHeader";
import { TimeBlockActions } from "@/components/planning/TimeBlockActions";
import { Button } from "@/components/ui/button";
import {
  TimelineBoard,
  type TimelineBoardBlock,
  type TimelineBoardBusyItem,
  type TimelineBoardItem,
} from "@/components/calendar/TimelineBoard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

/** Day, week and month views share the existing date-selection and task routes. */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const params = await searchParams;
  const view = parseCalendarView(params.view);
  const today = todayBkk();
  const date = typeof params.date === "string" && isISODate(params.date) ? params.date : today;
  const [t, eventManagerT, locale, me] = await Promise.all([
    getTranslations("calendar"),
    getTranslations("calendarEvents"),
    getLocale(),
    getMe(),
  ]);
  if (!me) redirect(ROUTES.login);
  const scope: Scope = isScope(params.scope) ? params.scope : me.profile.default_scope;

  const label =
    view === "day"
      ? formatDate(date, "long", locale)
      : view === "week"
        ? `${formatDate(calendarRange("week", date).from, "short", locale)} – ${formatDate(calendarRange("week", date).to, "medium", locale)}`
        : formatDate(date, "monthYear", locale);

  return (
    <>
      <PageHeader
        title={t("title")}
        meta={t("todayLabel", { date: formatDate(today, "weekday", locale) })}
        toolbarStart={<CalendarViewNav view={view} date={date} scope={scope} />}
        toolbarEnd={
          <>
            <CalendarRangeNav
              view={view}
              date={date}
              scope={scope}
              today={today}
              label={label}
              layout="desktop"
            />
            <Button variant="outline" asChild>
              <Link href={`/calendar/events?date=${date}&scope=${scope}`} scroll={false}>
                {eventManagerT("title")}
              </Link>
            </Button>
            <Button asChild>
              <Link href={`${calendarHref(view, date, scope)}&new=task`} scroll={false}>
                <Plus aria-hidden="true" />
                {t("empty.cta")}
              </Link>
            </Button>
          </>
        }
      />
      {view === "day" ? (
        <DayView date={date} today={today} scope={scope} userId={me.userId} />
      ) : (
        <RangeView view={view} date={date} today={today} scope={scope} userId={me.userId} />
      )}
    </>
  );
}

async function DayView({ date, today, scope, userId }: { date: ISODate; today: ISODate; scope: Scope; userId: string }) {
  const [t, ta, plan, timeBlocks, goalOptions, events, bills, notes, planningPreferences] = await Promise.all([
    getTranslations("calendar"),
    getTranslations(),
    getDayPlan(date),
    getTimeBlocksForDate(date),
    listParentCandidates(),
    listCalendarEvents(date, date),
    listFinanceBills(date, date),
    listNotes(date),
    getPlanningPreferences(),
  ]);
  const openItems = [...plan.overdue, ...plan.due].filter((item) => domainInScope(item.task.domain, scope));
  const doneItems = plan.done.filter((item) => domainInScope(item.task.domain, scope));
  const skippedItems = plan.skipped.filter((item) => domainInScope(item.task.domain, scope));
  const timeline = await getTimelineBoardItems(openItems, scope, date);
  const timelineItems = timeline.items;
  const availability = calculateDayAvailability({
    date,
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
  const schedule = timelineBlocks(timeBlocks, timelineItems, t("busyTimeBlock"));
  const visibleTaskIds = new Set([
    ...timelineItems.map((item) => item.task.id),
    ...doneItems.map((item) => item.task.id),
    ...skippedItems.map((item) => item.task.id),
  ]);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2">
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-caption text-brand-800">
          <span className="font-semibold">{t("availabilityHeading")}</span>{" "}
          {t("availabilitySummary", {
            free: availability.availableMinutes,
            busy: availability.busyMinutes,
            blocks: availability.plannedBlockMinutes,
          })}
        </p>
        <CalendarContextItems events={events} bills={bills} />
      </section>
      <TimelineBoard
        userId={userId}
        date={date}
        items={timelineItems}
        groups={timeline.groups}
        hasMoreTasks={timeline.hasMoreTasks}
        blocks={schedule.blocks}
        busyItems={[...schedule.busyItems, ...busyCalendarEvents(events)]}
      />
      <section className="rounded-xl border border-border bg-bg-surface p-4 shadow-xs" aria-label={ta("today.scheduleHeading")}>
        <h2 className="mb-3 text-h2 text-text-primary">{ta("today.scheduleHeading")}</h2>
        {timeBlocks.length ? <CalendarRangeTimeBlocks timeBlocks={timeBlocks} visibleTaskIds={visibleTaskIds} busyLabel={t("busyTimeBlock")} /> : <p className="text-small text-text-secondary">{ta("today.noTimeBlocks")}</p>}
      </section>
      {doneItems.length || skippedItems.length ? (
        <TaskList items={[...doneItems, ...skippedItems]} today={today} goalOptions={goalOptions} showGoal variant="plain" />
      ) : null}
      <section className="rounded-xl border border-border bg-bg-surface p-4 shadow-xs" aria-label={ta("inbox.notesTitle")}>
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <NotebookPen className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
          <h2 className="text-h2 text-text-primary">{ta("inbox.notesTitle")}</h2>
          {notes.length > 0 ? (
            <span className="ml-auto rounded-full bg-brand-50 px-2 py-1 text-caption font-medium text-brand-700">
              {ta("inbox.notesCount", { count: notes.length })}
            </span>
          ) : null}
        </div>
        <NotesList notes={notes} date={date} />
      </section>
    </div>
  );
}

async function RangeView({
  view,
  date,
  today,
  scope,
  userId,
}: {
  view: "week" | "month";
  date: ISODate;
  today: ISODate;
  scope: Scope;
  userId: string;
}) {
  const { from, to } = calendarRange(view, date);
  const locale = (await getLocale()) as AppLocale;
  const [t, { tasks, completions, occurrences }, plan, goalOptions, events, bills, timeBlocks] =
    await Promise.all([
      getTranslations("calendar"),
      getRangeTasks(from, to),
      getDayPlan(date),
      listParentCandidates(),
      listCalendarEvents(from, to),
      listFinanceBills(from, to),
      getTimeBlocksForCalendarRange(from, to),
    ]);
  const scopedTaskIds = new Set(tasks.filter((task) => domainInScope(task.domain, scope)).map((task) => task.id));
  const scopedTasks = tasks.filter((task) => scopedTaskIds.has(task.id));
  const scopedCompletions = completions.filter((completion) => scopedTaskIds.has(completion.task_id));
  const scopedOccurrences = occurrences.filter((occurrence) => scopedTaskIds.has(occurrence.task_id));
  const byDay = itemsByDay(scopedTasks, scopedCompletions, from, to, scopedOccurrences);
  const contextByDay = calendarContextByDay(events, bills, timeBlocks);
  const hasAny = Object.keys(byDay).length > 0 || Object.keys(contextByDay).length > 0;
  const dayItems = [...plan.overdue, ...plan.due, ...plan.done, ...plan.skipped].filter((item) => domainInScope(item.task.domain, scope));
  const openDayItems = [...plan.overdue, ...plan.due].filter((item) => domainInScope(item.task.domain, scope));
  const doneDayItems = plan.done.filter((item) => domainInScope(item.task.domain, scope));
  const skippedDayItems = plan.skipped.filter((item) => domainInScope(item.task.domain, scope));
  const timeline = await getTimelineBoardItems(openDayItems, scope, date);
  const timelineItems = timeline.items;
  const dayEvents = events.filter((event) => event.event_date === date);
  const dayBills = bills.filter((bill) => bill.due_date === date);
  const dayTimeBlocks = timeBlocks.filter((block) => toBkkDate(block.start_at) === date);
  const schedule = timelineBlocks(dayTimeBlocks, timelineItems, t("busyTimeBlock"));
  const busyItems = [...schedule.busyItems, ...busyCalendarEvents(dayEvents)];
  const visibleTaskIds = new Set([
    ...timelineItems.map((item) => item.task.id),
    ...doneDayItems.map((item) => item.task.id),
    ...skippedDayItems.map((item) => item.task.id),
  ]);

  if (view === "week") {
    // มือถือ: แถบ 7 วัน + งานของวันที่เลือก (Claude Design 3m) — day plan ของวันที่เลือกวางไว้ใต้แถบ
    return (
      <div className="space-y-4">
        <CalendarWeek
          days={eachDayISO(from, to)}
          byDay={byDay}
          contextByDay={contextByDay}
          today={today}
          selected={date}
          scope={scope}
          dayPanel={
            <div key={date} className="space-y-3">
              <CalendarContextItems events={dayEvents} bills={dayBills} compact />
              <TimelineBoard date={date} userId={userId} items={timelineItems} groups={timeline.groups} hasMoreTasks={timeline.hasMoreTasks} blocks={schedule.blocks} busyItems={busyItems} />
              <CalendarRangeTimeBlocks timeBlocks={dayTimeBlocks} visibleTaskIds={visibleTaskIds} busyLabel={t("busyTimeBlock")} />
              {doneDayItems.length || skippedDayItems.length ? (
                <TaskList items={[...doneDayItems, ...skippedDayItems]} today={today} goalOptions={goalOptions} showGoal />
              ) : null}
            </div>
          }
        />
        {!hasAny ? (
          <EmptyState
            icon={CalendarDays}
            title={t("empty.title")}
            description={t("empty.description")}
            className="hidden md:flex"
            action={
              <Button asChild>
                <Link href={`${calendarHref("week", date, scope)}&new=task`} scroll={false}>
                  {t("empty.cta")}
                </Link>
              </Button>
            }
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="@container/calendar-month">
      <div className="grid min-w-0 items-start gap-4 @min-[69rem]/calendar-month:grid-cols-[20rem_minmax(0,1fr)]">
        <CalendarMonth
          date={date}
          weeks={monthGrid(date)}
          byDay={byDay}
          contextByDay={contextByDay}
          today={today}
          selected={date}
          scope={scope}
        />
        <aside
          aria-label={formatDate(date, "weekday", locale)}
          className="flex min-w-0 flex-col rounded-xl border border-border bg-bg-surface p-4 shadow-xs min-[761px]:p-6"
        >
          <div className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-h2 break-words text-text-primary">{formatDate(date, "weekday", locale)}</h2>
            <span className="text-small text-text-secondary">
              {t("tasksCount", { count: dayItems.length })}
            </span>
          </div>
          <div className="min-w-0 space-y-3">
            <CalendarContextItems events={dayEvents} bills={dayBills} compact />
            <TimelineBoard date={date} userId={userId} items={timelineItems} groups={timeline.groups} hasMoreTasks={timeline.hasMoreTasks} blocks={schedule.blocks} busyItems={busyItems} />
            <CalendarRangeTimeBlocks timeBlocks={dayTimeBlocks} visibleTaskIds={visibleTaskIds} busyLabel={t("busyTimeBlock")} />
            {doneDayItems.length || skippedDayItems.length ? (
              <TaskList items={[...doneDayItems, ...skippedDayItems]} today={today} goalOptions={goalOptions} showGoal variant="plain" />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

async function CalendarContextItems({
  events,
  bills,
  compact = false,
}: {
  events: Awaited<ReturnType<typeof listCalendarEvents>>;
  bills: Awaited<ReturnType<typeof listFinanceBills>>;
  compact?: boolean;
}) {
  if (events.length === 0 && bills.length === 0) return null;
  const t = await getTranslations("calendar");
  const locale = (await getLocale()) as AppLocale;

  return (
    <div className={compact ? "min-w-0 shrink-0 space-y-2" : "mt-4 min-w-0 space-y-2"}>
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-3 rounded-lg bg-brand-50 p-3">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium text-text-primary">{event.title}</p>
            <p className="text-caption text-text-secondary">
              {event.all_day || !event.start_time
                ? t("allDay")
                : `${event.start_time.slice(0, 5)}–${event.end_time?.slice(0, 5) ?? ""}`}
            </p>
          </div>
        </div>
      ))}
      {bills.map((bill) => (
        <div key={bill.id} className="flex items-start gap-3 rounded-lg bg-bg-subtle p-3">
          <ReceiptText className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium text-text-primary">{bill.title}</p>
            <p className="text-caption text-text-secondary">
              {bill.status === "paid"
                ? bill.amount == null
                  ? t("billPaid")
                  : t("billPaidAmount", { amount: formatTHB(Number(bill.amount), locale) })
                : bill.amount == null
                  ? t("billDue")
                  : t("billDueAmount", { amount: formatTHB(Number(bill.amount), locale) })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

async function CalendarRangeTimeBlocks({
  timeBlocks,
  visibleTaskIds,
  busyLabel,
}: {
  timeBlocks: Awaited<ReturnType<typeof getTimeBlocksForCalendarRange>>;
  visibleTaskIds: ReadonlySet<string>;
  busyLabel: string;
}) {
  if (timeBlocks.length === 0) return null;
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;

  return (
    <ol className="space-y-2">
      {timeBlocks.map((block) => (
        <li key={block.id} className="relative rounded-lg bg-brand-50 p-3">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 basis-40 text-small font-medium break-words text-text-primary">
              {block.task_id && !visibleTaskIds.has(block.task_id) ? busyLabel : block.title}
            </span>
            <span className="text-caption font-medium text-brand-800">
              {formatCalendarTime(block.start_at, locale)}–{formatCalendarTime(block.end_at, locale)}
            </span>
          </div>
          {!block.task_id || visibleTaskIds.has(block.task_id) ? (
            <TimeBlockActions
              id={block.id}
              title={block.title}
              start_at={block.start_at}
              end_at={block.end_at}
              version={block.version}
              status={block.status}
              is_locked={block.is_locked}
            />
          ) : null}
          <span className="sr-only">{t("today.timeBlock")}</span>
        </li>
      ))}
    </ol>
  );
}

function timelineBlocks(
  timeBlocks: Awaited<ReturnType<typeof getTimeBlocksForDate>>,
  items: TimelineBoardItem[],
  busyLabel: string,
): { blocks: TimelineBoardBlock[]; busyItems: TimelineBoardBusyItem[] } {
  const blocks: TimelineBoardBlock[] = [];
  const busyItems: TimelineBoardBusyItem[] = [];
  for (const block of timeBlocks) {
    const linkedItem = items.find(
      (item) => item.task.id === block.task_id && item.linkedBlocks.some((linked) => linked.id === block.id),
    );
    if (linkedItem) {
      blocks.push({
        id: block.id,
        title: block.title,
        startAt: block.start_at,
        endAt: block.end_at,
        version: block.version,
        isLocked: block.is_locked,
        taskId: block.task_id,
        occurrenceDate: linkedItem.occurrenceDate,
      });
    } else {
      busyItems.push({
        id: `time-block-${block.id}`,
        title: block.task_id ? busyLabel : block.title,
        startAt: block.start_at,
        endAt: block.end_at,
      });
    }
  }
  return { blocks, busyItems };
}

function busyCalendarEvents(
  events: Awaited<ReturnType<typeof listCalendarEvents>>,
): TimelineBoardBusyItem[] {
  return events.flatMap((event) => {
    if (!event.blocks_time) return [];
    if (event.all_day) {
      return [{
        id: event.id,
        title: event.title,
        startAt: fromZonedTime(`${event.event_date}T00:00:00`, APP_TIME_ZONE).toISOString(),
        endAt: fromZonedTime(`${addDaysISO(event.event_date, 1)}T00:00:00`, APP_TIME_ZONE).toISOString(),
      }];
    }
    if (!event.start_time || !event.end_time) return [];
    return [{
      id: event.id,
      title: event.title,
      startAt: fromZonedTime(`${event.event_date}T${event.start_time}`, APP_TIME_ZONE).toISOString(),
      endAt: fromZonedTime(`${event.event_date}T${event.end_time}`, APP_TIME_ZONE).toISOString(),
    }];
  });
}

function formatCalendarTime(timestamp: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}
