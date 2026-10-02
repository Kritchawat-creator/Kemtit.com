"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Domain } from "@/core/domain/domains";
import { createInboxTask } from "@/core/tasks/actions";
import { TASK_PRIORITIES, type TaskPriority } from "@/core/tasks/schema";
import { DomainSelect } from "@/components/domain/DomainSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InboxCapture() {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [domain, setDomain] = useState<Domain>("work");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createInboxTask({ title, priority, domain });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setTitle("");
      toast.success(t("inbox.captured"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="min-w-0">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("inbox.capturePlaceholder")}
          aria-label={t("inbox.captureLabel")}
          className="w-full"
        />
      </div>

      <div className="w-full min-w-0">
        <p className="mb-2 text-caption font-medium text-text-secondary">{t("inbox.area")}</p>
        <DomainSelect value={domain} onValueChange={setDomain} disabled={pending} />
      </div>

      <details className="rounded-lg border border-border bg-bg-subtle">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-caption font-medium text-text-secondary hover:text-brand-600 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none">
          {t("inbox.advancedOptions")}
        </summary>
        <div className="border-t border-border px-3 py-3">
          <label
            htmlFor="inbox-priority"
            className="mb-1 block text-caption font-medium text-text-secondary"
          >
            {t("inbox.priority")}
          </label>
          <select
            id="inbox-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            disabled={pending}
            className="h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
          >
            {TASK_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {t(`inbox.priorities.${value}`)}
              </option>
            ))}
          </select>
        </div>
      </details>

      <Button type="submit" className="w-full sm:w-auto" disabled={pending || !title.trim()}>
        {pending ? t("common.saving") : t("inbox.capture")}
      </Button>
    </form>
  );
}
