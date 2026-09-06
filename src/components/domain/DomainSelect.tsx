"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";

import { DOMAINS, type Domain } from "@/core/domain/domains";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { DOMAIN_STYLES } from "./DomainTag";

type Props = {
  value: Domain;
  onValueChange: (value: Domain) => void;
  disabled?: boolean;
  id?: string;
};

/** เลือก domain แบบ pill 6 ตัว (POC Decisions 3: domain UI ขั้นต่ำ) */
export function DomainSelect({ value, onValueChange, disabled, id }: Props) {
  const t = useTranslations("domains");
  return (
    <ToggleGroup
      id={id}
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next as Domain)}
      disabled={disabled}
      spacing={2}
      className="flex flex-wrap justify-start gap-2"
    >
      {DOMAINS.map((domain) => (
        <ToggleGroupItem
          key={domain}
          value={domain}
          aria-label={t(domain)}
          className={cn(
            // pill หมวด (Claude Design 3l): พื้นสี domain อ่อน + จุด · เลือกแล้ว = ขอบ 1.5px สีตัวหนังสือของหมวด
            "h-9 gap-1.5 rounded-full border-[1.5px] border-transparent px-3 text-small font-medium shadow-none hover:bg-transparent hover:text-current data-[spacing=2]:rounded-full",
            DOMAIN_STYLES[domain].pill,
            DOMAIN_STYLES[domain].selected,
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", DOMAIN_STYLES[domain].dot)}
            aria-hidden="true"
          />
          {t(domain)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
