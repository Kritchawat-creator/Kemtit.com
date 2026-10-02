import { Inbox as InboxIcon, NotebookPen, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { listNotes } from "@/core/notes/queries";
import { getInboxTasks } from "@/core/tasks/queries";
import { todayBkk } from "@/lib/date";
import { NotesList } from "@/components/inbox/NotesList";
import { PageHeader } from "@/components/layout/PageHeader";
import { InboxCapture } from "@/components/inbox/InboxCapture";
import { InboxList } from "@/components/inbox/InboxList";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("title") };
}

export default async function InboxPage() {
  const today = todayBkk();
  const [t, tasks, notes] = await Promise.all([
    getTranslations(),
    getInboxTasks(),
    listNotes(today),
  ]);

  return (
    <>
      <PageHeader
        title={t("inbox.title")}
        description={t("inbox.description")}
        toolbarEnd={
          <Button asChild>
            <Link href="?capture=1" scroll={false}>
              <Plus aria-hidden="true" />
              {t("inbox.quickCapture")}
            </Link>
          </Button>
        }
      />

      <div className="space-y-6">
        <section
          className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
          aria-labelledby="inbox-capture-heading"
        >
          <div className="mb-3 flex items-center gap-2">
            <InboxIcon className="size-5 text-brand-500" aria-hidden="true" />
            <h2 id="inbox-capture-heading" className="text-h2 text-text-primary">
              {t("inbox.captureHeading")}
            </h2>
          </div>
          <InboxCapture />
        </section>

        <div className="grid min-w-0 items-start gap-4 min-[1151px]:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
          <section
            className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
            aria-labelledby="inbox-list-heading"
          >
            <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <h2 id="inbox-list-heading" className="text-h2 break-words text-text-primary">
                {t("inbox.listHeading", { count: tasks.length })}
              </h2>
              <Link
                href="/today"
                className="text-small font-medium text-brand-600 hover:underline"
              >
                {t("inbox.backToToday")}
              </Link>
            </div>
            <InboxList tasks={tasks} today={today} embedded />
          </section>

          <section
            className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
            aria-labelledby="inbox-notes-heading"
          >
            <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2">
              <NotebookPen className="size-5 shrink-0 text-brand-500" aria-hidden="true" />
              <h2 id="inbox-notes-heading" className="text-h2 text-text-primary">
                {t("inbox.notesTitle")}
              </h2>
              {notes.length > 0 ? (
                <span className="rounded-full bg-brand-50 px-2 py-1 text-caption font-medium text-brand-700">
                  {t("inbox.notesCount", { count: notes.length })}
                </span>
              ) : null}
            </div>
            <NotesList notes={notes} date={today} />
          </section>
        </div>
      </div>
    </>
  );
}
