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

/** ปฏิทิน วัน/สัปดาห์/เดือน (Decision 3) — มุมมองวันใช้ TaskList เดียวกับแดชบอร์ด */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const params = await searchParams;
  const view = parseCalendarView(params.view);
  const today = todayBkk();
  const date = typeof params.date === "string" && isISODate(params.date) ? params.date : today;
  const t = await getTranslations("calendar");

  const description =
    view === "day"
      ? formatThaiDate(date, "long")
      : view === "week"
        ? `${formatThaiDate(calendarRange("week", date).from, "short")} – ${formatThaiDate(calendarRange("week", date).to, "medium")}`
        : formatThaiDate(date, "monthYear");

  return (
    <>
      <PageHeader title={t("title")} description={description} />
      <div className="mb-4">
        <CalendarNav view={view} date={date} today={today} />
      </div>
      {view === "day" ? <DayView date={date} today={today} /> : <RangeView view={view} date={date} today={today} />}
    </>
  );
}

async function DayView({ date, today }: { date: string; today: string }) {
  const [t, plan, goalOptions] = await Promise.all([getTranslations("calendar"), getDayPlan(date), listParentCandidates()]);
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
          title={t("emptyDay.title")}
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

async function RangeView({ view, date, today }: { view: "week" | "month"; date: string; today: string }) {
  const { from, to } = calendarRange(view, date);
  const [t, { tasks, completions }] = await Promise.all([getTranslations("calendar"), getRangeTasks(from, to)]);
  const byDay = itemsByDay(tasks, completions, from, to);
  const hasAny = Object.keys(byDay).length > 0;

  return (
    <div className="space-y-4">
      {view === "week" ? (
        <CalendarWeek days={eachDayISO(from, to)} byDay={byDay} today={today} />
      ) : (
        <CalendarMonth date={date} weeks={monthGrid(date)} byDay={byDay} today={today} />
      )}
      {!hasAny ? (
        <EmptyState
          icon={CalendarDays}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild>
              <Link href={`?view=${view}&date=${date}&new=task&date=${today}`} scroll={false}>
                {t("empty.cta")}
              </Link>
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
