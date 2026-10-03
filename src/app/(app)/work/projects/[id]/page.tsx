import { ChevronLeft, Plus } from "@/components/icons/ui-icons";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { listParentCandidates } from "@/core/goals/queries";
import { getMe } from "@/core/profile/queries";
import { workModeFromProfile } from "@/core/profile/work-modes";
import { getProjectDetail } from "@/core/projects/queries";
import type { AppLocale } from "@/i18n/config";
import { todayBkk } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/domain/EmptyState";
import { TaskList } from "@/components/domain/TaskList";
import { ProjectArchiveButton } from "@/components/projects/ProjectArchiveButton";
import { ProjectCreateForm } from "@/components/projects/ProjectCreateForm";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: PageProps<"/work/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getProjectDetail(id);
  return { title: detail?.project.title ?? (await getTranslations("projects"))("notFound") };
}

export default async function ProjectDetailPage({ params }: PageProps<"/work/projects/[id]">) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (workModeFromProfile(me.profile.work_mode, me.profile.active_persona) === "seller") {
    redirect("/work/sales");
  }

  const { id } = await params;
  const [detail, goalOptions, t, td] = await Promise.all([
    getProjectDetail(id),
    listParentCandidates(),
    getTranslations(),
    getTranslations("domains"),
  ]);
  if (!detail) notFound();
  const locale = (await getLocale()) as AppLocale;

  const { project, tasks, progress, plannedMinutes } = detail;
  const hasTasks = tasks.length > 0;
  const progressPercent = progress.total
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;
  const goalChoices = goalOptions
    .filter((goal) => goal.domain === "work")
    .map((goal) => ({ id: goal.id, title: goal.title }));

  return (
    <>
      <PageHeader
        title={project.title}
        titleId="project-title"
        toolbarStart={
          <Button variant="outline" asChild>
            <Link href="/work/projects">
              <ChevronLeft aria-hidden="true" />
              {t("projects.backToList")}
            </Link>
          </Button>
        }
        toolbarEnd={<ProjectArchiveButton projectId={project.id} />}
      />

      <div className={hasTasks ? "grid gap-4 lg:grid-cols-12 lg:gap-6" : "grid gap-4"}>
        <aside className={hasTasks ? "space-y-4 lg:col-span-4" : "space-y-4"}>
          <section
            className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs"
            aria-labelledby="project-summary"
          >
            <h2 id="project-summary" className="text-h2 text-text-primary">
              {t("projects.summary")}
            </h2>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-caption text-text-secondary">{t("projects.progress")}</p>
                <p className="text-h2 text-text-primary">
                  {progress.completed}/{progress.total} · {progressPercent}%
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-caption text-text-secondary">{t("projects.plannedWorkload")}</p>
                <p className="text-body text-text-primary">{formatMinutes(plannedMinutes, locale)}</p>
              </div>
              {project.target_date ? (
                <div>
                  <p className="text-caption text-text-secondary">
                    {t("projects.targetDateLabel")}
                  </p>
                  <p className="text-body text-text-primary">
                    {formatDate(project.target_date, "medium", locale)}
                  </p>
                </div>
              ) : null}
              <p className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-caption text-brand-800">
                {td(
                  project.domain as
                    "work" | "health" | "family" | "finance" | "growth" | "relationships",
                )}
              </p>
            </div>
          </section>

          <ProjectCreateForm
            mode="edit"
            projectId={project.id}
            goalOptions={goalChoices}
            initial={{
              title: project.title,
              description: project.description,
              domain: project.domain as "work",
              goalId: project.goal_id,
              targetDate: project.target_date,
            }}
          />
        </aside>

        <section
          className={hasTasks ? "space-y-3 lg:col-span-8" : "space-y-3"}
          aria-labelledby="project-tasks-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="project-tasks-heading" className="text-h2 text-text-primary">
              {t("projects.tasks")}
            </h2>
            <Button variant="outline" size="sm" asChild>
              <Link href={`?new=task&project=${project.id}`} scroll={false}>
                <Plus aria-hidden="true" />
                {t("projects.addTask")}
              </Link>
            </Button>
          </div>
          <TaskList
            items={tasks}
            today={todayBkk()}
            goalOptions={goalOptions}
            showGoal
            emptyState={
              <EmptyState
                title={t("projects.emptyTasks")}
                description={t("projects.emptyTasksDescription")}
                action={
                  <Button asChild>
                    <Link href={`?new=task&project=${project.id}`} scroll={false}>
                      {t("projects.addTask")}
                    </Link>
                  </Button>
                }
              />
            }
          />
        </section>
      </div>
    </>
  );
}

function formatMinutes(minutes: number, locale: AppLocale) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (locale === "en") {
    if (hours === 0) return `${rest} min`;
    if (rest === 0) return `${hours} h`;
    return `${hours} h ${rest} min`;
  }

  if (hours === 0) return `${rest} นาที`;
  if (rest === 0) return `${hours} ชม.`;
  return `${hours} ชม. ${rest} นาที`;
}
