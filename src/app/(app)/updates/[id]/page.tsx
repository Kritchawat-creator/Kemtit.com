import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getPublishedReleaseNote } from "@/core/releases/queries";
import type { AppLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReleaseNoteAcknowledgeButton } from "@/components/releases/ReleaseNoteAcknowledgeButton";

export default async function UpdateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, t] = await Promise.all([
    params,
    getLocale() as Promise<AppLocale>,
    getTranslations("updates"),
  ]);
  const note = await getPublishedReleaseNote(id);
  if (!note) notFound();

  const title = note.title[locale];
  const categories = [
    { key: "newItems" as const, label: t("categories.new"), items: note.newItems[locale] },
    {
      key: "improvedItems" as const,
      label: t("categories.improved"),
      items: note.improvedItems[locale],
    },
    { key: "fixedItems" as const, label: t("categories.fixed"), items: note.fixedItems[locale] },
  ];

  return (
    <>
      <Link
        href="/updates"
        className="mb-4 inline-flex min-h-10 items-center rounded-md text-small font-medium text-brand-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none"
      >
        {t("backToUpdates")}
      </Link>
      <PageHeader title={title} />
      <div className="mb-5 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-caption text-text-secondary">
        <span className="[overflow-wrap:anywhere] break-words">
          {t("version", { version: note.version })}
        </span>
        <span className="break-all">{t("build", { buildId: note.buildId })}</span>
        <time dateTime={note.publishedAt}>{formatDateTime(note.publishedAt, locale)}</time>
      </div>
      <article
        className="space-y-5 rounded-xl border border-border bg-bg-surface p-4 shadow-xs min-[761px]:p-6"
        data-testid="release-note-detail"
      >
        {categories.map(({ key, label, items }) =>
          items.length > 0 ? (
            <section key={key} aria-label={label}>
              <h2 className="text-h3 font-semibold text-text-primary">{label}</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-small leading-relaxed text-text-secondary">
                {items.map((item, index) => (
                  <li key={`${key}-${index}`} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
        <div className="border-t border-border pt-4">
          <ReleaseNoteAcknowledgeButton
            key={note.id}
            releaseNoteId={note.id}
            initialIsRead={note.isRead}
          />
        </div>
      </article>
    </>
  );
}
