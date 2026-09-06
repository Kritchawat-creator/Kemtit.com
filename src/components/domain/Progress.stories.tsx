import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { formatPercent } from "@/lib/format";

import { CompassDial } from "./CompassDial";
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
export const BarWithMarker: Story = { args: { value: 45, marker: true, showValue: false } };
/** Compass Dial (Claude Design 1a): 0 / 45 / 100% ขนาดใหญ่ + เล็ก 56px */
export const Dial: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-6">
        {[0, 45, 100].map((v) => (
          <div key={v} className="rounded-lg bg-brand-100 p-4">
            <CompassDial value={v} size={160} className="drop-shadow-dial" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {[0, 45, 100].map((v) => (
          <CompassDial key={v} value={v} size={56} small />
        ))}
      </div>
    </div>
  ),
};
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
