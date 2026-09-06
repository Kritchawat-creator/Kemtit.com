import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { GoalWithProgress } from "@/core/goals/queries";

import { GoalCard } from "./GoalCard";

const base: GoalWithProgress = {
  id: "g1",
  user_id: "u1",
  parent_id: null,
  period_type: "month",
  period_start: "2026-09-01",
  domain: "work",
  goal_kind: "metric",
  title: "ยอดขาย กันยายน 2569",
  target_value: 50000,
  current_value: 21500,
  persona_data: { unit: "THB" },
  status: "active",
  completed_at: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  progress: { percent: 43, kind: "metric", current: 21500, target: 50000, childCount: 5 },
  period: { type: "month", start: "2026-09-01", end: "2026-09-30" },
  pace: "onTrack",
};

const meta = {
  title: "Domain/GoalCard",
  component: GoalCard,
  parameters: { layout: "padded" },
  args: { goal: base },
} satisfies Meta<typeof GoalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MetricOnTrack: Story = {};
export const Behind: Story = {
  args: {
    goal: {
      ...base,
      current_value: 5000,
      progress: { ...base.progress, percent: 10, current: 5000 },
      pace: "behind",
    },
  },
};
export const ExecutionWithTasks: Story = {
  args: {
    goal: {
      ...base,
      id: "g2",
      goal_kind: "execution",
      domain: "health",
      title: "ออกกำลังกาย 12 ครั้ง",
      target_value: null,
      persona_data: {},
      progress: { percent: 50, kind: "execution", tasksDone: 6, tasksTotal: 12, childCount: 0 },
    },
  },
};
export const Compact: Story = { args: { compact: true } };
export const Archived: Story = { args: { goal: { ...base, status: "archived" } } };
export const Done: Story = {
  args: {
    goal: {
      ...base,
      current_value: 50000,
      status: "completed",
      progress: { ...base.progress, percent: 100, current: 50000 },
      pace: "done",
    },
  },
};
