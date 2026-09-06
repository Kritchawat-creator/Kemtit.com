import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { GoalTreeNode, GoalWithProgress } from "@/core/goals/queries";

import { GoalCascadeTree } from "./GoalCascadeTree";

const goal = (
  over: Partial<GoalWithProgress> & { id: string; title: string },
): GoalWithProgress => ({
  user_id: "u1",
  parent_id: null,
  period_type: "month",
  period_start: "2026-09-01",
  domain: "work",
  goal_kind: "execution",
  target_value: null,
  current_value: 0,
  persona_data: {},
  status: "active",
  completed_at: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  progress: { percent: 40, kind: "execution", tasksDone: 2, tasksTotal: 5, childCount: 0 },
  period: { type: "month", start: "2026-09-01", end: "2026-09-30" },
  pace: "onTrack",
  ...over,
});

const weeks: GoalTreeNode[] = [1, 2, 3, 4, 5].map((i) => ({
  goal: goal({
    id: `w${i}`,
    title: `สัปดาห์ที่ ${i}/5`,
    period_type: "week",
    period_start: "2026-08-30",
    period: { type: "week", start: "2026-08-30", end: "2026-09-05" },
    progress: {
      percent: i === 1 ? 100 : 0,
      kind: "execution",
      tasksDone: i === 1 ? 1 : 0,
      tasksTotal: 1,
      childCount: 0,
    },
    pace: i === 1 ? "done" : "notStarted",
  }),
  children: [],
}));

const tree: GoalTreeNode[] = [
  {
    goal: goal({
      id: "m1",
      title: "ยอดขาย กันยายน 2569",
      goal_kind: "metric",
      target_value: 50000,
      current_value: 21500,
      persona_data: { unit: "THB" },
      progress: { percent: 43, kind: "metric", current: 21500, target: 50000, childCount: 5 },
    }),
    children: weeks,
  },
  { goal: goal({ id: "h1", title: "ออกกำลังกาย 12 ครั้ง", domain: "health" }), children: [] },
];

const meta = {
  title: "Domain/GoalCascadeTree",
  component: GoalCascadeTree,
  parameters: { layout: "padded" },
  args: { nodes: tree },
} satisfies Meta<typeof GoalCascadeTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoLevels: Story = {};
export const LeafOnly: Story = { args: { nodes: weeks } };
export const Empty: Story = { args: { nodes: [] } };
