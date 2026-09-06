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
      variant="outline"
      className="flex flex-wrap justify-start gap-2"
    >
      {DOMAINS.map((domain) => (
        <ToggleGroupItem
          key={domain}
          value={domain}
          aria-label={t(domain)}
          className={cn(
            "min-h-11 rounded-full border px-4 text-small data-[state=on]:border-transparent md:min-h-9",
            DOMAIN_STYLES[domain].selected,
          )}
        >
          <span
            className={cn("size-2 rounded-full", DOMAIN_STYLES[domain].dot)}
            aria-hidden="true"
          />
          {t(domain)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
