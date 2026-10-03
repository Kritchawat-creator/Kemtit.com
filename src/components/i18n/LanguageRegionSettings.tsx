"use client";

import { CalendarDays, Clock3 } from "@/components/icons/ui-icons";
import { useLocale, useTranslations } from "next-intl";

import { APP_TIME_ZONE, type AppLocale } from "@/i18n/config";

import { LanguageSwitcher } from "./LanguageSwitcher";

export function LanguageRegionSettings() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("settings.language");

  return (
    <div className="space-y-4">
      <LanguageSwitcher />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-bg-subtle p-3">
          <div className="flex items-center gap-2 text-caption font-medium text-text-secondary">
            <CalendarDays className="size-4" aria-hidden="true" />
            {t("calendarTitle")}
          </div>
          <p className="mt-1 text-small font-medium text-text-primary">
            {locale === "th" ? t("calendarThai") : t("calendarEnglish")}
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            {locale === "th" ? t("previewThai") : t("previewEnglish")}
          </p>
        </div>

        <div className="rounded-lg bg-bg-subtle p-3">
          <div className="flex items-center gap-2 text-caption font-medium text-text-secondary">
            <Clock3 className="size-4" aria-hidden="true" />
            {t("timezoneTitle")}
          </div>
          <p className="mt-1 text-small font-medium text-text-primary">
            {t("timezoneBangkok")}
          </p>
          <p className="mt-1 text-caption text-text-secondary">{APP_TIME_ZONE}</p>
        </div>
      </div>
    </div>
  );
}
