"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { childPeriodType, periodOf } from "@/core/domain/periods";
import type { ParentCandidate } from "@/core/goals/schema";
import { GoalForm } from "@/components/domain/GoalForm";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type Props = { parentCandidates: ParentCandidate[] };

/**
 * อ่าน `?new=goal|task` (+ `parent`, `goal`) แล้ว render ฟอร์มใน Sheet/Dialog จุดเดียวทั้งแอป
 * ปิด = ลบ query ออกจาก URL (ไม่เปลี่ยนหน้า)
 */
export function QuickAddHost({ parentCandidates }: Props) {
  const t = useTranslations();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const kind = params.get("new");

  const close = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("new");
    next.delete("parent");
    next.delete("goal");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  if (kind === "goal") {
    const parent = parentCandidates.find((c) => c.id === params.get("parent"));
    const childType = parent ? childPeriodType(parent.period_type) : null;
    return (
      <ResponsiveDialog open onOpenChange={(open) => !open && close()} title={t("goals.new")}>
        <GoalForm
          mode="create"
          parentCandidates={parentCandidates}
          initial={
            parent && childType
              ? { parentId: parent.id, periodType: childType, periodStart: periodOf(childType, parent.period_start).start, domain: parent.domain }
              : undefined
          }
          onDone={close}
        />
      </ResponsiveDialog>
    );
  }

  // kind === "task" → TaskForm มาใน M3
  return null;
}
