import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { calendarRange, itemsByDay, monthGrid, parseCalendarView } from "@/core/domain/calendar";
import { listParentCandidates } from "@/core/goals/queries";
import { getDayPlan, getRangeTasks } from "@/core/tasks/queries";
import { eachDayISO, isISODate, todayBkk } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { CalendarMonth } from "@/components/domain/CalendarMonth";
import { CalendarNav } from "@/components/domain/CalendarNav";
import { CalendarWeek } from "@/components/domain/CalendarWeek";
import { EmptyState } from "@/components/domain/EmptyState";
import { TaskList } from "@/components/domain/TaskList";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

/** ปฏิทิน วัน/สัปดาห์/เดือน (Decision 3 + Claude Design 3m) — มุมมองวัน/วันที่เลือกในสัปดาห์ใช้ TaskList เดียวกับแดชบอร์ด */
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
      <PageHeader title={t("title")} />
      <div className="mb-3">
        <CalendarNav view={view} date={date} today={today} label={label} />
      </div>
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
  const [t, { tasks, completions }] = await Promise.all([
    getTranslations("calendar"),
    getRangeTasks(from, to),
  ]);
  const byDay = itemsByDay(tasks, completions, from, to);
  const hasAny = Object.keys(byDay).length > 0;

  if (view === "week") {
    // มือถือ: แถบ 7 วัน + งานของวันที่เลือก (Claude Design 3m) — โหลด day plan ของวันที่เลือกให้ CalendarWeek วางไว้ใต้แถบ
    const [plan, goalOptions] = await Promise.all([getDayPlan(date), listParentCandidates()]);
    const dayItems = [...plan.overdue, ...plan.due, ...plan.done];
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
              emptyState={
                <div className="rounded-xl bg-bg-surface px-5 py-5 text-center shadow-md">
                  <p className="text-body text-text-secondary">
                    {date === today
                      ? t("emptyDay.title")
                      : t("emptyDay.titleOther", { date: formatThaiDate(date, "medium") })}
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href={`?view=week&date=${date}&new=task`} scroll={false}>
                      {t("emptyDay.cta")}
                    </Link>
                  </Button>
                </div>
              }
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

  return (
    <div className="space-y-4">
      <CalendarMonth date={date} weeks={monthGrid(date)} byDay={byDay} today={today} />
      {!hasAny ? (
        <EmptyState
          icon={CalendarDays}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild>
              <Link href={`?view=month&date=${date}&new=task&date=${today}`} scroll={false}>
                {t("empty.cta")}
              </Link>
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
