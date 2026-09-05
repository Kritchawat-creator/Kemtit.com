import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { GoalWithProgress } from "@/core/goals/queries";

import { GoalProgressPanel } from "./GoalProgressPanel";
import { WidgetShell } from "./WidgetShell";

const goal: GoalWithProgress = {
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
const other: GoalWithProgress = {
  ...goal,
  id: "g2",
  goal_kind: "execution",
  domain: "health",
  title: "ออกกำลังกาย 12 ครั้ง",
  target_value: null,
  persona_data: {},
  progress: { percent: 50, kind: "execution", tasksDone: 6, tasksTotal: 12, childCount: 0 },
};

const meta = {
  title: "Widgets/GoalProgressPanel",
  component: GoalProgressPanel,
  parameters: { layout: "padded" },
  args: { goal, others: [other], today: "2026-09-15" },
  decorators: [(Story) => <WidgetShell title="เป้าหลักเดือนนี้">{Story()}</WidgetShell>],
} satisfies Meta<typeof GoalProgressPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrack: Story = {};
export const Behind: Story = { args: { goal: { ...goal, current_value: 4000, progress: { ...goal.progress, percent: 8, current: 4000 }, pace: "behind" }, others: [] } };
export const Reached: Story = { args: { goal: { ...goal, current_value: 50000, status: "completed", progress: { ...goal.progress, percent: 100, current: 50000 }, pace: "done" } } };
export const ExecutionMain: Story = { args: { goal: other, others: [] } };
