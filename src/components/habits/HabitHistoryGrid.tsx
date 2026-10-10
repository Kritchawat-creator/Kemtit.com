"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import type { AppLocale } from "@/i18n/config";
import type { ISODate } from "@/lib/date";
import { formatDate } from "@/lib/format";
import type { HabitHistoryRow, HabitHistoryState } from "@/core/habits/history";

const STATE_CLASS: Record<HabitHistoryState, string> = {
  done: "bg-brand-600 text-white",
  noRecord: "bg-bg-subtle text-text-muted",
  notStarted: "bg-bg-surface text-text-muted ring-1 ring-inset ring-border",
  future: "bg-bg-surface text-text-muted ring-1 ring-inset ring-border",
};

const STATE_MARK: Record<HabitHistoryState, string> = {
  done: "✓",
  noRecord: "·",
  notStarted: "—",
  future: "—",
};

export function HabitHistoryGrid({
  habits,
  days,
  today,
  locale,
  copy,
}: {
  habits: HabitHistoryRow[];
  days: ISODate[];
  today: ISODate;
  locale: AppLocale;
  copy: {
    range: string;
    empty: string;
    title: string;
    daily: string;
    done: string;
    noRecord: string;
    notStarted: string;
    future: string;
    noRecordHint: string;
  };
}) {
  const t = useTranslations("life.habitHistory");
  const historyScrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = historyScrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [days.length]);

  const stateLabels: Record<HabitHistoryState, string> = {
    done: copy.done,
    noRecord: copy.noRecord,
    notStarted: copy.notStarted,
    future: copy.future,
  };
  const legendStates: HabitHistoryState[] = days.some((day) => day > today)
    ? ["done", "noRecord", "notStarted", "future"]
    : ["done", "noRecord", "notStarted"];

  return (
    <section
      className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs"
      aria-labelledby="habit-history-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="habit-history-heading" className="text-h2 text-text-primary">
          {copy.title}
        </h2>
        <p className="text-caption text-text-secondary">{copy.range}</p>
      </div>

      {habits.length === 0 ? (
        <p className="mt-4 rounded-lg bg-bg-subtle p-4 text-small text-text-secondary">
          {copy.empty}
        </p>
      ) : (
        <>
          <div
            ref={historyScrollerRef}
            className="mt-4 max-w-full min-w-0 overflow-x-auto rounded-lg border border-border"
          >
            <table className="w-full min-w-max border-collapse text-left text-caption">
              <thead className="bg-bg-subtle text-text-secondary">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-44 bg-bg-subtle px-3 py-2">
                    {copy.title}
                  </th>
                  {days.map((date) => (
                    <th key={date} scope="col" className="min-w-12 px-1 py-2 text-center">
                      <time dateTime={date}>{formatDate(date, "short", locale)}</time>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habits.map((habit) => (
                  <tr key={habit.id} className="border-t border-border">
                    <th scope="row" className="sticky left-0 z-10 bg-bg-surface px-3 py-2">
                      <span className="block max-w-52 truncate font-medium text-text-primary">
                        {habit.title}
                      </span>
                      <span className="block text-text-secondary">
                        {habit.cadence === "weekly"
                          ? t("weeklyTarget", { count: habit.target_per_week })
                          : copy.daily}
                      </span>
                    </th>
                    {habit.days.map(({ date, state }) => (
                      <td key={date} className="px-1 py-2 text-center">
                        <span
                          aria-label={`${habit.title}, ${formatDate(date, "medium", locale)}: ${stateLabels[state]}`}
                          title={stateLabels[state]}
                          className={`inline-flex size-7 items-center justify-center rounded-md font-semibold ${STATE_CLASS[state]}`}
                        >
                          <span aria-hidden="true">{STATE_MARK[state]}</span>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-caption text-text-secondary">
            {legendStates.map((state) => (
              <span key={state} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`rounded inline-flex size-5 items-center justify-center ${STATE_CLASS[state]}`}
                >
                  {STATE_MARK[state]}
                </span>
                {stateLabels[state]}
              </span>
            ))}
          </div>
          <p className="mt-2 text-caption text-text-secondary">{copy.noRecordHint}</p>
        </>
      )}
    </section>
  );
}
