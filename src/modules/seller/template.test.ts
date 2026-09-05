import { describe, expect, it } from "vitest";

import { goalSpecSchema } from "@/core/goals/schema";

import { sellerFirstGoalSpec } from "./template";

const labels = {
  monthGoalTitle: (m: string) => `ยอดขาย ${m}`,
  weekGoalTitle: (i: number, n: number) => `สัปดาห์ที่ ${i}/${n}`,
  sampleTask: (i: number) => `งานตัวอย่าง ${i}`,
};

describe("sellerFirstGoalSpec", () => {
  it("เป้าเดือน metric บาท + week execution ทุกสัปดาห์ที่ทับเดือน + task 1 ตัว/สัปดาห์", () => {
    const spec = sellerFirstGoalSpec({ monthStart: "2026-09-01", targetValue: 50000 }, labels);
    expect(spec.goalKind).toBe("metric");
    expect(spec.unit).toBe("THB");
    expect(spec.targetValue).toBe(50000);
    expect(spec.children).toHaveLength(5);
    expect(spec.children?.every((c) => c.goalKind === "execution" && c.periodType === "week")).toBe(true);
    // สัปดาห์แรกเริ่ม 30 ส.ค. แต่ task ตัวอย่างต้องอยู่ในเดือน (1 ก.ย.)
    expect(spec.children?.[0]?.periodStart).toBe("2026-08-30");
    expect(spec.children?.[0]?.tasks?.[0]?.dueDate).toBe("2026-09-01");
    expect(spec.children?.[1]?.tasks?.[0]?.dueDate).toBe("2026-09-06");
  });

  it("ผ่าน goalSpecSchema (ตรวจก่อนแตะ DB)", () => {
    const spec = sellerFirstGoalSpec({ monthStart: "2026-09-15", targetValue: 1000 }, labels);
    expect(goalSpecSchema.safeParse(spec).success).toBe(true);
    expect(spec.periodStart).toBe("2026-09-01");
  });
});
