"use client";

import { Briefcase, GraduationCap, HeartPulse, House, WalletCards, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { chooseFocusAreas } from "@/core/profile/actions";
import { FOCUS_AREA_IDS, type FocusAreaId } from "@/core/profile/roles";

const ICONS: Record<FocusAreaId, LucideIcon> = {
  work: Briefcase,
  daily_life: House,
  finance: WalletCards,
  health: HeartPulse,
  study: GraduationCap,
};

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

export function FocusPicker() {
  const t = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const [selected, setSelected] = useState<FocusAreaId[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(area: FocusAreaId, checked: boolean) {
    setSelected((current) =>
      checked ? [...new Set([...current, area])] : current.filter((value) => value !== area),
    );
  }

  function submit() {
    if (selected.length === 0) return;
    setServerError(null);
    startTransition(async () => {
      const result = await chooseFocusAreas({ focusAreas: selected });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.replace(result.data.next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {FOCUS_AREA_IDS.map((area) => {
          const checked = selected.includes(area);
          const Icon = ICONS[area];
          return (
            <label
              key={area}
              htmlFor={`focus-${area}`}
              className={cn(
                "flex min-h-20 cursor-pointer items-center gap-4 rounded-xl border-2 bg-bg-surface p-4 shadow-md transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-500/30",
                checked ? "border-brand-500 bg-brand-50" : "border-transparent",
              )}
            >
              <Checkbox
                id={`focus-${area}`}
                checked={checked}
                onCheckedChange={(value) => toggle(area, value === true)}
              />
              <Icon className="size-7 shrink-0 text-brand-800" strokeWidth={1.5} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-h3 text-text-primary">{t(`focusAreas.${area}.name`)}</span>
                <span className="mt-0.5 block text-caption text-text-secondary">
                  {t(`focusAreas.${area}.description`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <p className="text-small text-text-secondary">{t("onboarding.focus.hint")}</p>

      {serverError ? (
        <p role="alert" aria-live="polite" className="text-small text-danger-800">
          {te.has(serverError as ErrorKey) ? te(serverError as ErrorKey) : te("generic")}
        </p>
      ) : null}

      <Button size="lg" className="w-full" onClick={submit} disabled={selected.length === 0 || pending}>
        {pending ? t("common.saving") : t("onboarding.focus.continue")}
      </Button>
    </div>
  );
}
