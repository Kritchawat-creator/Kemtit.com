"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { ParentCandidate } from "@/core/goals/schema";
import { createTask, updateTask } from "@/core/tasks/actions";
import { RECURRENCE_OPTIONS, taskFormSchema, type TaskFormValues } from "@/core/tasks/schema";
import { addDaysISO, todayBkk } from "@/lib/date";
import { formatWeekdayShort } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { DatePicker } from "./DatePicker";
import { DomainSelect } from "./DomainSelect";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];
const NO_GOAL = "__none__";
const SUNDAY_ANCHOR = "2026-09-06"; // วันอาทิตย์ ใช้ทำ label ชื่อวัน อา.–ส.

type Props = {
  mode: "create" | "edit";
  taskId?: string;
  initial?: Partial<TaskFormValues>;
  goalOptions: ParentCandidate[];
  onDone: () => void;
};

/** ฟอร์ม task (Design §8.2): ชื่อช่องเดียวก็บันทึกได้ — recurrence รองรับ ทุกวัน/ทุกสัปดาห์ (Q4) */
export function TaskForm({ mode, taskId, initial, goalOptions, onDone }: Props) {
  const t = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      dueDate: todayBkk(),
      domain: "work",
      recurrence: "none",
      weekdays: [],
      goalId: null,
      ...initial,
    },
  });
  const recurrence = form.watch("recurrence");

  function submit(values: TaskFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "create" ? await createTask(values) : await updateTask({ id: taskId, values });
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0] && field in values)
              form.setError(field as keyof TaskFormValues, { message: messages[0] });
          }
        }
        setServerError(result.error === "validation" && result.fieldErrors ? null : result.error);
        return;
      }
      toast.success(mode === "create" ? t("tasks.toasts.created") : t("tasks.toasts.updated"));
      router.refresh();
      onDone();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("tasks.form.title")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("tasks.form.titlePlaceholder")}
                  className="h-12 text-body"
                  {...field}
                />
              </FormControl>
              <FormMessageI18n />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tasks.form.dueDate")}</FormLabel>
                <FormControl>
                  <DatePicker
                    value={field.value}
                    onChange={(next) => next && field.onChange(next)}
                  />
                </FormControl>
                <FormMessageI18n />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="goalId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tasks.form.goal")}</FormLabel>
                <Select
                  value={field.value ?? NO_GOAL}
                  onValueChange={(v) => field.onChange(v === NO_GOAL ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue placeholder={t("tasks.form.noGoal")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_GOAL}>{t("tasks.form.noGoal")}</SelectItem>
                    {goalOptions.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessageI18n />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("tasks.form.domain")}</FormLabel>
              <FormControl>
                <DomainSelect value={field.value} onValueChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="recurrence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("tasks.recurrence.label")}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-2"
                >
                  {RECURRENCE_OPTIONS.map((option) => (
                    <label
                      key={option}
                      htmlFor={`recurrence-${option}`}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-small has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-50 has-[[data-state=checked]]:text-brand-800 md:min-h-9"
                    >
                      <RadioGroupItem
                        id={`recurrence-${option}`}
                        value={option}
                        className="sr-only"
                      />
                      {t(`tasks.recurrence.${option}`)}
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        {recurrence === "weekly" ? (
          <FormField
            control={form.control}
            name="weekdays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tasks.recurrence.weekdaysLabel")}</FormLabel>
                <FormControl>
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    aria-label={t("a11y.weekdays")}
                    value={(field.value ?? []).map(String)}
                    onValueChange={(values) => field.onChange(values.map(Number))}
                    className="flex flex-wrap gap-2"
                  >
                    {Array.from({ length: 7 }, (_, i) => (
                      <ToggleGroupItem
                        key={i}
                        value={String(i)}
                        className="size-11 rounded-full data-[state=on]:bg-brand-500 data-[state=on]:text-neutral-0 md:size-9"
                      >
                        {formatWeekdayShort(addDaysISO(SUNDAY_ANCHOR, i))}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FormControl>
                <FormMessageI18n />
              </FormItem>
            )}
          />
        ) : null}

        {serverError ? (
          <p role="alert" aria-live="polite" className="text-small text-danger-800">
            {te.has(serverError as ErrorKey) ? te(serverError as ErrorKey) : te("generic")}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending
            ? t("common.saving")
            : mode === "create"
              ? t("tasks.form.submitCreate")
              : t("tasks.form.submitEdit")}
        </Button>
      </form>
    </Form>
  );
}
