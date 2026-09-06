"use client";

import { useTranslations } from "next-intl";

import { POC_PERIOD_TYPES, type PeriodType } from "@/core/domain/periods";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Props = {
  value: PeriodType;
  onValueChange: (value: PeriodType) => void;
  options?: readonly PeriodType[];
  disabled?: boolean;
  id?: string;
};

/** สลับ ปี/เดือน/สัปดาห์ (POC) — ใช้ทั้งฟอร์มและปฏิทิน */
export function PeriodSwitcher({
  value,
  onValueChange,
  options = POC_PERIOD_TYPES,
  disabled,
  id,
}: Props) {
  const t = useTranslations("periods");
  return (
    <ToggleGroup
      id={id}
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next as PeriodType)}
      disabled={disabled}
      variant="outline"
      aria-label={t("typeLabel")}
      className="inline-flex rounded-md"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="min-h-11 px-4 text-small data-[state=on]:bg-brand-50 data-[state=on]:text-brand-800 md:min-h-9"
        >
          {t(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
