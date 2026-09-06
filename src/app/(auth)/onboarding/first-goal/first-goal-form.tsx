"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import type { ISODate } from "@/lib/date";
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

/** template seller: "ยอดขายเดือนนี้ [____] บาท" แก้แค่ตัวเลข → กด "เริ่มเลย" (Design §8.3) */
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
      <form onSubmit={form.handleSubmit(submit)} className="space-y-6" noValidate>
        <FormField
          control={form.control}
          name="targetValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-body">{t("targetLabel")}</FormLabel>
              <div className="flex items-center gap-3">
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step="1"
                    placeholder={t("targetPlaceholder")}
                    className="h-14 flex-1 text-h2"
                    value={(field.value as number | undefined) ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <span className="text-h3 text-text-secondary">{t("unit")}</span>
              </div>
              <FormMessageI18n />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="monthStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-body">{t("monthLabel")}</FormLabel>
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
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-bg-surface p-3 has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-50"
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
