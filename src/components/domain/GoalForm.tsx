"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { normalizePeriodStart, periodOf, type PeriodType } from "@/core/domain/periods";
import { createGoal, updateGoal } from "@/core/goals/actions";
import { candidatesFor } from "@/core/goals/candidates";
import { goalFormSchema, type GoalFormValues, type ParentCandidate } from "@/core/goals/schema";
import { todayBkk } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DatePicker } from "./DatePicker";
import { DomainSelect } from "./DomainSelect";
import { PeriodSwitcher } from "./PeriodSwitcher";
import { periodLabelText } from "./PeriodLabel";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];
const NO_PARENT = "__none__";

type Props = {
  mode: "create" | "edit";
  goalId?: string;
  initial?: Partial<GoalFormValues>;
  parentCandidates: ParentCandidate[];
  onDone: () => void;
};

/** ฟอร์มสร้าง/แก้ goal (Design §8.2) — Zod schema เดียวกับ server action */
export function GoalForm({ mode, goalId, initial, parentCandidates, onDone }: Props) {
  const t = useTranslations();
  const te = useTranslations("errors");
  const tp = useTranslations("periods");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      title: "",
      periodType: "month",
      periodStart: normalizePeriodStart("month", todayBkk()),
      domain: "work",
      goalKind: "execution",
      targetValue: undefined,
      unit: "",
      parentId: null,
      ...initial,
    },
  });

  const goalKind = form.watch("goalKind");
  const periodType = form.watch("periodType");
  const periodStart = form.watch("periodStart");
  const parentId = form.watch("parentId");

  const period = useMemo(() => periodOf(periodType, periodStart), [periodType, periodStart]);
  const candidates = useMemo(
    () => candidatesFor(parentCandidates, periodType, period, goalId),
    [parentCandidates, periodType, period, goalId],
  );

  // เมื่อเปลี่ยนช่วงเวลาแล้วเป้าแม่เดิมไม่ทับ → ล้างค่า
  useEffect(() => {
    if (parentId && !candidates.some((c) => c.id === parentId)) form.setValue("parentId", null);
  }, [candidates, parentId, form]);

  function submit(values: GoalFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "create" ? await createGoal(values) : await updateGoal({ id: goalId, values });
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0] && field in values) {
              form.setError(field as keyof GoalFormValues, { message: messages[0] });
            }
          }
        }
        setServerError(result.error === "validation" && result.fieldErrors ? null : result.error);
        return;
      }
      toast.success(mode === "create" ? t("goals.createdToast") : t("goals.updatedToast"));
      router.refresh();
      onDone();
    });
  }

  const translateError = (key: string) => (te.has(key as ErrorKey) ? te(key as ErrorKey) : te("generic"));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("goals.form.title")}</FormLabel>
              <FormControl>
                <Input placeholder={t("goals.form.titlePlaceholder")} className="h-12 text-body" {...field} />
              </FormControl>
              <FormMessageI18n />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="goalKind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("goals.form.kind")}</FormLabel>
              <FormControl>
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 sm:grid-cols-2">
                  {(["metric", "execution"] as const).map((kind) => (
                    <label
                      key={kind}
                      htmlFor={`kind-${kind}`}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-50"
                    >
                      <RadioGroupItem id={`kind-${kind}`} value={kind} className="mt-1" />
                      <span>
                        <span className="block text-body font-medium text-text-primary">{t(`goalKinds.${kind}`)}</span>
                        <span className="block text-caption text-text-secondary">{t(`goalKinds.${kind}Hint`)}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        {goalKind === "metric" ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <FormField
              control={form.control}
              name="targetValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("goals.form.target")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      placeholder={t("goals.form.targetPlaceholder")}
                      className="h-12 text-body"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessageI18n />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("goals.form.unit")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("goals.form.unitPlaceholder")} className="h-12 text-body" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessageI18n />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="periodType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("goals.form.period")}</FormLabel>
              <FormControl>
                <PeriodSwitcher
                  value={field.value}
                  onValueChange={(next: PeriodType) => {
                    field.onChange(next);
                    form.setValue("periodStart", normalizePeriodStart(next, form.getValues("periodStart")));
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="periodStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("goals.form.periodStart")}</FormLabel>
              <FormControl>
                <DatePicker
                  value={field.value}
                  onChange={(next) => next && field.onChange(normalizePeriodStart(periodType, next))}
                />
              </FormControl>
              <FormDescription>
                {periodLabelText(period, tp)} · {t("goals.form.periodHint", { period: tp(periodType) })}
              </FormDescription>
              <FormMessageI18n />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("goals.form.domain")}</FormLabel>
              <FormControl>
                <DomainSelect value={field.value} onValueChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {periodType !== "year" ? (
          <FormField
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("goals.form.parent")}</FormLabel>
                <Select
                  value={field.value ?? NO_PARENT}
                  onValueChange={(v) => field.onChange(v === NO_PARENT ? null : v)}
                  disabled={candidates.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue placeholder={t("goals.form.noParent")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_PARENT}>{t("goals.form.noParent")}</SelectItem>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {candidates.length === 0 ? <FormDescription>{t("goals.form.noParentCandidates")}</FormDescription> : null}
                <FormMessageI18n />
              </FormItem>
            )}
          />
        ) : null}

        {serverError ? (
          <p role="alert" aria-live="polite" className="text-small text-danger-800">
            {translateError(serverError)}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t("common.saving") : mode === "create" ? t("goals.form.submitCreate") : t("goals.form.submitEdit")}
        </Button>
      </form>
    </Form>
  );
}
