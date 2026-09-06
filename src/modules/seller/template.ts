import { periodOf, suggestChildPeriods } from "@/core/domain/periods";
import type { GoalSpec } from "@/core/goals/schema";
import { isAfterISO, type ISODate } from "@/lib/date";

/** ข้อความของ template มาจาก th.json ผ่าน app layer — module ไม่ hardcode ภาษาไทย */
export type SellerTemplateLabels = {
  monthGoalTitle: (monthStart: ISODate) => string;
  weekGoalTitle: (index: number, total: number) => string;
  sampleTask: (index: number) => string;
};

export type SellerFirstGoalInput = { monthStart: ISODate; targetValue: number };

/**
 * เป้าแรกของ seller (POC Decisions 1.4): metric goal ระดับเดือน (บาท) → week goal ลูก (execution) ทุกสัปดาห์ที่ทับเดือน
 * + task ตัวอย่าง 1 ตัว/สัปดาห์ ครบกำหนดวันแรกของสัปดาห์ที่อยู่ในเดือน — ไม่สร้าง year goal
 */
export function sellerFirstGoalSpec(
  input: SellerFirstGoalInput,
  labels: SellerTemplateLabels,
): GoalSpec {
  const month = periodOf("month", input.monthStart);
  const weeks = suggestChildPeriods(month, "week");

  return {
    title: labels.monthGoalTitle(month.start),
    periodType: "month",
    periodStart: month.start,
    domain: "work",
    goalKind: "metric",
    targetValue: input.targetValue,
    unit: "THB",
    children: weeks.map((week, i) => ({
      title: labels.weekGoalTitle(i + 1, weeks.length),
      periodType: "week",
      periodStart: week.start,
      domain: "work",
      goalKind: "execution",
      tasks: [
        {
          title: labels.sampleTask(i + 1),
          dueDate: isAfterISO(month.start, week.start) ? month.start : week.start,
          domain: "work",
        },
      ],
    })),
  };
}
