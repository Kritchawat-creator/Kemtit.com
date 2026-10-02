import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { listArchivedNotes } from "@/core/notes/queries";
import { listArchivedProjects } from "@/core/projects/queries";
import { listArchivedTasks } from "@/core/tasks/queries";
import { listArchivedGoals } from "@/core/goals/queries";
import { getMe } from "@/core/profile/queries";
import { ArchiveList } from "@/components/archive/ArchiveList";
import { PageHeader } from "@/components/layout/PageHeader";

const ARCHIVE_PAGE_SIZE = 50;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("archive");
  return { title: t("title") };
}

function parsePageIndex(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d{1,6}$/.test(value)) return 0;
  const pageIndex = Number(value);
  return Number.isSafeInteger(pageIndex) ? pageIndex : 0;
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await getMe();
  if (!me) redirect("/login");

  const { page } = await searchParams;
  const pageIndex = parsePageIndex(page);
  const [t, archivedTasks, archivedProjects, archivedNotes, archivedGoals] = await Promise.all([
    getTranslations("archive"),
    listArchivedTasks(pageIndex, ARCHIVE_PAGE_SIZE),
    listArchivedProjects(pageIndex, ARCHIVE_PAGE_SIZE),
    listArchivedNotes(pageIndex, ARCHIVE_PAGE_SIZE),
    listArchivedGoals(pageIndex, ARCHIVE_PAGE_SIZE),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ArchiveList
        tasks={archivedTasks.items}
        projects={archivedProjects.items}
        notes={archivedNotes.items}
        goals={archivedGoals.items}
        pageIndex={pageIndex}
        tasksHaveMore={archivedTasks.hasMore}
        projectsHaveMore={archivedProjects.hasMore}
        notesHaveMore={archivedNotes.hasMore}
        goalsHaveMore={archivedGoals.hasMore}
      />
    </>
  );
}
