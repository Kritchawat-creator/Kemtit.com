"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createProject, updateProject } from "@/core/projects/actions";
import type { ProjectInput } from "@/core/projects/schema";
import { DatePicker } from "@/components/domain/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type GoalOption = { id: string; title: string };
type Props = {
  goalOptions?: GoalOption[];
  mode?: "create" | "edit";
  projectId?: string;
  initial?: Partial<ProjectInput>;
};

export function ProjectCreateForm({
  goalOptions = [],
  mode = "create",
  projectId,
  initial,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [goalId, setGoalId] = useState(initial?.goalId ?? "");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const values = {
        title,
        description: description || null,
        domain: "work",
        goalId: goalId || null,
        targetDate: targetDate || null,
      } as const;
      const result =
        mode === "create"
          ? await createProject(values)
          : await updateProject({ id: projectId, values });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      if (mode === "create") {
        setTitle("");
        setDescription("");
        setTargetDate("");
        setGoalId("");
      }
      toast.success(t(mode === "create" ? "projects.created" : "projects.updated"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-bg-surface p-5 shadow-md" noValidate>
      <div>
        <label
          htmlFor="project-title"
          className="mb-1 block text-caption font-medium text-text-secondary"
        >
          {t("projects.form.title")}
        </label>
        <Input
          id="project-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          placeholder={t("projects.form.titlePlaceholder")}
        />
      </div>

      <div>
        <label
          htmlFor="project-goal"
          className="mb-1 block text-caption font-medium text-text-secondary"
        >
          {t("projects.form.goal")}
        </label>
        <select
          id="project-goal"
          value={goalId}
          onChange={(event) => setGoalId(event.target.value)}
          className="h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
        >
          <option value="">{t("projects.form.noGoal")}</option>
          {goalOptions.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="project-description"
          className="mb-1 block text-caption font-medium text-text-secondary"
        >
          {t("projects.form.description")}
        </label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </div>

      <div>
        <label
          htmlFor="project-target"
          className="mb-1 block text-caption font-medium text-text-secondary"
        >
          {t("projects.form.targetDate")}
        </label>
        <DatePicker
          id="project-target"
          value={targetDate || undefined}
          clearable
          onChange={(next) => setTargetDate(next ?? "")}
        />
      </div>

      <Button type="submit" disabled={pending || !title.trim()}>
        {pending ? t("common.saving") : t(mode === "create" ? "projects.form.submit" : "projects.form.save")}
      </Button>
    </form>
  );
}