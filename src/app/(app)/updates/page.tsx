import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { listPublishedReleaseNotes } from "@/core/releases/queries";
import type { AppLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function UpdatesPage() {
  const [locale, t, notes] = await Promise.all([
    getLocale() as Promise<AppLocale>,
    getTranslations("updates"),
    listPublishedReleaseNotes(),
  ]);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      {notes.length === 0 ? (
        <p className="rounded-xl border border-border bg-bg-surface p-5 text-small text-text-secondary">
          {t("empty")}
        </p>
      ) : (
        <ol className="space-y-3" data-testid="updates-list">
          {notes.map((note, index) => (
            <li key={note.id} data-testid={`release-note-${note.id}`}>
              <Link
                href={`/updates/${note.id}`}
                className="block rounded-xl border border-border bg-bg-surface p-4 shadow-xs transition-colors hover:border-border-strong hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 text-h3 font-semibold [overflow-wrap:anywhere] break-words text-text-primary">
                    {note.title[locale]}
                  </h2>
                  {index === 0 && !note.isRead ? (
                    <span
                      data-testid="updates-unread-marker"
                      className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-caption font-semibold text-brand-700"
                    >
                      {t("new")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-caption text-text-secondary">
                  <span className="[overflow-wrap:anywhere] break-words">
                    {t("version", { version: note.version })}
                  </span>
                  <span className="break-all">{t("build", { buildId: note.buildId })}</span>
                  <time className="break-words" dateTime={note.publishedAt}>
                    {formatDateTime(note.publishedAt, locale)}
                  </time>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
