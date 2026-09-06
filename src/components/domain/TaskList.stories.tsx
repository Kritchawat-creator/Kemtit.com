import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { DayTaskItem } from "@/core/domain/dayplan";
import type { TaskWithGoal } from "@/core/tasks/schema";
import { EmptyState } from "@/components/domain/EmptyState";

import { TaskList } from "./TaskList";

const base: TaskWithGoal = {
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
const items: DayTaskItem<TaskWithGoal>[] = [
  {
    key: "old",
    task: { ...base, id: "old", title: "ส่งของให้ลูกค้าเมื่อวาน", due_date: "2026-09-04" },
    date: "2026-09-04",
    done: false,
    overdue: true,
    recurring: false,
  },
  { key: "t1", task: base, date: "2026-09-05", done: false, overdue: false, recurring: false },
  {
    key: "r:2026-09-05",
    task: {
      ...base,
      id: "r",
      title: "เช็คสต็อกสินค้า",
      recurrence_rule: "FREQ=DAILY",
      domain: "work",
      goal: null,
    },
    date: "2026-09-05",
    done: false,
    overdue: false,
    recurring: true,
  },
  {
    key: "d",
    task: {
      ...base,
      id: "d",
      title: "ออกกำลังกาย 30 นาที",
      domain: "health",
      completed_at: "2026-09-05T02:00:00Z",
      goal: null,
    },
    date: "2026-09-05",
    done: true,
    overdue: false,
    recurring: false,
  },
];

const meta = {
  title: "Domain/TaskList",
  component: TaskList,
  parameters: { layout: "padded" },
  args: {
    items,
    today: "2026-09-05",
    goalOptions: [
      {
        id: "g1",
        title: "ยอดขาย กันยายน 2569",
        period_type: "month",
        period_start: "2026-09-01",
        domain: "work",
      },
    ],
    showGoal: true,
  },
} satisfies Meta<typeof TaskList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grouped: Story = {};
export const Flat: Story = { args: { groupByStatus: false } };
export const Empty: Story = {
  args: {
    items: [],
    emptyState: <EmptyState title="วันนี้ยังไม่มีงาน" description="เพิ่มงานเล็ก ๆ สักอย่าง" />,
  },
};
