"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveFinanceGoalDetails } from "@/core/finance/actions";
import { FINANCE_GOAL_TYPES, type FinanceGoalType } from "@/core/finance/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  goalId: string;
  initial?: {
    finance_type: string;
    monthly_target: number | null;
  } | null;
};

export function FinanceGoalSettings({ goalId, initial }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [financeType, setFinanceType] = useState<FinanceGoalType>(
    (initial?.finance_type as FinanceGoalType | undefined) ?? "saving",
  );
  const [monthlyTarget, setMonthlyTarget] = useState(
    initial?.monthly_target != null ? String(initial.monthly_target) : "",
  );
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveFinanceGoalDetails({
        goalId,
        financeType,
        monthlyTarget: monthlyTarget ? Number(monthlyTarget) : null,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("finance.saved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="space-y-1 text-caption font-medium text-text-secondary">
        <span>{t("finance.type")}</span>
        <select
          value={financeType}
          onChange={(event) => setFinanceType(event.target.value as FinanceGoalType)}
          className="h-10 w-full rounded-sm border border-border bg-bg-surface px-3 text-small text-text-primary"
        >
          {FINANCE_GOAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`finance.types.${type}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-caption font-medium text-text-secondary">
        <span>{t("finance.monthlyTarget")}</span>
        <Input
          type="number"
          min={1}
          step={1}
          value={monthlyTarget}
          onChange={(event) => setMonthlyTarget(event.target.value)}
          className="h-10"
        />
      </label>

      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? t("common.saving") : t("finance.save")}
      </Button>
    </form>
  );
}
