import { z } from "zod";

import type { PeriodType } from "@/core/domain/periods";
import { isoDateSchema } from "@/core/tasks/schema";
import type { ISODate } from "@/lib/date";
import type { Database, Json } from "@/types/database";

/** ช่องทางขาย (Claude Design turn 6/7 "บันทึกยอด") — ตรงกับ check constraint ของ goal_entries.channel */
export const CHANNELS = [
  "shopee",
  "lazada",
  "tiktok",
  "line",
  "facebook",
  "storefront",
  "other",
] as const;
export type Channel = (typeof CHANNELS)[number];

type GoalEntryRow = Database["public"]["Tables"]["goal_entries"]["Row"];

/** แถว goal_entries โดย narrow channel เป็น enum ที่ DB บังคับด้วย check constraint (แบบเดียวกับ Goal ใน core/goals/schema) */
export type GoalEntry = Omit<GoalEntryRow, "channel"> & { channel: Channel | null };

/** entry พร้อมข้อมูล goal ย่อ (ใช้ในตาราง /entries และ dashboard ที่โชว์ชื่อเป้า) */
export type GoalEntryWithGoal = GoalEntry & {
  goal: { id: string; title: string; persona_data: Json } | null;
};

/** สถานะที่คำนวณ ไม่ได้เก็บใน DB: วันนี้ = "today" (พิล brand), อื่น ๆ = "confirmed" (ยืนยันแล้ว) */
export type EntryStatus = "today" | "confirmed";

export function entryStatus(entryDate: ISODate, today: ISODate): EntryStatus {
  return entryDate === today ? "today" : "confirmed";
}

/** รหัสรายการที่โชว์ในตาราง: "#K" + entry_no ปัดเป็น 4 หลัก เช่น 41 → "#K0041" */
export function entryCode(entryNo: number): string {
  return `#K${String(entryNo).padStart(4, "0")}`;
}

/** ตัวเลือกเป้าที่บันทึกยอดได้ (metric, active) สำหรับฟอร์ม */
export type EntryGoalOption = {
  id: string;
  title: string;
  unit: string | null;
  period_type: PeriodType;
  period_start: string;
  target_value: number | null;
};

/** ฟอร์มบันทึก/แก้ยอด — ข้อความ error เป็น key ใน th.json (errors.*) */
export const entryFormSchema = z.object({
  goalId: z.uuid({ error: "invalidGoal" }),
  entryDate: isoDateSchema,
  amount: z
    .number({ error: "invalidNumber" })
    .positive({ error: "positive" })
    .max(1_000_000_000, { error: "tooLarge" }),
  note: z.string().trim().max(120, { error: "tooLong" }).optional(),
  channel: z.enum(CHANNELS).nullable().optional(),
});
export type EntryFormValues = z.infer<typeof entryFormSchema>;

export const updateEntrySchema = z.object({
  id: z.uuid(),
  values: entryFormSchema.omit({ goalId: true }),
});
export const deleteEntrySchema = z.object({ id: z.uuid() });
