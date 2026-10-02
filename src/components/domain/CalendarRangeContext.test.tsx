// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations:
    (namespace?: string) => (key: string, values?: { count?: number; date?: string }) => {
      const labels: Record<string, string> = {
        "today.calendarEvent": "Event",
        "today.timeBlock": "Time block",
        "today.allDay": "All day",
        "capture.types.bill": "Bill",
      };
      if (namespace === "calendar" && key === "tasksCount") return `${values?.count ?? 0} tasks`;
      if (namespace === "calendar" && key === "billDue") return "Bill due";
      if (namespace === "calendar" && key === "openDay") return `Open ${values?.date ?? "day"}`;
      return labels[key] ?? key;
    },
}));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));

import { calendarContextByDay } from "@/core/domain/calendar-context";
import { monthGrid } from "@/core/domain/calendar";
import { CalendarMonth } from "./CalendarMonth";
import { CalendarWeek } from "./CalendarWeek";

const date = "2026-09-26" as const;
const events = [
  {
    id: "event-26",
    title: "QA26 Calendar event",
    event_date: date,
    all_day: true,
    start_time: null,
    end_time: null,
  },
];
const bills = [{ id: "bill-26", title: "QA26 bill", due_date: date, status: "due", amount: 500 }];
const timeBlocks = [
  {
    id: "block-26",
    title: "QA26 time block",
    start_at: "2026-09-26T02:00:00.000Z",
    end_at: "2026-09-26T02:30:00.000Z",
  },
];
const contextByDay = calendarContextByDay(events, bills, timeBlocks);
const tasks = Array.from({ length: 5 }, (_, index) => ({
  key: `task-${index}`,
  task: {
    id: `task-${index}`,
    title: `Task ${index}`,
    domain: "work",
    due_date: date,
    recurrence_rule: null,
    completed_at: null,
    goal_id: null,
  },
  date,
  done: false,
  overdue: false,
  recurring: false,
}));

describe("Calendar week and month context records", () => {
  it("shows events, bills, and time blocks alongside a full five-task week preview", () => {
    render(
      <CalendarWeek
        days={[date]}
        byDay={{ [date]: tasks }}
        contextByDay={contextByDay}
        today={date}
        selected={date}
      />,
    );

    expect(screen.getByText("QA26 Calendar event")).toBeInTheDocument();
    expect(screen.getByText("QA26 bill")).toBeInTheDocument();
    expect(screen.getByText("QA26 time block")).toBeInTheDocument();
  });

  it("announces event, time-block, and bill markers for context-only dates in Month", () => {
    render(
      <CalendarMonth
        date="2026-09-01"
        weeks={monthGrid("2026-09-01")}
        byDay={{}}
        contextByDay={contextByDay}
        today="2026-09-26"
        selected="2026-09-01"
      />,
    );

    expect(screen.getByRole("link", { name: /Event · Time block · Bill/ })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
