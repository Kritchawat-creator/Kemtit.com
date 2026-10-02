"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Domain } from "@/core/domain/domains";
import { createHabit } from "@/core/habits/actions";
import { DomainSelect } from "@/components/domain/DomainSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GoalOption = { id: string; title: string; domain: Domain };

export function HabitCreateForm({ goalOptions = [] }: { goalOptions?: GoalOption[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<Domain>("health");
  const [targetPerWeek, setTargetPerWeek] = useState("4");
  const [estimatedMinutes, setEstimatedMinutes] = useState("30");
  const [goalId, setGoalId] = useState("");
  const [pending, startTransition] = useTransition();

  const compatibleGoals = goalOptions.filter((goal) => goal.domain === domain);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createHabit({
        title,
        domain,
        cadence: "weekly",
        targetPerWeek: Number(targetPerWeek),
        goalId: goalId || null,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      setTitle("");
      setGoalId("");
      toast.success(t("habits.created"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("habits.placeholder")}
        aria-label={t("habits.title")}
      />

      <div>
        <p className="mb-2 text-caption font-medium text-text-secondary">{t("habits.area")}</p>
        <DomainSelect
          value={domain}
          onValueChange={(next) => {
            setDomain(next);
            setGoalId("");
          }}
          disabled={pending}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-caption font-medium text-text-secondary">
          <span>{t("habits.targetPerWeek")}</span>
          <Input
            type="number"
            min={1}
            max={7}
            value={targetPerWeek}
            onChange={(event) => setTargetPerWeek(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-caption font-medium text-text-secondary">
          <span>{t("habits.estimatedMinutes")}</span>
          <Input
            type="number"
            min={1}
            max={1440}
            step={5}
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(event.target.value)}
          />
        </label>
      </div>

      <label className="block space-y-1 text-caption font-medium text-text-secondary">
        <span>{t("habits.goal")}</span>
        <select
          value={goalId}
          onChange={(event) => setGoalId(event.target.value)}
          className="h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
        >
          <option value="">{t("habits.noGoal")}</option>
          {compatibleGoals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
      </label>

      <Button type="submit" disabled={pending || !title.trim()}>
        {pending ? t("common.saving") : t("habits.add")}
      </Button>
    </form>
  );
}
