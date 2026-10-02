import { useLocale, useTranslations } from "next-intl";

import type { Period } from "@/core/domain/periods";
import type { AppLocale } from "@/i18n/config";
import { formatDate, formatYear } from "@/lib/format";

export function periodLabelText(
  period: Period,
  t: ReturnType<typeof useTranslations<"periods">>,
  locale: AppLocale = "th",
): string {
  switch (period.type) {
    case "year":
      return formatYear(period.start, locale);
    case "month":
      return formatDate(period.start, "monthYear", locale);
    case "quarter":
      return t("rangeLabel", {
        start: formatDate(period.start, "short", locale),
        end: formatDate(period.end, "medium", locale),
      });
    case "week":
      return t("rangeLabel", {
        start: formatDate(period.start, "short", locale),
        end: formatDate(period.end, "short", locale),
      });
    case "day":
      return formatDate(period.start, "weekday", locale);
  }
}

export function PeriodLabel({ period, className }: { period: Period; className?: string }) {
  const t = useTranslations("periods");
  const locale = useLocale() as AppLocale;
  return <span className={className}>{periodLabelText(period, t, locale)}</span>;
}
