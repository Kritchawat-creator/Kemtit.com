import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { listParentCandidates } from "@/core/goals/queries";
import { listProjectOptions } from "@/core/projects/actions";
import { QueryError } from "@/core/shared/query-error";
import { getTaskLibrary, type TaskLibraryView } from "@/core/tasks/queries";
import { todayBkk } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskLibrary } from "@/components/tasks/TaskLibrary";

const TASK_VIEWS = ["planned", "all", "done", "overdue"] as const;

function firstSearchValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function isTaskLibraryView(value: string): value is TaskLibraryView {
  return (TASK_VIEWS as readonly string[]).includes(value);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tasks");
  return { title: t("title") };
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const params = await searchParams;
  const viewValue = firstSearchValue(params.view);
  const view: TaskLibraryView = isTaskLibraryView(viewValue) ? viewValue : "planned";
  const search = firstSearchValue(params.q).slice(0, 100);
  const today = todayBkk();
  const [t, result, goalOptions, projectResult] = await Promise.all([
    getTranslations(),
    getTaskLibrary({ view, search, today }),
    listParentCandidates(),
    listProjectOptions(),
  ]);

  if (!projectResult.ok) throw new QueryError("tasks.listProjectOptions");

  return (
    <>
      <PageHeader title={t("tasks.title")} description={t("tasks.library.description")} />

      <div className="mb-4">
        <Button asChild className="w-full sm:w-auto">
          <Link href="/tasks?new=task">{t("tasks.new")}</Link>
        </Button>
      </div>

      <form
        action="/tasks"
        method="get"
        className="mb-5 grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border bg-bg-surface p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] sm:items-end"
      >
        <label className="block min-w-0">
          <span className="mb-1 block text-caption font-medium text-text-secondary">
            {t("tasks.library.searchLabel")}
          </span>
          <Input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={t("tasks.library.searchPlaceholder")}
            className="w-full"
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block text-caption font-medium text-text-secondary">
            {t("tasks.library.viewLabel")}
          </span>
          <select
            name="view"
            defaultValue={view}
            className="h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus-visible:border-brand-500 focus-visible:ring-[3px] focus-visible:ring-brand-500/10"
          >
            {TASK_VIEWS.map((option) => (
              <option key={option} value={option}>
                {t(`tasks.library.views.${option}`)}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" className="w-full sm:w-auto">
          {t("nav.search")}
        </Button>
      </form>

      <TaskLibrary
        tasks={result.tasks}
        today={today}
        view={view}
        hasMore={result.hasMore}
        goalOptions={goalOptions}
        projectOptions={projectResult.data}
      />
    </>
  );
}
