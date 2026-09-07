"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { addEntry } from "@/core/entries/actions";
import { todayBkk } from "@/lib/date";
import { formatThaiDate, formatValueParts, formatValueWithUnit } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Celebration } from "./Celebration";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

type Props = {
  goal: { id: string; title: string; unit: string | null };
  /** compact = ช่องเดียว+ปุ่ม (การ์ดเข็มทิศบน dashboard) · card = การ์ดขาวเต็ม (goal detail) */
  layout?: "compact" | "card";
  className?: string;
};

const CHIPS = [500, 1000, 2000];

/** เฉพาะตัวเลข — ช่องนี้รับยอดเป็นจำนวนเต็มบวกเท่านั้น */
function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/**
 * ช่อง "บันทึกยอดวันนี้" (Claude Design turn 6 ①): พิมพ์ตัวเลขหรือกดชิป +500/+1,000/+2,000 แล้ว Enter
 * → เข็มทิศ กราฟ และตัวเลขทั้งหน้าขยับทันที (router.refresh) + toast ยืนยัน
 */
export function QuickEntryForm({ goal, layout = "compact", className }: Props) {
  const t = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fireKey, setFireKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const isTHB = goal.unit === "THB" || goal.unit === "บาท";
  const unitLabel = formatValueParts(0, goal.unit).unit;
  const inputId = `quick-entry-${goal.id}`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(value);
    if (!value.trim() || Number.isNaN(amount) || amount <= 0) {
      setError("positive");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addEntry({
        goalId: goal.id,
        entryDate: todayBkk(),
        amount,
      });
      if (!result.ok) {
        setError(result.fieldErrors?.amount?.[0] ?? result.error);
        return;
      }
      toast.success(
        t("entries.toasts.logged", {
          amount: formatValueWithUnit(amount, goal.unit),
          total: formatValueWithUnit(result.data.total, goal.unit),
        }),
      );
      if (result.data.completed) {
        toast.success(t("goals.completedToast", { title: goal.title }));
        setFireKey((k) => k + 1);
      }
      setValue("");
      router.refresh();
    });
  }

  const errorNode = error ? (
    <p role="alert" aria-live="polite" className="text-caption text-danger-800">
      {te.has(error as ErrorKey) ? te(error as ErrorKey) : te("generic")}
    </p>
  ) : null;

  if (layout === "compact") {
    return (
      <form onSubmit={submit} className={cn("mt-auto flex flex-col gap-1.5", className)} noValidate>
        <div className="flex gap-1.5">
          <Input
            id={inputId}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(digitsOnly(e.target.value))}
            aria-label={t("entries.quick.amountLabel")}
            aria-invalid={error ? true : undefined}
            placeholder={
              isTHB ? t("entries.quick.placeholder") : t("entries.quick.placeholderGeneric")
            }
            className="h-11 flex-1 rounded-sm text-base font-semibold"
          />
          <Button type="submit" size="sm" className="h-11 shrink-0" disabled={pending}>
            <Plus aria-hidden="true" />
            {pending ? t("common.saving") : t("entries.quick.button")}
          </Button>
        </div>
        {errorNode}
        <Celebration fireKey={fireKey} />
      </form>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={cn("flex flex-col gap-2.5 rounded-xl bg-bg-surface p-5 shadow-md", className)}
      noValidate
    >
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-base font-medium text-brand-800">
          {t("entries.quick.title")}
        </label>
        <span className="shrink-0 text-small text-text-secondary">
          {formatThaiDate(todayBkk(), "weekday")}
        </span>
      </div>

      <div className="relative">
        <Input
          id={inputId}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(digitsOnly(e.target.value))}
          aria-invalid={error ? true : undefined}
          placeholder="0"
          className="h-12 pr-14 text-h2 font-semibold"
        />
        {unitLabel ? (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-small font-medium text-text-secondary">
            {unitLabel}
          </span>
        ) : null}
      </div>

      {isTHB ? (
        <div className="flex gap-1.5">
          {CHIPS.map((chip) => (
            <Button
              key={chip}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 flex-1 px-0 text-small"
              onClick={() => setValue(String((Number(value) || 0) + chip))}
            >
              +{formatValueParts(chip, null).value}
            </Button>
          ))}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <Plus aria-hidden="true" />
        {pending ? t("common.saving") : t("entries.quick.button")}
      </Button>
      {errorNode}
      <p className="text-center text-caption text-text-secondary">{t("entries.quick.hint")}</p>
      <Celebration fireKey={fireKey} />
    </form>
  );
}
