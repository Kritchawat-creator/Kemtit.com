import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";

import { Button } from "./button";

/**
 * ปุ่มพื้นฐานจาก shadcn/ui — ข้อความในปุ่มบอกสิ่งที่จะเกิดขึ้น ("บันทึกเป้าหมาย" ไม่ใช่ "ตกลง") (Design §4.3)
 */
const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  args: { children: "บันทึกเป้าหมาย" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "link", "destructive"],
    },
    size: { control: "select", options: ["sm", "default", "lg", "icon"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: "secondary" } };

export const Outline: Story = { args: { variant: "outline" } };

export const Ghost: Story = { args: { variant: "ghost" } };

export const Destructive: Story = { args: { variant: "destructive", children: "ลบเป้าหมาย" } };

export const Disabled: Story = { args: { disabled: true } };

export const WithIcon: Story = {
  args: { children: "เพิ่มงาน" },
  render: (args) => (
    <Button {...args}>
      <Plus aria-hidden="true" />
      {args.children}
    </Button>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm">
        เล็ก
      </Button>
      <Button {...args}>ปกติ</Button>
      <Button {...args} size="lg">
        ใหญ่
      </Button>
      <Button {...args} size="icon" aria-label="เพิ่มงาน">
        <Plus aria-hidden="true" />
      </Button>
    </div>
  ),
};
