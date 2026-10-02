"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveFinanceBudget } from "@/core/finance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FinanceBudgetForm({
  monthStart,
  initialAmount,
}: {
  monthStart: string;
  initialAmount: number | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [amount, setAmount] = useState(initialAmount == null ? "" : String(initialAmount));
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    startTransition(async () => {
      const result = await saveFinanceBudget({ monthStart, amount: numeric, notes: null });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("finance.operations.budgetSaved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        type="number"
        min="0.01"
        step="0.01"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder={t("finance.operations.budgetPlaceholder")}
        aria-label={t("finance.operations.monthlyBudget")}
      />
      <Button type="submit" variant="outline" className="w-full" disabled={pending || !amount}>
        {pending ? t("common.saving") : t("finance.operations.saveBudget")}
      </Button>
    </form>
  );
}
