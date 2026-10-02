"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import type { ParentCandidate } from "@/core/goals/schema";
import { createTask, updateTask } from "@/core/tasks/actions";
import { RECURRENCE_OPTIONS, TASK_PRIORITIES, taskFormSchema, type TaskFormValues } from "@/core/tasks/schema";
import { addDaysISO, todayBkk } from "@/lib/date";
import { UPLOADS_ENABLED } from "@/lib/flags";
import type { AppLocale } from "@/i18n/config";
import { formatWeekdayShort } from "@/lib/format";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PendingPhotoPicker } from "./TaskPhotos";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];
const NO_GOAL = "__none__";
const NO_PROJECT = "__none_project__";
const SUNDAY_ANCHOR = "2026-09-06"; // วันอาทิตย์ ใช้ทำ label ชื่อวัน อา.–ส.

type Props = {
  mode: "create" | "edit";
  taskId?: string;
  initial?: Partial<TaskFormValues>;
  goalOptions: ParentCandidate[];
  projectOptions?: { id: string; title: string }[];
  /** จำนวนรูปที่งานมีอยู่แล้ว (โหมดแก้ไข) — ใช้คุมเพดาน 5 รูป/งาน */
  existingPhotoCount?: number;
  onDone: () => void;
};

/** ฟอร์ม task (Design §8.2): ชื่อช่องเดียวก็บันทึกได้ — recurrence รองรับ ทุกวัน/ทุกสัปดาห์ (Q4) */
export function TaskForm({
  mode,
  taskId,
  initial,
  goalOptions,
  projectOptions = [],
  existingPhotoCount = 0,
  onDone,
}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const te = useTranslations("errors");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const { upload: uploadPhoto } = usePhotoUpload();

  const form = useForm<z.input<typeof taskFormSchema>, undefined, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      dueDate: initial?.dueDate ?? todayBkk(),
      plannedDate: initial?.plannedDate ?? initial?.dueDate ?? todayBkk(),
      deadline: null,
      domain: "work",
      recurrence: "none",
      weekdays: [],
      goalId: null,
      projectId: null,
      priority: "normal",
      estimatedMinutes: null,
      notes: null,
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
      // รูปที่เลือกไว้อัปโหลดหลังบันทึกงานสำเร็จ (Design §6A.3 ข้อ 4: ไม่บล็อกการบันทึก) — ทีละรูป กันแตะเพดาน 5 รูป/งาน
      for (const file of pendingPhotos) {
        await uploadPhoto(file, { kind: "taskPhoto", targetId: result.data.id }, { silent: true });
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
            name="plannedDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tasks.form.plannedDate")}</FormLabel>
                <FormControl>
                  <DatePicker
                    ariaLabel={t("tasks.form.plannedDate")}
                    value={field.value ?? todayBkk()}
                    onChange={(next) => {
                      if (!next) return;
                      field.onChange(next);
                      form.setValue("dueDate", next, { shouldDirty: true });
                    }}
                  />
                </FormControl>
                <FormMessageI18n />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="deadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tasks.form.deadline")}</FormLabel>
                <FormControl>
                  <DatePicker
                    ariaLabel={t("tasks.form.deadline")}
                    value={field.value ?? undefined}
                    clearable
                    onChange={(next) => field.onChange(next ?? null)}
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

        {projectOptions.length > 0 ? (
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tasks.form.project")}</FormLabel>
                <Select
                  value={field.value ?? NO_PROJECT}
                  onValueChange={(value) => field.onChange(value === NO_PROJECT ? null : value)}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue placeholder={t("tasks.form.noProject")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>{t("tasks.form.noProject")}</SelectItem>
                    {projectOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessageI18n />
              </FormItem>
            )}
          />
        ) : null}

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

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tasks.form.priority")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TASK_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {t(`inbox.priorities.${priority}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessageI18n />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estimatedMinutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tasks.form.estimatedMinutes")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    step={5}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(event.target.value === "" ? null : Number(event.target.value))
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessageI18n />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("tasks.form.notes")}</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(event.target.value || null)}
                  placeholder={t("tasks.form.notesPlaceholder")}
                  rows={3}
                />
              </FormControl>
              <FormMessageI18n />
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
                        {formatWeekdayShort(addDaysISO(SUNDAY_ANCHOR, i), locale)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FormControl>
                <FormMessageI18n />
              </FormItem>
            )}
          />
        ) : null}

        {UPLOADS_ENABLED ? (
          <PendingPhotoPicker
            files={pendingPhotos}
            onChange={setPendingPhotos}
            existingCount={existingPhotoCount}
            disabled={pending}
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
