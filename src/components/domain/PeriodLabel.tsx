import { useTranslations } from "next-intl";

import type { Period } from "@/core/domain/periods";
import { formatThaiDate, formatThaiYear } from "@/lib/format";

/** ป้ายช่วงเวลาของ goal: "พ.ศ. 2569" / "กันยายน 2569" / "30 ส.ค. – 5 ก.ย." */
export function periodLabelText(period: Period, t: ReturnType<typeof useTranslations<"periods">>): string {
  switch (period.type) {
    case "year":
      return formatThaiYear(period.start);
    case "month":
      return formatThaiDate(period.start, "monthYear");
    case "quarter":
      return t("rangeLabel", { start: formatThaiDate(period.start, "short"), end: formatThaiDate(period.end, "medium") });
    case "week":
      return t("rangeLabel", { start: formatThaiDate(period.start, "short"), end: formatThaiDate(period.end, "short") });
    case "day":
      return formatThaiDate(period.start, "weekday");
  }
}

export function PeriodLabel({ period, className }: { period: Period; className?: string }) {
  const t = useTranslations("periods");
  return <span className={className}>{periodLabelText(period, t)}</span>;
}
