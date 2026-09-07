"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { addEntry, updateEntry } from "@/core/entries/actions";
import {
  CHANNELS,
  entryFormSchema,
  type EntryFormValues,
  type EntryGoalOption,
} from "@/core/entries/schema";
import { todayBkk } from "@/lib/date";
import { formatValueParts, formatValueWithUnit } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { DatePicker } from "./DatePicker";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];
const NO_CHANNEL = "__none__";
const CHIPS = [500, 1000, 2000];

type Props = {
  mode: "create" | "edit";
  entryId?: string;
  goalOptions: EntryGoalOption[];
  initial?: Partial<EntryFormValues>;
  onDone: () => void;
  /** โหมดแก้ไข: แสดงปุ่มลบ (ผู้เรียกเป็นคนจัดการ undo toast เอง) */
  onDelete?: () => void;
};

/**
 * ฟอร์มบันทึก/แก้ยอด (Claude Design turn 7 D-10): จำนวน · วันที่ · ช่องทาง · รายการ
 * มีเป้าให้เลือกตัวเดียว = ไม่ต้องโชว์ Select (บอกชื่อเป้าเป็นข้อความแทน) · Zod ตัวเดียวกับ server action
 */
export function EntryForm({ mode, entryId, goalOptions, initial, onDone, onDelete }: Props) {
  const t = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaultGoalId = initial?.goalId ?? goalOptions[0]?.id ?? "";
  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: {
      goalId: defaultGoalId,
      entryDate: todayBkk(),
      amount: undefined,
      note: "",
      channel: null,
      ...initial,
    },
  });

  // ไม่ใช้ form.watch (React Compiler memo ไม่ได้) — เก็บเป้าที่เลือกไว้ใน state คู่ขนานกับค่าในฟอร์ม
  const [selectedGoalId, setSelectedGoalId] = useState(defaultGoalId);
  const goal = goalOptions.find((g) => g.id === selectedGoalId) ?? goalOptions[0] ?? null;
  const unitLabel = formatValueParts(0, goal?.unit ?? null).unit;
  const isTHB = goal?.unit === "THB" || goal?.unit === "บาท";

  if (goalOptions.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-body text-text-secondary">{t("entries.form.noMetricGoal")}</p>
        <Button asChild>
          <Link href="?new=goal" scroll={false} onClick={onDone}>
            {t("goals.empty.cta")}
          </Link>
        </Button>
      </div>
    );
  }

  function submit(values: EntryFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await addEntry(values)
          : await updateEntry({
              id: entryId,
              values: {
                entryDate: values.entryDate,
                amount: values.amount,
                note: values.note,
                channel: values.channel,
              },
            });
      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0] && field in values)
              form.setError(field as keyof EntryFormValues, { message: messages[0] });
          }
        }
        setServerError(result.error === "validation" && result.fieldErrors ? null : result.error);
        return;
      }
      toast.success(
        mode === "create"
          ? t("entries.toasts.logged", {
              amount: formatValueWithUnit(values.amount, goal?.unit ?? null),
              total: formatValueWithUnit(result.data.total, goal?.unit ?? null),
            })
          : t("entries.toasts.updated"),
      );
      router.refresh();
      onDone();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
        {goalOptions.length > 1 && mode === "create" ? (
          <FormField
            control={form.control}
            name="goalId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("entries.form.goal")}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setSelectedGoalId(v);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {goalOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessageI18n />
              </FormItem>
            )}
          />
        ) : goal ? (
          <p className="text-small text-text-secondary">
            {t("entries.form.goal")} · <span className="text-text-primary">{goal.title}</span>
          </p>
        ) : null}

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("entries.form.amount")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    placeholder="0"
                    className="h-14 pr-14 text-h2 font-semibold"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                  {unitLabel ? (
                    <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-small font-medium text-text-secondary">
                      {unitLabel}
                    </span>
                  ) : null}
                </div>
              </FormControl>
              {isTHB ? (
                <div className="flex gap-1.5 pt-1">
                  {CHIPS.map((chip) => (
                    <Button
                      key={chip}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 px-0 text-small"
                      onClick={() => field.onChange((Number(field.value) || 0) + chip)}
                    >
                      +{formatValueParts(chip, null).value}
                    </Button>
                  ))}
                </div>
              ) : null}
              <FormMessageI18n />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="entryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("entries.form.date")}</FormLabel>
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
            name="channel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("entries.form.channel")}</FormLabel>
                <Select
                  value={field.value ?? NO_CHANNEL}
                  onValueChange={(v) => field.onChange(v === NO_CHANNEL ? null : v)}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue placeholder={t("entries.form.noChannel")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_CHANNEL}>{t("entries.form.noChannel")}</SelectItem>
                    {CHANNELS.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {t(`entries.channels.${channel}`)}
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
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("entries.form.note")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("entries.form.notePlaceholder")}
                  className="h-12 text-body"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessageI18n />
            </FormItem>
          )}
        />

        {serverError ? (
          <p role="alert" aria-live="polite" className="text-small text-danger-800">
            {te.has(serverError as ErrorKey) ? te(serverError as ErrorKey) : te("generic")}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={pending}>
            {pending
              ? t("common.saving")
              : mode === "create"
                ? t("entries.form.submitCreate")
                : t("entries.form.submitEdit")}
          </Button>
          {mode === "edit" && onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="text-danger-800 hover:bg-danger-50 hover:text-danger-800"
              onClick={onDelete}
            >
              <Trash2 aria-hidden="true" />
              {t("entries.delete")}
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
