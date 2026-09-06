"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { periodOf, suggestChildPeriods } from "@/core/domain/periods";
import type { ISODate } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import { DomainTag } from "@/components/domain/DomainTag";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { createFirstGoal } from "./actions";
import { firstGoalSchema, type FirstGoalInput } from "./schema";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

type Props = {
  monthOptions: { value: ISODate; label: string }[];
  defaultMonth: ISODate;
  fewDaysLeft: boolean;
};

/**
 * template seller (Design §8.3 + Claude Design 3d): hero card brand-100 "ยอดขาย [เดือน]" + DomainTag งาน
 * ช่องตัวเลขใหญ่ในกล่องขาวขอบ brand-500 + "≈ ต่อสัปดาห์ · N waypoint" → เลือกเดือน → "เริ่มเลย"
 */
export function FirstGoalForm({ monthOptions, defaultMonth, fewDaysLeft }: Props) {
  const t = useTranslations("onboarding.firstGoal");
  const te = useTranslations("errors");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<FirstGoalInput>({
    resolver: zodResolver(firstGoalSchema),
    defaultValues: { targetValue: undefined as unknown as number, monthStart: defaultMonth },
  });
  const targetValue = form.watch("targetValue");
  const monthStart = form.watch("monthStart");
  const weekCount = suggestChildPeriods(periodOf("month", monthStart), "week").length;
  const perWeek =
    typeof targetValue === "number" && targetValue > 0 && weekCount > 0
      ? Math.ceil(targetValue / weekCount)
      : null;

  function submit(values: FirstGoalInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createFirstGoal(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.replace(result.data.next);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
        <div className="space-y-4 rounded-2xl bg-brand-100 p-5 shadow-lg">
          <FormField
            control={form.control}
            name="targetValue"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-3">
                  <FormLabel className="text-h3 text-brand-800">{t("targetLabel")}</FormLabel>
                  <DomainTag domain="work" size="md" />
                </div>
                <div className="flex items-baseline gap-2 rounded-lg border-[1.5px] border-brand-500 bg-bg-surface px-5 py-3 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-500/15">
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step="1"
                      placeholder={t("targetPlaceholder")}
                      className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 py-0 text-display focus-visible:ring-0"
                      value={(field.value as number | undefined) ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                      }
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <span className="text-body text-text-secondary">{t("unit")}</span>
                </div>
                <p className="flex items-center gap-2 text-small text-brand-800">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full border-[1.5px] border-brand-500 bg-bg-surface"
                  />
                  {perWeek !== null
                    ? t("perWeekHint", { amount: formatNumber(perWeek), count: weekCount })
                    : t("perWeekEmpty", { count: weekCount })}
                </p>
                <FormMessageI18n />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="monthStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-body text-text-primary">{t("monthLabel")}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="grid gap-2"
                >
                  {monthOptions.map((option) => (
                    <label
                      key={option.value}
                      htmlFor={`month-${option.value}`}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-transparent bg-bg-surface px-4 py-2 shadow-md has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-50"
                    >
                      <RadioGroupItem id={`month-${option.value}`} value={option.value} />
                      <span className="text-body text-text-primary">{option.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              {fewDaysLeft ? (
                <p className="text-caption text-text-muted">{t("fewDaysLeftHint")}</p>
              ) : null}
              <FormMessageI18n />
            </FormItem>
          )}
        />

        {serverError ? (
          <p role="alert" aria-live="polite" className="text-small text-danger-800">
            {te.has(serverError as ErrorKey) ? te(serverError as ErrorKey) : te("generic")}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </form>
    </Form>
  );
}
