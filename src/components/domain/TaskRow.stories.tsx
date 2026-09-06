import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { DayTaskItem } from "@/core/domain/dayplan";
import type { TaskWithGoal } from "@/core/tasks/schema";

import { TaskRow } from "./TaskRow";

const task: TaskWithGoal = {
  id: "t1",
  user_id: "u1",
  goal_id: "g1",
  domain: "work",
  title: "ตอบแชทลูกค้าค้าง",
  due_date: "2026-09-05",
  recurrence_rule: null,
  completed_at: null,
  persona_data: {},
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
  goal: { id: "g1", title: "ยอดขาย กันยายน 2569" },
};
const item: DayTaskItem<TaskWithGoal> = {
  key: "t1",
  task,
  date: "2026-09-05",
  done: false,
  overdue: false,
  recurring: false,
};

const meta = {
  title: "Domain/TaskRow",
  component: TaskRow,
  parameters: { layout: "padded" },
  args: { item, today: "2026-09-05", onToggle: () => {}, onOpen: () => {}, showGoal: true },
  decorators: [
    (Story) => <ul className="rounded-lg border border-border bg-bg-surface">{Story()}</ul>,
  ],
} satisfies Meta<typeof TaskRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Todo: Story = {};
export const Done: Story = { args: { item: { ...item, done: true } } };
export const Overdue: Story = {
  args: {
    item: { ...item, date: "2026-09-01", overdue: true, task: { ...task, due_date: "2026-09-01" } },
  },
};
export const Recurring: Story = {
  args: {
    item: {
      ...item,
      key: "t1:2026-09-05",
      recurring: true,
      task: { ...task, recurrence_rule: "FREQ=DAILY", domain: "health", goal: null },
    },
  },
};
