import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Target } from "lucide-react";

import { Button } from "@/components/ui/button";

import { EmptyState } from "./EmptyState";

const meta = {
  title: "Domain/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
  args: {
    icon: Target,
    title: "ตั้งเป้าหมายแรกของเดือนนี้",
    description: "เป้าเดียวก็พอ เข็มทิศจะแตกเป็นงานรายสัปดาห์ให้",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAction: Story = { args: { action: <Button>ตั้งเป้าหมาย</Button> } };
export const WithoutAction: Story = {};
export const TextOnly: Story = { args: { icon: undefined, description: undefined } };
