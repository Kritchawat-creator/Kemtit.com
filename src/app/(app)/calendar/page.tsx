import { CalendarClock, CalendarDays, NotebookPen, Plus, ReceiptText } from "@/components/icons/ui-icons";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { calendarRange, itemsByDay, monthGrid, parseCalendarView } from "@/core/domain/calendar";
import { calendarContextByDay } from "@/core/domain/calendar-context";
import { listCalendarEvents } from "@/core/calendar-events/queries";
import { listFinanceBills } from "@/core/finance/queries";
import { listParentCandidates } from "@/core/goals/queries";
import { listNotes } from "@/core/notes/queries";
import { calculateDayAvailability } from "@/core/planning/availability";
import { getTimeBlocksForCalendarRange } from "@/core/planning/calendar-queries";
import { getPlanningPreferences, getTimeBlocksForDate } from "@/core/planning/queries";
import { getDayPlan, getRangeTasks } from "@/core/tasks/queries";
import { APP_TIME_ZONE, type AppLocale } from "@/i18n/config";
import { eachDayISO, isISODate, todayBkk, toBkkDate, type ISODate } from "@/lib/date";
import { formatDate, formatTHB } from "@/lib/format";
import { CalendarMonth } from "@/components/domain/CalendarMonth";
import { CalendarRangeNav, CalendarViewNav } from "@/components/domain/CalendarNav";
import { CalendarWeek } from "@/components/domain/CalendarWeek";
import { EmptyState } from "@/components/domain/EmptyState";
import { TaskList } from "@/components/domain/TaskList";
import { NotesList } from "@/components/inbox/NotesList";
import { PageHeader } from "@/components/layout/PageHeader";
import { TimeBlockForm } from "@/components/planning/TimeBlockForm";
import { TimeBlockActions } from "@/components/planning/TimeBlockActions";
import { Button } from "@/components/ui/button";

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
  const t = await getTranslations("calendar");
  const eventManagerT = await getTranslations("calendarEvents");
  const locale = (await getLocale()) as AppLocale;

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
        toolbarStart={<CalendarViewNav view={view} date={date} />}
        toolbarEnd={
          <>
            <CalendarRangeNav
              view={view}
              date={date}
              today={today}
              label={label}
              layout="desktop"
            />
            <Button variant="outline" asChild>
              <Link href={`/calendar/events?date=${date}`} scroll={false}>
                {eventManagerT("title")}
              </Link>
            </Button>
            <Button asChild>
              <Link href={`?view=${view}&date=${date}&new=task`} scroll={false}>
                <Plus aria-hidden="true" />
                {t("empty.cta")}
              </Link>
            </Button>
          </>
        }
      />
      {view === "day" ? (
        <DayView date={date} today={today} />
      ) : (
        <RangeView view={view} date={date} today={today} />
      )}
    </>
  );
}

