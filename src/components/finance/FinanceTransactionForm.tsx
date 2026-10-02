"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createFinanceTransaction } from "@/core/finance/actions";
import type { FinanceTransactionType } from "@/core/finance/schema";
import { DatePicker } from "@/components/domain/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FinanceTransactionForm({ today }: { today: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [type, setType] = useState<FinanceTransactionType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numeric = Number(amount);
    if (!title.trim() || !Number.isFinite(numeric) || numeric <= 0) return;

    startTransition(async () => {
      const result = await createFinanceTransaction({
        transactionType: type,
        title,
        amount: numeric,
        occurredOn: date,
        category: null,
        notes: null,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setTitle("");
      setAmount("");
      toast.success(t("finance.operations.transactionSaved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={type}
          onChange={(event) => setType(event.target.value as FinanceTransactionType)}
          aria-label={t("finance.operations.type")}
          className="h-11 rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
        >
          <option value="expense">{t("finance.operations.expense")}</option>
          <option value="income">{t("finance.operations.income")}</option>
        </select>
        <div>
          <label htmlFor="finance-transaction-date" className="sr-only">
            {t("finance.operations.date")}
          </label>
          <DatePicker
            id="finance-transaction-date"
            ariaLabel={t("finance.operations.date")}
            value={date}
            onChange={(next) => next && setDate(next)}
          />
        </div>
      </div>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("finance.operations.titlePlaceholder")}
        aria-label={t("finance.operations.title")}
      />
      <Input
        type="number"
        min="0.01"
        step="0.01"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder={t("finance.operations.amountPlaceholder")}
        aria-label={t("finance.operations.amount")}
      />
      <Button type="submit" className="w-full" disabled={pending || !title.trim() || !amount}>
        {pending ? t("common.saving") : t("finance.operations.saveTransaction")}
      </Button>
    </form>
  );
}
