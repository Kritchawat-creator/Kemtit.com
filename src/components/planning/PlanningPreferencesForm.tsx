"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { savePlanningPreferences } from "@/core/planning/actions";
import type { PlanningPreferences } from "@/core/planning/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PlanningPreferencesForm({ initial }: { initial: PlanningPreferences }) {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const router = useRouter();
  const [start, setStart] = useState(initial.workingWindows[0]?.start ?? "09:00");
  const [end, setEnd] = useState(initial.workingWindows[0]?.end ?? "17:00");
  const [breakStart, setBreakStart] = useState(initial.breakWindows[0]?.start ?? "");
  const [breakEnd, setBreakEnd] = useState(initial.breakWindows[0]?.end ?? "");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await savePlanningPreferences({
        timezone: initial.timezone,
        workingWindows: [{ start, end }],
        breakWindows: breakStart && breakEnd ? [{ start: breakStart, end: breakEnd }] : [],
      });
      if (!result.ok) {
        toast.error(result.error === "invalidTime" ? te("invalidTime") : te("generic"));
        return;
      }
      toast.success(t("planning.saved"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-caption text-text-secondary">{t("planning.timezone", { timezone: initial.timezone === "Asia/Bangkok" ? t("language.timezoneBangkok") : initial.timezone })}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-small text-text-secondary">
          {t("planning.workStart")}
          <Input className="mt-1" type="time" value={start} onChange={(event) => setStart(event.target.value)} required />
        </label>
        <label className="text-small text-text-secondary">
          {t("planning.workEnd")}
          <Input className="mt-1" type="time" value={end} onChange={(event) => setEnd(event.target.value)} required />
        </label>
        <label className="text-small text-text-secondary">
          {t("planning.breakStart")}
          <Input className="mt-1" type="time" value={breakStart} onChange={(event) => setBreakStart(event.target.value)} />
        </label>
        <label className="text-small text-text-secondary">
          {t("planning.breakEnd")}
          <Input className="mt-1" type="time" value={breakEnd} onChange={(event) => setBreakEnd(event.target.value)} />
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t("planning.saving") : t("planning.save")}
      </Button>
    </form>
  );
}