async function DayView({ date, today }: { date: ISODate; today: ISODate }) {
  const locale = (await getLocale()) as AppLocale;
  const renderedAt = new Date();
  const suggestionNow = renderedAt.getTime();
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
  const openItems = [...plan.overdue, ...plan.due];
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
      (task) => ({
        id: task.id,
        estimatedMinutes: task.estimated_minutes,
      }),
    ),
  });
  const scheduledOccurrenceIds = new Set(
    timeBlocks.flatMap((block) => (block.task_occurrence_id ? [block.task_occurrence_id] : [])),
  );
  const scheduledTaskIds = new Set(
    timeBlocks.flatMap((block) =>
      !block.task_occurrence_id && block.task_id ? [block.task_id] : [],
    ),
  );
  const unscheduledItems = openItems.filter((item) =>
    item.recurring
      ? !(
          (item.occurrenceId && scheduledOccurrenceIds.has(item.occurrenceId)) ||
          scheduledTaskIds.has(item.task.id)
        )
      : !scheduledTaskIds.has(item.task.id),
  );

  return (
    <div className="grid gap-4 md:grid-cols-12 md:items-start md:gap-6">
      <section
        className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs md:col-span-8"
        aria-labelledby="calendar-time-blocks-heading"
      >
        <h2 id="calendar-time-blocks-heading" className="text-h2 text-text-primary">
          {ta("today.scheduleHeading")}
        </h2>
        <p className="mt-1 text-small text-text-secondary">{t("timelineHint")}</p>
        <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-caption text-brand-800">
          <span className="font-semibold">{t("availabilityHeading")}</span>{" "}
          {t("availabilitySummary", {
            free: availability.availableMinutes,
            busy: availability.busyMinutes,
            blocks: availability.plannedBlockMinutes,
          })}
        </p>
        <CalendarContextItems events={events} bills={bills} />
        {timeBlocks.length > 0 ? (
          <ol className="mt-4 max-h-[40rem] min-w-0 overflow-y-auto overscroll-contain pr-1">
            {timeBlocks.map((block) => (
              <li key={block.id} className="relative min-w-0 pb-1 pl-6 last:pb-0">
                <span aria-hidden="true" className="absolute inset-y-0 left-[5px] w-0.5 bg-brand-100" />
                <span aria-hidden="true" className="absolute top-4 left-0 size-3 rounded-full border-2 border-bg-surface bg-brand-500" />
                <div className="min-w-0 rounded-lg bg-bg-subtle p-3">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0 flex-1 basis-40 text-body break-words text-text-primary">{block.title}</span>
                    <span className="text-small font-medium text-brand-800">
                      {formatCalendarTime(block.start_at, locale)}–{formatCalendarTime(block.end_at, locale)}
                    </span>
                  </div>
                  <TimeBlockActions
                    id={block.id}
                    title={block.title}
                    start_at={block.start_at}
                    end_at={block.end_at}
                    version={block.version}
                    status={block.status}
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 rounded-lg bg-bg-subtle p-4 text-small text-text-secondary">
            {ta("today.noTimeBlocks")}
          </p>
        )}

        <section
          className="mt-4 min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
          aria-labelledby="calendar-add-block-heading"
        >
          <h2 id="calendar-add-block-heading" className="text-h2 text-text-primary">
            {ta("today.scheduleHeading")}
          </h2>
          <div className="mt-4">
            <TimeBlockForm
              date={date}
              tasks={unscheduledItems}
              freeIntervals={availability.freeIntervals}
              suggestionNow={suggestionNow}
            />
          </div>
        </section>

        {plan.done.length > 0 ? (
          <div className="mt-5 border-t border-border pt-4">
            <TaskList
              items={plan.done}
              today={today}
              goalOptions={goalOptions}
              groupByStatus={false}
              showGoal
              variant="plain"
            />
          </div>
        ) : null}
      </section>

      <aside className="space-y-4 md:col-span-4" aria-label={t("unscheduled")}>
        <section
          className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
          aria-labelledby="calendar-unscheduled-heading"
        >
          <h2 id="calendar-unscheduled-heading" className="text-h2 text-text-primary">
            {t("unscheduled")}
          </h2>
          <div className="mt-3">
            {unscheduledItems.length > 0 ? (
              <TaskList
                items={unscheduledItems}
                today={today}
                goalOptions={goalOptions}
                groupByStatus={false}
                showGoal
                variant="plain"
              />
            ) : (
              <p className="text-small text-text-secondary">{t("noUnscheduled")}</p>
            )}
          </div>
        </section>

        <section
          className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
          aria-labelledby="calendar-notes-heading"
        >
          <div className="mb-3 flex min-w-0 items-center gap-2">
            <NotebookPen className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
            <h2 id="calendar-notes-heading" className="text-h2 text-text-primary">
              {ta("inbox.notesTitle")}
            </h2>
            {notes.length > 0 ? (
              <span className="ml-auto rounded-full bg-brand-50 px-2 py-1 text-caption font-medium text-brand-700">
                {ta("inbox.notesCount", { count: notes.length })}
              </span>
            ) : null}
          </div>
          <NotesList notes={notes} date={date} />
        </section>

      </aside>
    </div>
  );
}

async function RangeView({
  view,
  date,
  today,
}: {
  view: "week" | "month";
  date: string;
  today: string;
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
  const byDay = itemsByDay(tasks, completions, from, to, occurrences);
  const contextByDay = calendarContextByDay(events, bills, timeBlocks);
  const hasAny = Object.keys(byDay).length > 0 || Object.keys(contextByDay).length > 0;
  const dayItems = [...plan.overdue, ...plan.due, ...plan.done];
  const dayEvents = events.filter((event) => event.event_date === date);
  const dayBills = bills.filter((bill) => bill.due_date === date);
  const dayTimeBlocks = timeBlocks.filter((block) => toBkkDate(block.start_at) === date);
  const emptyDay = (
    <EmptyState
      variant={view === "month" ? "inline" : "standalone"}
      className={view === "month" ? "flex-1" : undefined}
      title={date === today
        ? t("emptyDay.title")
        : t("emptyDay.titleOther", { date: formatDate(date, "medium", locale) })}
      action={
        <Button variant="outline" size="sm" className="min-h-11" asChild>
          <Link href={`?view=${view}&date=${date}&new=task`} scroll={false}>
            {t("emptyDay.cta")}
          </Link>
        </Button>
      }
    />
  );

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
          dayPanel={
            <div key={date} className="space-y-3">
              <CalendarContextItems events={dayEvents} bills={dayBills} compact />
              <CalendarRangeTimeBlocks timeBlocks={dayTimeBlocks} />
              <TaskList
                items={dayItems}
                today={today}
                goalOptions={goalOptions}
                groupByStatus={false}
                showGoal
                emptyState={emptyDay}
              />
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
                <Link href={`?view=week&date=${date}&new=task`} scroll={false}>
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
    <div className="grid min-w-0 items-start gap-4 min-[761px]:grid-cols-2">
      <CalendarMonth
        date={date}
        weeks={monthGrid(date)}
        byDay={byDay}
        contextByDay={contextByDay}
        today={today}
        selected={date}
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
        <div className="flex max-h-[40rem] min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
          <CalendarContextItems events={dayEvents} bills={dayBills} compact />
          <CalendarRangeTimeBlocks timeBlocks={dayTimeBlocks} />
          <TaskList
            items={dayItems}
            today={today}
            goalOptions={goalOptions}
            groupByStatus={false}
            showGoal
            variant="plain"
            emptyState={emptyDay}
          />
        </div>
      </aside>
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
    <div className={compact ? "max-h-[28rem] space-y-2 overflow-y-auto overscroll-contain pr-1" : "mt-4 max-h-[28rem] space-y-2 overflow-y-auto overscroll-contain pr-1"}>
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
}: {
  timeBlocks: Awaited<ReturnType<typeof getTimeBlocksForCalendarRange>>;
}) {
  if (timeBlocks.length === 0) return null;
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;

  return (
    <ol className="space-y-2">
      {timeBlocks.map((block) => (
        <li key={block.id} className="rounded-lg bg-brand-50 p-3">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 flex-1 basis-40 text-small font-medium break-words text-text-primary">
              {block.title}
            </span>
            <span className="text-caption font-medium text-brand-800">
              {formatCalendarTime(block.start_at, locale)}–{formatCalendarTime(block.end_at, locale)}
            </span>
          </div>
          <TimeBlockActions
            id={block.id}
            title={block.title}
            start_at={block.start_at}
            end_at={block.end_at}
            version={block.version}
            status={block.status}
          />
          <span className="sr-only">{t("today.timeBlock")}</span>
        </li>
      ))}
    </ol>
  );
}

function formatCalendarTime(timestamp: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}
