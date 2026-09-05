import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";

import { WidgetShell } from "./WidgetShell";
import { WidgetSkeleton } from "./WidgetSkeleton";

const meta = {
  title: "Widgets/WidgetShell",
  component: WidgetShell,
  parameters: { layout: "padded" },
  args: { title: "งานวันนี้", children: <p className="text-body text-text-secondary">เนื้อหา widget</p> },
} satisfies Meta<typeof WidgetShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithDescriptionAndAction: Story = {
  args: { description: "2 ต้องทำ · 1 ค้าง · 3 เสร็จ", action: <Button size="sm" variant="ghost">เพิ่มงาน</Button> },
};
export const Loading: Story = { render: () => <WidgetSkeleton /> };
