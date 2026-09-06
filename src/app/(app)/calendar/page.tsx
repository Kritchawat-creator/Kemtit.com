import { CalendarDays, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { calendarRange, itemsByDay, monthGrid, parseCalendarView } from "@/core/domain/calendar";
import { listParentCandidates } from "@/core/goals/queries";
import { getDayPlan, getRangeTasks } from "@/core/tasks/queries";
import { eachDayISO, isISODate, todayBkk } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { CalendarMonth } from "@/components/domain/CalendarMonth";
import { CalendarRangeNav, CalendarViewNav } from "@/components/domain/CalendarNav";
import { CalendarWeek } from "@/components/domain/CalendarWeek";
import { EmptyState } from "@/components/domain/EmptyState";
import { TaskList } from "@/components/domain/TaskList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

/**
 * ปฏิทิน วัน/สัปดาห์/เดือน (Decision 3 + Claude Design 3m/4d)
 * มือถือ: segmented → ‹ ช่วง › → เนื้อหา · desktop: toolbar (segmented | ‹ ช่วง › วันนี้ เพิ่มงาน) → เดือน 8 คอลัมน์ + งานของวันที่เลือก 4 คอลัมน์
 */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const params = await searchParams;
  const view = parseCalendarView(params.view);
  const today = todayBkk();
  const date = typeof params.date === "string" && isISODate(params.date) ? params.date : today;
  const t = await getTranslations("calendar");

  const label =
    view === "day"
      ? formatThaiDate(date, "long")
      : view === "week"
        ? `${formatThaiDate(calendarRange("week", date).from, "short")} – ${formatThaiDate(calendarRange("week", date).to, "medium")}`
        : formatThaiDate(date, "monthYear");

  return (
    <>
      <PageHeader
        title={t("title")}
        meta={t("todayLabel", { date: formatThaiDate(today, "weekday") })}
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
            <Button className="bg-accent-500 shadow-fab hover:bg-accent-700" asChild>
              <Link href={`?view=${view}&date=${date}&new=task`} scroll={false}>
                <Plus aria-hidden="true" />
                {t("empty.cta")}
              </Link>
            </Button>
          </>
        }
      />
      <CalendarRangeNav
        view={view}
        date={date}
        today={today}
        label={label}
        className="mb-3 lg:hidden"
      />
      {view === "day" ? (
        <DayView date={date} today={today} />
      ) : (
        <RangeView view={view} date={date} today={today} />
      )}
    </>
  );
}

async function DayView({ date, today }: { date: string; today: string }) {
  const [t, plan, goalOptions] = await Promise.all([
    getTranslations("calendar"),
    getDayPlan(date),
    listParentCandidates(),
  ]);
  const items = [...plan.overdue, ...plan.due, ...plan.done];
  return (
    <div className="lg:max-w-3xl">
      <TaskList
        items={items}
        today={today}
        goalOptions={goalOptions}
        showGoal
        emptyState={
          <EmptyState
            icon={CalendarDays}
            title={
              date === today
                ? t("emptyDay.title")
                : t("emptyDay.titleOther", { date: formatThaiDate(date, "medium") })
            }
            description={t("emptyDay.description")}
            action={
              <Button asChild>
                <Link href={`?view=day&date=${date}&new=task`} scroll={false}>
                  {t("emptyDay.cta")}
                </Link>
              </Button>
            }
          />
        }
      />
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
  const [t, { tasks, completions }, plan, goalOptions] = await Promise.all([
    getTranslations("calendar"),
    getRangeTasks(from, to),
    getDayPlan(date),
    listParentCandidates(),
  ]);
  const byDay = itemsByDay(tasks, completions, from, to);
  const hasAny = Object.keys(byDay).length > 0;
  const dayItems = [...plan.overdue, ...plan.due, ...plan.done];
  const emptyDay = (
    <div className="rounded-xl bg-bg-surface px-5 py-5 text-center shadow-md lg:shadow-none">
      <p className="text-body text-text-secondary">
        {date === today
          ? t("emptyDay.title")
          : t("emptyDay.titleOther", { date: formatThaiDate(date, "medium") })}
      </p>
      <Button variant="outline" size="sm" className="mt-3" asChild>
        <Link href={`?view=${view}&date=${date}&new=task`} scroll={false}>
          {t("emptyDay.cta")}
        </Link>
      </Button>
    </div>
  );

  if (view === "week") {
    // มือถือ: แถบ 7 วัน + งานของวันที่เลือก (Claude Design 3m) — day plan ของวันที่เลือกวางไว้ใต้แถบ
    return (
      <div className="space-y-4">
        <CalendarWeek
          days={eachDayISO(from, to)}
          byDay={byDay}
          today={today}
          selected={date}
          dayPanel={
            <TaskList
              items={dayItems}
              today={today}
              goalOptions={goalOptions}
              groupByStatus={false}
              showGoal
              emptyState={emptyDay}
            />
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

  // เดือน: มือถือ grid อย่างเดียว (แตะวัน → มุมมองวัน) · desktop grid 8 คอลัมน์ + แผงงานของวันที่เลือก 4 คอลัมน์ (Claude Design 4d)
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="lg:col-span-8">
        <CalendarMonth
          date={date}
          weeks={monthGrid(date)}
          byDay={byDay}
          today={today}
          selected={date}
        />
        {!hasAny ? (
          <EmptyState
            icon={CalendarDays}
            title={t("empty.title")}
            description={t("empty.description")}
            className="mt-4 lg:hidden"
            action={
              <Button asChild>
                <Link href={`?view=month&date=${date}&new=task`} scroll={false}>
                  {t("empty.cta")}
                </Link>
              </Button>
            }
          />
        ) : null}
      </div>
      <aside
        aria-label={formatThaiDate(date, "weekday")}
        className="hidden rounded-xl bg-bg-surface p-6 shadow-md lg:col-span-4 lg:block"
      >
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-h2 text-brand-800">{formatThaiDate(date, "weekday")}</h2>
          <span className="text-small text-text-secondary">
            {t("tasksCount", { count: dayItems.length })}
          </span>
        </div>
        <TaskList
          items={dayItems}
          today={today}
          goalOptions={goalOptions}
          groupByStatus={false}
          showGoal
          variant="plain"
          emptyState={emptyDay}
        />
      </aside>
    </div>
  );
}
