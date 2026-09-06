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
      spacing={1}
      aria-label={t("typeLabel")}
      className="flex w-full rounded-md bg-neutral-200 p-1"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="h-10 flex-1 rounded-sm px-4 text-base font-medium text-text-secondary hover:bg-transparent hover:text-text-primary data-[spacing=1]:rounded-sm data-[state=on]:bg-bg-surface data-[state=on]:text-brand-800 data-[state=on]:shadow-sm md:h-9 md:text-sm"
        >
          {t(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
