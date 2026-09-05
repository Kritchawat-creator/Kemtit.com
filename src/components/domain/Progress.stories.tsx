import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { formatPercent } from "@/lib/format";

import { ProgressBar } from "./ProgressBar";
import { ProgressRing } from "./ProgressRing";

const meta = {
  title: "Domain/Progress",
  component: ProgressBar,
  parameters: { layout: "padded" },
  args: { value: 43, showValue: true },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bar: Story = {};
export const BarEmpty: Story = { args: { value: 0 } };
export const BarFullHealth: Story = { args: { value: 100, domain: "health" } };
export const Ring: Story = {
  render: () => (
    <div className="flex gap-6">
      {[0, 43, 100].map((v) => (
        <ProgressRing key={v} value={v}>
          <span className="text-display text-brand-800">{formatPercent(v / 100)}</span>
        </ProgressRing>
      ))}
    </div>
  ),
};
