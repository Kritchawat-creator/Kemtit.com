// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import type { DayTaskItem } from "@/core/domain/dayplan";
import type { TaskWithGoal } from "@/core/tasks/schema";
import { formatDate } from "@/lib/format";

import englishMessages from "@/messages/en.json";
import { TaskRow } from "./TaskRow";

const task: TaskWithGoal = {
  id: "task-1",
  user_id: "user-1",
  data_origin: "USER",
  goal_id: null,
  domain: "health",
  title: "Daily study session",
  due_date: "2026-10-10",
  recurrence_rule: "FREQ=DAILY",
  completed_at: null,
  persona_data: {},
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  task_group_id: null,
  task_group_position: 0,
  goal: null,
};

const dailyItem = (occurrenceDate: string): DayTaskItem<TaskWithGoal> => ({
  key: `task-1:${occurrenceDate}`,
  task,
  date: "2026-10-12",
  occurrenceDate,
  done: false,
  overdue: false,
  recurring: true,
});

describe("TaskRow moved recurring occurrences", () => {
  it("identifies the source date visually and in both action names", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    const movedFrom = formatDate("2026-10-11", "short", "en");
    const normalToggleName = englishMessages.a11y.toggleTask.replace("{title}", task.title);
    const normalOpenName = englishMessages.a11y.openTask.replace("{title}", task.title);
    const movedToggleName = englishMessages.a11y.toggleMovedTask
      .replace("{title}", task.title)
      .replace("{date}", movedFrom);
    const movedOpenName = englishMessages.a11y.openMovedTask
      .replace("{title}", task.title)
      .replace("{date}", movedFrom);

    render(
      <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
        <ul>
          <TaskRow
            item={dailyItem("2026-10-12")}
            today="2026-10-12"
            onToggle={onToggle}
            onOpen={onOpen}
          />
          <TaskRow
            item={dailyItem("2026-10-11")}
            today="2026-10-12"
            onToggle={onToggle}
            onOpen={onOpen}
          />
        </ul>
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(`Moved from ${movedFrom}`)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: normalToggleName })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: movedToggleName })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: normalOpenName })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: movedOpenName })).toBeInTheDocument();
  });
});
