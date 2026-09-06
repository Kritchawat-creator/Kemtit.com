import {
  overlaps,
  parentPeriodType,
  periodOf,
  type Period,
  type PeriodType,
} from "@/core/domain/periods";

import type { ParentCandidate } from "./schema";

/** ตัวเลือกเป้าหมายแม่ที่ใช้ได้กับช่วงเวลาลูก (pure — ใช้ได้ทั้ง client/server) */
export function candidatesFor(
  candidates: ParentCandidate[],
  childType: PeriodType,
  childPeriod: Period | null,
  excludeId?: string,
): ParentCandidate[] {
  const wanted = parentPeriodType(childType);
  if (!wanted) return [];
  return candidates.filter(
    (c) =>
      c.id !== excludeId &&
      c.period_type === wanted &&
      (!childPeriod || overlaps(periodOf(c.period_type, c.period_start), childPeriod)),
  );
}
