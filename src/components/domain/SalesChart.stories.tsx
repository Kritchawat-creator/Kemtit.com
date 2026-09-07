import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { cumulativeSeries } from "@/core/domain/entries";
import { periodOf } from "@/core/domain/periods";

import { SalesChart } from "./SalesChart";

const SEPT = periodOf("month", "2026-09-15"); // 1–30 ก.ย. 2569
const TARGET = 50000;

const entries = [
  { entry_date: "2026-09-01", amount: 4800 },
  { entry_date: "2026-09-02", amount: 5600 },
  { entry_date: "2026-09-03", amount: 4200 },
  { entry_date: "2026-09-04", amount: 6100 },
  { entry_date: "2026-09-05", amount: 5300 },
  { entry_date: "2026-09-06", amount: 5000 },
];

const meta = {
  title: "Domain/SalesChart",
  component: SalesChart,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-3xl rounded-xl bg-bg-surface p-6 shadow-md">
        <Story />
      </div>
    ),
  ],
  args: {
    period: SEPT,
    target: TARGET,
    unit: "THB",
    range: "month" as const,
  },
} satisfies Meta<typeof SalesChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ต้นเดือน ยังไม่มีใครบันทึกยอด — เห็นแค่เส้นแผนกับเส้นเป้า */
export const EmptyMonth: Story = {
  args: { today: "2026-09-03", series: cumulativeSeries([], SEPT, "2026-09-03") },
};

/** กลางเดือน นำแผนอยู่ — เส้นสะสมอยู่เหนือเส้นประ จุดชมพูคือวันนี้ */
export const AheadOfPlan: Story = {
  args: { today: "2026-09-06", series: cumulativeSeries(entries, SEPT, "2026-09-06") },
};

/** มุมมองสัปดาห์ — แกน X เป็นรายวัน 7 ช่อง ค่ายังเป็นยอดสะสมของเดือน */
export const WeekRange: Story = {
  args: {
    today: "2026-09-06",
    range: "week",
    series: cumulativeSeries(entries, SEPT, "2026-09-06"),
  },
};
