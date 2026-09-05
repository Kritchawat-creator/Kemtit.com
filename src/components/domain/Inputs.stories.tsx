import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import type { Domain } from "@/core/domain/domains";
import type { PeriodType } from "@/core/domain/periods";

import { DatePicker } from "./DatePicker";
import { DomainSelect } from "./DomainSelect";
import { PeriodSwitcher } from "./PeriodSwitcher";
import { StatTile } from "./StatTile";

function DatePickerDemo({ initial }: { initial?: string }) {
  const [value, setValue] = useState<string | undefined>(initial);
  return <DatePicker value={value} onChange={setValue} />;
}
function DomainSelectDemo({ initial }: { initial: Domain }) {
  const [value, setValue] = useState<Domain>(initial);
  return <DomainSelect value={value} onValueChange={setValue} />;
}
function PeriodSwitcherDemo({ initial }: { initial: PeriodType }) {
  const [value, setValue] = useState<PeriodType>(initial);
  return <PeriodSwitcher value={value} onValueChange={setValue} />;
}

const meta = {
  title: "Domain/Inputs",
  component: DatePickerDemo,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DatePickerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DatePickerEmpty: Story = { render: () => <DatePickerDemo /> };
export const DatePickerSelected: Story = { render: () => <DatePickerDemo initial="2026-09-05" /> };
export const DomainSelectWork: Story = { render: () => <DomainSelectDemo initial="work" /> };
export const DomainSelectHealth: Story = { render: () => <DomainSelectDemo initial="health" /> };
export const PeriodSwitcherMonth: Story = { render: () => <PeriodSwitcherDemo initial="month" /> };
export const PeriodSwitcherWeek: Story = { render: () => <PeriodSwitcherDemo initial="week" /> };
export const StatTiles: Story = {
  render: () => (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatTile label="ยอดตอนนี้" value="฿21,500" hint="21,500 จาก 50,000" />
      <StatTile label="อีก" value="฿28,500" tone="warning" />
      <StatTile label="เหลือ 15 วัน" value="฿1,900" hint="ต้องเพิ่มวันละ" tone="success" />
    </div>
  ),
};
