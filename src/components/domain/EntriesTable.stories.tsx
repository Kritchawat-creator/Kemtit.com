import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { EntryGoalOption, GoalEntryWithGoal } from "@/core/entries/schema";
import { EmptyState } from "@/components/domain/EmptyState";

import { EntriesTable } from "./EntriesTable";

const TODAY = "2026-09-06";
const goal = { id: "g1", title: "ยอดขาย กันยายน 2569", persona_data: { unit: "THB" } };

const goalOptions: EntryGoalOption[] = [
  {
    id: "g1",
    title: "ยอดขาย กันยายน 2569",
    unit: "THB",
    period_type: "month",
    period_start: "2026-09-01",
    target_value: 50000,
  },
];

const base: Omit<GoalEntryWithGoal, "id" | "entry_no" | "entry_date" | "amount" | "note"> = {
  user_id: "u1",
  goal_id: "g1",
  channel: "shopee",
  created_at: "2026-09-06T01:00:00Z",
  updated_at: "2026-09-06T01:00:00Z",
  goal,
};

const rows: GoalEntryWithGoal[] = [
  {
    ...base,
    id: "e6",
    entry_no: 1045,
    entry_date: TODAY,
    amount: 5000,
    note: "บันทึกเช้า",
    channel: "line",
  },
  { ...base, id: "e5", entry_no: 1044, entry_date: "2026-09-05", amount: 5300, note: "ตลาดนัด" },
  {
    ...base,
    id: "e4",
    entry_no: 1043,
    entry_date: "2026-09-04",
    amount: 6100,
    note: "โปรวันศุกร์",
    channel: "storefront",
  },
  // note = null คือรายการที่มาจากฟอร์ม "อัปเดตยอด" (adjustment entry)
  { ...base, id: "e3", entry_no: 1042, entry_date: "2026-09-03", amount: 4200, note: null },
];

const meta = {
  title: "Domain/EntriesTable",
  component: EntriesTable,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="rounded-xl bg-bg-surface p-6 shadow-md">
        <Story />
      </div>
    ),
  ],
  args: { today: TODAY, goalOptions, rows },
} satisfies Meta<typeof EntriesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** เต็มรูปแบบ (หน้า /entries): มีคอลัมน์ช่องทาง · แถวแรกเป็นของวันนี้ · แถวสุดท้ายเป็นรายการปรับยอด */
export const Full: Story = {};

/** ย่อบนแดชบอร์ด "บันทึกยอดล่าสุด" — ตัดคอลัมน์ช่องทางออก */
export const Compact: Story = { args: { compact: true, rows: rows.slice(0, 3) } };

/** ยังไม่มีรายการ */
export const Empty: Story = {
  args: {
    rows: [],
    emptyState: <EmptyState illustration="compass" title="ยังไม่มีบันทึกยอด" />,
  },
};
