import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { DayTaskItem, PlanTask } from "@/core/domain/dayplan";
import { monthGrid } from "@/core/domain/calendar";

import { CalendarMonth } from "./CalendarMonth";
import { CalendarNav } from "./CalendarNav";
import { CalendarWeek } from "./CalendarWeek";

const mk = (
  id: string,
  title: string,
  domain: string,
  date: string,
  done = false,
): DayTaskItem<PlanTask> => ({
  key: `${id}:${date}`,
  task: {
    id,
    title,
    domain,
    due_date: date,
    recurrence_rule: null,
    completed_at: done ? "2026-09-01T00:00:00Z" : null,
    goal_id: null,
  },
  date,
  done,
  overdue: false,
  recurring: false,
});
const byDay = {
  "2026-09-01": [
    mk("a", "ตั้งราคาและโปรโมชั่น", "work", "2026-09-01", true),
    mk("b", "วิ่ง 5 กม.", "health", "2026-09-01"),
  ],
  "2026-09-03": [
    mk("c", "โทรหาลูกค้าเก่า", "work", "2026-09-03"),
    mk("d", "โอนเงินออม", "finance", "2026-09-03"),
    mk("e", "อ่านหนังสือ", "growth", "2026-09-03"),
    mk("f", "ทานข้าวกับครอบครัว", "family", "2026-09-03"),
    mk("g", "งานที่ 5", "work", "2026-09-03"),
  ],
  "2026-09-05": [mk("h", "สรุปยอดขายสัปดาห์นี้", "work", "2026-09-05")],
};
const days = [
  "2026-08-30",
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
];

const meta = {
  title: "Domain/Calendar",
  component: CalendarWeek,
  parameters: { layout: "padded" },
  args: { days, byDay, today: "2026-09-05" },
} satisfies Meta<typeof CalendarWeek>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Week: Story = {};
export const WeekEmpty: Story = { args: { byDay: {} } };
export const Month: Story = {
  render: () => (
    <CalendarMonth
      date="2026-09-01"
      weeks={monthGrid("2026-09-01")}
      byDay={byDay}
      today="2026-09-05"
    />
  ),
};
export const Nav: Story = {
  render: () => <CalendarNav view="week" date="2026-09-05" today="2026-09-05" />,
};
