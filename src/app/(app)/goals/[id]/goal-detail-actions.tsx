"use client";

import { Archive, Pencil, Plus, RotateCcw, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { childPeriodType } from "@/core/domain/periods";
import { setGoalStatus } from "@/core/goals/actions";
import type { GoalWithProgress } from "@/core/goals/queries";
import { goalUnit, type ParentCandidate } from "@/core/goals/schema";
import { Celebration } from "@/components/domain/Celebration";
import { GoalForm } from "@/components/domain/GoalForm";
import { UpdateValueForm } from "@/components/domain/UpdateValueForm";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type Props = { goal: GoalWithProgress; parentCandidates: ParentCandidate[] };

const UNDO_MS = 5000; // Design §8.5: undo toast 5 วินาที แทน confirm

/** ปุ่มบนหน้า detail: อัปเดตยอด (metric) · แก้ไข · เพิ่มเป้าย่อย · เก็บเข้ากรุ (undo ได้) */
export function GoalDetailActions({ goal, parentCandidates }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "value" | null>(null);
  const [fireKey, setFireKey] = useState(0);
  const [, startTransition] = useTransition();

  const childType = childPeriodType(goal.period_type);
  const addChildHref = childType ? `?new=goal&parent=${goal.id}` : null;

  function archive() {
    startTransition(async () => {
      const result = await setGoalStatus({ id: goal.id, status: "archived" });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      router.refresh();
      toast(t("goals.archivedToast", { title: goal.title }), {
        duration: UNDO_MS,
        action: {
          label: t("common.undo"),
          onClick: () => {
            startTransition(async () => {
              const restored = await setGoalStatus({ id: goal.id, status: "active" });
              if (restored.ok) {
                toast.success(t("goals.restoredToast", { title: goal.title }));
                router.refresh();
              }
            });
          },
        },
      });
    });
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label={t("a11y.goalActions")}>
      {goal.goal_kind === "metric" && goal.status !== "archived" ? (
        <Button onClick={() => setDialog("value")}>
          <TrendingUp aria-hidden="true" />
          {t("goals.updateValue")}
        </Button>
      ) : null}
      <Button variant="outline" onClick={() => setDialog("edit")}>
        <Pencil aria-hidden="true" />
        {t("goals.editShort")}
      </Button>
      {addChildHref ? (
        <Button variant="outline" asChild>
          <Link href={addChildHref} scroll={false}>
            <Plus aria-hidden="true" />
            {t("goals.addChild")}
          </Link>
        </Button>
      ) : null}
      {goal.status === "archived" ? (
        <Button
          variant="ghost"
          onClick={() =>
            startTransition(async () => {
              const restored = await setGoalStatus({ id: goal.id, status: "active" });
              if (restored.ok) {
                toast.success(t("goals.restoredToast", { title: goal.title }));
                router.refresh();
              }
            })
          }
        >
          <RotateCcw aria-hidden="true" />
          {t("common.undo")}
        </Button>
      ) : (
        <Button variant="ghost" onClick={archive}>
          <Archive aria-hidden="true" />
          {t("goals.archive")}
        </Button>
      )}

      <ResponsiveDialog
        open={dialog === "edit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("goals.edit")}
      >
        <GoalForm
          mode="edit"
          goalId={goal.id}
          initial={{
            title: goal.title,
            periodType: goal.period_type,
            periodStart: goal.period_start,
            domain: goal.domain,
            goalKind: goal.goal_kind,
            targetValue: goal.target_value ?? undefined,
            unit: goalUnit(goal) ?? "",
            parentId: goal.parent_id,
          }}
          parentCandidates={parentCandidates}
          onDone={() => setDialog(null)}
        />
      </ResponsiveDialog>

      <ResponsiveDialog
        open={dialog === "value"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("goals.updateValueTitle", { title: goal.title })}
        description={t("goals.updateValueDescription")}
      >
        <UpdateValueForm
          goal={goal}
          unit={goalUnit(goal)}
          onDone={() => setDialog(null)}
          onCompleted={() => setFireKey((k) => k + 1)}
        />
      </ResponsiveDialog>

      <Celebration fireKey={fireKey} />
    </div>
  );
}
