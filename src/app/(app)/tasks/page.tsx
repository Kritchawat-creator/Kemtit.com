import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { listParentCandidates } from "@/core/goals/queries";
import { listProjectOptions } from "@/core/projects/actions";
import { QueryError } from "@/core/shared/query-error";
import { getTaskCardData } from "@/core/tasks/card-queries";
import { getTaskLibrary, type TaskLibraryView } from "@/core/tasks/queries";
import { getMe } from "@/core/profile/queries";
import { ROUTES } from "@/core/profile/onboarding";
import { todayBkk } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskLibrary } from "@/components/tasks/TaskLibrary";
import { TaskCardBoard } from "@/components/tasks/TaskCardBoard";

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
  const me = await getMe();
  if (!me) redirect(ROUTES.login);
  const params = await searchParams;
  const viewValue = firstSearchValue(params.view);
  const view: TaskLibraryView = isTaskLibraryView(viewValue) ? viewValue : "planned";
  const cardMode = firstSearchValue(params.mode) === "cards";
  const search = firstSearchValue(params.q).slice(0, 100);
  const today = todayBkk();
  const [t, result, goalOptions, projectResult] = await Promise.all([
    getTranslations(),
    getTaskLibrary({ view, search, today }),
    listParentCandidates(),
    listProjectOptions(),
  ]);

  if (!projectResult.ok) throw new QueryError("tasks.listProjectOptions");
  const cards = cardMode ? await getTaskCardData(result.tasks) : null;
  const cardHref = `/tasks?${new URLSearchParams({ mode: "cards", view, ...(search ? { q: search } : {}) })}`;
  const listHref = `/tasks?${new URLSearchParams({ view, ...(search ? { q: search } : {}) })}`;

  return (
    <>
      <PageHeader title={t("tasks.title")} description={t("tasks.library.description")} />

      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={cardMode ? "default" : "outline"}>
            <Link href={cardHref}>{t("taskCards.title")}</Link>
          </Button>
          <Button asChild variant={cardMode ? "outline" : "default"}>
            <Link href={listHref}>{t("tasks.title")}</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href={cardMode ? "/tasks?mode=cards&new=task" : "/tasks?new=task"}>{t("tasks.new")}</Link>
          </Button>
        </div>
      </div>

      <form
        action="/tasks"
        method="get"
        className="mb-5 grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border bg-bg-surface p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] sm:items-end"
      >
        {cardMode ? <input type="hidden" name="mode" value="cards" /> : null}
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

      {cards ? (
        <TaskCardBoard
          userId={me.userId}
          tasks={cards.tasks}
          groups={cards.groups}
          groupMembers={cards.groupMembers}
          pendingPhotos={cards.pendingPhotos}
          today={today}
          goalOptions={goalOptions}
          projectOptions={projectResult.data}
        />
      ) : (
        <TaskLibrary
          tasks={result.tasks}
          today={today}
          view={view}
          hasMore={result.hasMore}
          goalOptions={goalOptions}
          projectOptions={projectResult.data}
        />
      )}
    </>
  );
}
