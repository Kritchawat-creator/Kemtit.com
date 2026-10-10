import Link from "next/link";
import { useTranslations } from "next-intl";

import { STARTER_PACK_IDS } from "@/core/goals/starter-packs";
import { starterPackDomain } from "@/core/goals/starter-packs";
import { Button } from "@/components/ui/button";

export function StarterPackPreview() {
  const t = useTranslations("goals.wizard.starter");
  const td = useTranslations("domains");

  return (
    <section
      className="rounded-xl border border-border bg-bg-surface p-5 shadow-xs"
      aria-label={t("title")}
    >
      <details>
        <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none">
          <span className="text-caption font-semibold tracking-wide text-brand-700 uppercase">
            {t("optionalLabel")}
          </span>
          <span className="text-h2 text-text-primary">{t("title")}</span>
        </summary>
        <p className="mt-2 max-w-2xl text-small text-text-secondary">{t("description")}</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {STARTER_PACK_IDS.map((pack) => (
            <article
              key={pack}
              className="flex flex-col rounded-xl border border-border bg-bg-subtle p-4"
            >
              <h3 className="text-h3 text-text-primary">{t(`packs.${pack}.title`)}</h3>
              <p className="mt-1 text-caption text-text-secondary">
                {t(`packs.${pack}.description`)}
              </p>
              <div className="mt-3 space-y-2 rounded-lg bg-bg-surface p-3 text-caption">
                <p>
                  <span className="font-semibold text-text-secondary">{t("goalPreview")}: </span>
                  <span className="text-text-primary">{t(`packs.${pack}.goal`)}</span>
                </p>
                <p>
                  <span className="font-semibold text-text-secondary">
                    {t("firstStepPreview")}:
                  </span>
                  <span className="text-text-primary">{t(`packs.${pack}.task`)}</span>
                </p>
                <p>
                  <span className="font-semibold text-text-secondary">{t("domainPreview")}: </span>
                  <span className="text-text-primary">{td(starterPackDomain(pack))}</span>
                </p>
              </div>
              <p className="mt-3 text-caption text-text-secondary">{t("notSaved")}</p>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href={`/goals?wizard=goal&starter=${pack}`}>{t("choose")}</Link>
              </Button>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
