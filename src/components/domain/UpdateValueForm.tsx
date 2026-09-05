"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateCurrentValue } from "@/core/goals/actions";
import { formatValueWithUnit } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

type Props = {
  goal: { id: string; title: string; current_value: number; target_value: number | null };
  unit: string | null;
  onDone: () => void;
  onCompleted?: () => void;
};

/** metric goal: กรอกยอดรวมล่าสุด (Decision 1.1 "ที่ user กรอกเอง") */
export function UpdateValueForm({ goal, unit, onDone, onCompleted }: Props) {
  const t = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const [value, setValue] = useState<string>(String(goal.current_value));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (value.trim() === "" || Number.isNaN(num)) {
      setError("invalidNumber");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateCurrentValue({ id: goal.id, currentValue: num });
      if (!result.ok) {
        setError(result.fieldErrors?.currentValue?.[0] ?? result.error);
        return;
      }
      if (result.data.completed) {
        toast.success(t("goals.completedToast", { title: goal.title }));
        onCompleted?.();
      } else {
        toast.success(t("goals.valueSavedToast"));
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="current-value">{t("goals.currentValueLabel")}</Label>
        <Input
          id="current-value"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="current-value-hint"
          className="h-14 text-h2"
        />
        <p id="current-value-hint" className="text-small text-text-secondary">
          {goal.target_value !== null
            ? t("progress.ofTarget", {
                current: formatValueWithUnit(Number(value) || 0, unit),
                target: formatValueWithUnit(goal.target_value, unit),
              })
            : t("goals.updateValueDescription")}
        </p>
        {error ? (
          <p role="alert" aria-live="polite" className="text-small text-danger-800">
            {te.has(error as ErrorKey) ? te(error as ErrorKey) : te("generic")}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
