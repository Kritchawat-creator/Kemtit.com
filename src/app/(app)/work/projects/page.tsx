import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listParentCandidates } from "@/core/goals/queries";
import { listProjects } from "@/core/projects/queries";
import { getMe } from "@/core/profile/queries";
import { workModeFromProfile } from "@/core/profile/work-modes";
import type { AppLocale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCreateForm } from "@/components/projects/ProjectCreateForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("projects");
  return { title: t("title") };
}

export default async function ProjectsPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  const workMode = workModeFromProfile(me.profile.work_mode, me.profile.active_persona);
  if (workMode === "seller") redirect("/work/sales");

  const [t, td, projects, goalOptions] = await Promise.all([
    getTranslations(),
    getTranslations("domains"),
    listProjects(),
    listParentCandidates(),
  ]);
  const locale = (await getLocale()) as AppLocale;
  return (
    <>
      <PageHeader title={t("projects.title")} description={t("projects.description")} />
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <section className="lg:col-span-5" aria-labelledby="projects-create-heading">
          <h2 id="projects-create-heading" className="sr-only">
            {t("projects.createHeading")}
          </h2>
          <ProjectCreateForm
            goalOptions={goalOptions
              .filter((goal) => goal.domain === "work")
              .map((goal) => ({ id: goal.id, title: goal.title }))}
          />
        </section>
        <section className="lg:col-span-7" aria-labelledby="projects-list-heading">
          <h2 id="projects-list-heading" className="mb-2 text-h2 text-text-primary">
            {t("projects.listHeading", { count: projects.length })}
          </h2>
          {projects.length === 0 ? (
            <p className="rounded-xl border border-border bg-bg-surface p-6 text-small text-text-secondary shadow-xs">
              {t("projects.empty")}
            </p>
          ) : (
            <ul className="space-y-3">
              {projects.map((project) => (
                <li key={project.id} className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-h3 text-text-primary">
                      <Link href={`/work/projects/${project.id}`} className="hover:text-brand-600">
                        {project.title}
                      </Link>
                    </h3>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-caption text-brand-800">
                      {td(
                        project.domain as
                          "work" | "health" | "family" | "finance" | "growth" | "relationships",
                      )}
                    </span>
                  </div>
                  {project.description ? (
                    <p className="mt-2 text-small text-text-secondary">{project.description}</p>
                  ) : null}
                  {project.target_date ? (
                    <p className="mt-3 text-caption text-text-secondary">
                      {t("projects.targetDate", {
                        date: formatDate(project.target_date, "medium", locale),
                      })}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}