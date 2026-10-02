"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "cn";

import { setAppLocale } from "@/i18n/actions";
import { APP_LOCALES, type AppLocale } from "@/i18n/config";

type Props = {
  compact?: boolean;
  className?: string;
};

export function LanguageSwitcher({ compact = false, className }: Props) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("settings.language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeLocale(next: AppLocale) {
    if (next === locale || pending) return;

    startTransition(async () => {
      await setAppLocale(next);
      router.refresh();
    });
  }

  return (
    <div className={cn("min-w-0", className)}>
      {!compact ? (
        <div className="mb-2 flex items-center gap-2 text-small font-medium text-text-secondary">
          <Languages className="size-4" aria-hidden="true" />
          <span>{t("label")}</span>
        </div>
      ) : null}

      <div
        className={cn(
          "grid min-w-0 grid-cols-2 gap-1 rounded-lg bg-bg-subtle p-1",
          compact ? "w-full" : "max-w-sm",
        )}
        role="group"
        aria-label={t("label")}
      >
        {APP_LOCALES.map((value) => {
          const active = value === locale;

          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => changeLocale(value)}
              className={cn(
                "min-h-11 rounded-md px-3 text-small font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none disabled:opacity-60",
                active
                  ? "bg-bg-surface text-brand-700 shadow-xs"
                  : "text-text-secondary hover:bg-bg-surface/70 hover:text-text-primary",
              )}
            >
              {value === "th" ? t("thai") : t("english")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
