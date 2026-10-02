"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createFinanceBill,
  markFinanceBillPaid,
  updateFinanceBillAmount,
} from "@/core/finance/actions";
import type { AppLocale } from "@/i18n/config";
import { formatDate, formatTHB } from "@/lib/format";
import type { Database } from "@/types/database";
import { DatePicker } from "@/components/domain/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Bill = Database["public"]["Tables"]["finance_bills"]["Row"];

export function FinanceBills({ bills, today }: { bills: Bill[]; today: string }) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(today);
  const [recurrence, setRecurrence] = useState<"none" | "monthly">("none");
  const [billAmounts, setBillAmounts] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();

  const sorted = useMemo(
    () => [...bills].sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [bills],
  );

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    const numeric = amount.trim() ? Number(amount) : null;
    if (numeric !== null && (!Number.isFinite(numeric) || numeric < 0)) return;

    startCreate(async () => {
      const result = await createFinanceBill({
        title,
        amount: numeric,
        dueDate,
        recurrence,
        notes: null,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setTitle("");
      setAmount("");
      toast.success(t("finance.operations.billSaved"));
      router.refresh();
    });
  }

  async function saveMissingAmount(bill: Bill) {
    const numeric = Number(billAmounts[bill.id] ?? "");
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    setPendingId(bill.id);
    const result = await updateFinanceBillAmount({ billId: bill.id, amount: numeric });
    setPendingId(null);
    if (!result.ok) {
      toast.error(t("errors.generic"));
      return;
    }
    router.refresh();
  }

  async function pay(bill: Bill) {
    setPendingId(bill.id);
    const result = await markFinanceBillPaid({ billId: bill.id, paidOn: today });
    setPendingId(null);
    if (!result.ok) {
      toast.error(
        result.error === "billAmountRequired"
          ? t("errors.billAmountRequired")
          : t("errors.generic"),
      );
      return;
    }
    toast.success(t("finance.operations.billPaid"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="space-y-3 rounded-xl bg-bg-subtle p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("finance.operations.billTitlePlaceholder")}
            aria-label={t("finance.operations.billTitle")}
          />
          <div>
            <label htmlFor="finance-bill-due-date" className="sr-only">
              {t("finance.operations.billDueDate")}
            </label>
            <DatePicker
              id="finance-bill-due-date"
              ariaLabel={t("finance.operations.billDueDate")}
              value={dueDate}
              onChange={(next) => next && setDueDate(next)}
            />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={t("finance.operations.billAmountOptional")}
            aria-label={t("finance.operations.billAmount")}
          />
          <select
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value as "none" | "monthly")}
            aria-label={t("finance.operations.recurrence")}
            className="h-11 rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
          >
            <option value="none">{t("finance.operations.once")}</option>
            <option value="monthly">{t("finance.operations.monthly")}</option>
          </select>
        </div>
        <Button type="submit" className="w-full" disabled={creating || !title.trim()}>
          {creating ? t("common.saving") : t("finance.operations.addBill")}
        </Button>
      </form>

      {sorted.length === 0 ? (
        <p className="text-small text-text-secondary">{t("finance.operations.noBills")}</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((bill) => (
            <li key={bill.id} className="rounded-xl border border-border bg-bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-text-primary">{bill.title}</p>
                  <p className="mt-1 text-caption text-text-secondary">
                    {t("finance.operations.due", {
                      date: formatDate(bill.due_date, "medium", locale),
                    })}
                    {bill.recurrence_rule === "monthly"
                      ? " · " + t("finance.operations.monthly")
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-body font-semibold text-brand-800">
                    {bill.amount == null ? "—" : formatTHB(Number(bill.amount), locale)}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {bill.status === "paid"
                      ? t("finance.operations.paid")
                      : t("finance.operations.dueStatus")}
                  </p>
                </div>
              </div>

              {bill.status === "due" ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {bill.amount == null ? (
                    <>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={billAmounts[bill.id] ?? ""}
                        onChange={(event) =>
                          setBillAmounts((current) => ({
                            ...current,
                            [bill.id]: event.target.value,
                          }))
                        }
                        placeholder={t("finance.operations.enterBillAmount")}
                        aria-label={t("finance.operations.billAmountFor", { title: bill.title })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => saveMissingAmount(bill)}
                        disabled={pendingId === bill.id || !billAmounts[bill.id]}
                      >
                        {t("finance.operations.saveAmount")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => pay(bill)}
                      disabled={pendingId === bill.id}
                    >
                      {t("finance.operations.markPaid")}
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
