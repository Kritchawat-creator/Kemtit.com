import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { ParentCandidate } from "@/core/goals/schema";

import { GoalForm } from "./GoalForm";
import { TaskForm } from "./TaskForm";
import { UpdateValueForm } from "./UpdateValueForm";

const candidates: ParentCandidate[] = [
  {
    id: "y1",
    title: "ปี 2569 ของฉัน",
    period_type: "year",
    period_start: "2026-01-01",
    domain: "work",
  },
  {
    id: "m1",
    title: "ยอดขาย กันยายน 2569",
    period_type: "month",
    period_start: "2026-09-01",
    domain: "work",
  },
];

const meta = {
  title: "Domain/Forms",
  component: GoalForm,
  parameters: { layout: "padded" },
  args: { mode: "create", parentCandidates: candidates, onDone: () => {} },
} satisfies Meta<typeof GoalForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GoalCreate: Story = {};
export const GoalEditMetric: Story = {
  args: {
    mode: "edit",
    goalId: "m1",
    initial: {
      title: "ยอดขาย กันยายน 2569",
      goalKind: "metric",
      targetValue: 50000,
      unit: "บาท",
      periodType: "month",
      periodStart: "2026-09-01",
      parentId: "y1",
    },
  },
};
export const GoalCreateWeekUnderMonth: Story = {
  args: {
    initial: { periodType: "week", periodStart: "2026-09-06", parentId: "m1", domain: "work" },
  },
};
export const TaskCreate: Story = {
  render: () => <TaskForm mode="create" goalOptions={candidates} onDone={() => {}} />,
};
export const TaskEditWeekly: Story = {
  render: () => (
    <TaskForm
      mode="edit"
      taskId="t1"
      goalOptions={candidates}
      initial={{
        title: "โพสต์ขายของ",
        dueDate: "2026-09-07",
        domain: "work",
        recurrence: "weekly",
        weekdays: [1, 3, 5],
        goalId: "m1",
      }}
      onDone={() => {}}
    />
  ),
};
export const UpdateValue: Story = {
  render: () => (
    <UpdateValueForm
      goal={{ id: "m1", title: "ยอดขาย กันยายน 2569", current_value: 21500, target_value: 50000 }}
      unit="THB"
      onDone={() => {}}
    />
  ),
};
