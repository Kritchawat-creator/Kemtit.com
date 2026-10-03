"use client";

import { Plus } from "@/components/icons/ui-icons";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { createTask } from "@/core/tasks/actions";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";

type Props = { today: ISODate; className?: string; defaultDomain?: Domain | null };

/**
 * Quick inline task capture for Today. The area is explicit so Work/Life tasks
 * cannot silently fall into the Work domain.
 */
export function QuickTaskInput({ today, className, defaultDomain = "work" }: Props) {
  const t = useTranslations();
  const td = useTranslations("domains");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<Domain | "">(defaultDomain ?? "");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !domain) return;
    startTransition(async () => {
      const result = await createTask({
        title: trimmed,
        dueDate: today,
        domain,
        recurrence: "none",
        weekdays: [],
        goalId: null,
        projectId: null,
        priority: "normal",
        estimatedMinutes: null,
        notes: null,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("tasks.toasts.created"));
      setTitle("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className={cn("@container/capture mt-4 min-w-0 border-t border-border pt-3", className)}
      noValidate
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 @[30rem]/capture:grid-cols-[minmax(0,1fr)_minmax(0,8rem)_auto]">
        <div className="col-span-2 flex min-w-0 items-center gap-2 @[30rem]/capture:col-span-1">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-brand-200 text-brand-600"
          >
            <Plus className="size-3" strokeWidth={1.5} />
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={t("widgets.todayTasks.add")}
            placeholder={t("widgets.todayTasks.quickPlaceholder")}
            className="h-11 min-w-0 flex-1 rounded-sm bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted focus-visible:ring-[3px] focus-visible:ring-brand-500/15"
          />
        </div>

        <select
          value={domain}
          onChange={(event) => setDomain(event.target.value as Domain)}
          aria-label={t("tasks.form.domain")}
          disabled={pending}
          className="h-11 w-full min-w-0 max-w-full rounded-sm border border-border bg-bg-surface px-2.5 text-small text-text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/15"
        >
          <option value="" disabled>
            {t("tasks.form.pickDomain")}
          </option>
          {DOMAINS.map((value) => (
            <option key={value} value={value}>
              {td(value)}
            </option>
          ))}
        </select>

        <Button
          type="submit"
          size="sm"
          className="min-h-11"
          disabled={pending || !title.trim() || !domain}
        >
          {pending ? t("common.saving") : t("widgets.todayTasks.add")}
        </Button>
      </div>
    </form>
  );
}
