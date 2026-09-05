import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DOMAINS } from "@/core/domain/domains";

import { DomainTag } from "./DomainTag";
import { PaceBadge } from "./PaceBadge";

const meta = {
  title: "Domain/DomainTag",
  component: DomainTag,
  parameters: { layout: "padded" },
  args: { domain: "work" },
} satisfies Meta<typeof DomainTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};
export const AllDomains: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {DOMAINS.map((d) => (
        <DomainTag key={d} domain={d} size="md" />
      ))}
    </div>
  ),
};
export const PaceBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <PaceBadge status="onTrack" />
      <PaceBadge status="behind" />
      <PaceBadge status="notStarted" />
      <PaceBadge status="done" />
    </div>
  ),
};
