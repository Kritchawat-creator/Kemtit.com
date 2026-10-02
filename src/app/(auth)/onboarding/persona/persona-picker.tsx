"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { chooseRole } from "@/core/profile/actions";
import type { RoleCode } from "@/core/profile/roles";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { ROLE_OPTIONS } from "./personas";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

/** Role selection for the redesigned onboarding. */
export function PersonaPicker() {
  const t = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const [selected, setSelected] = useState<RoleCode | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!selected) return;
    setServerError(null);
    startTransition(async () => {
      const result = await chooseRole({ role: selected });
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
      <RadioGroup
        value={selected ?? undefined}
        onValueChange={(value) => setSelected(value as RoleCode)}
        aria-label={t("onboarding.role.title")}
        className="grid grid-cols-2 gap-3"
      >
        {ROLE_OPTIONS.map(({ id, icon: Icon }) => {
          const active = selected === id;
          return (
            <label
              key={id}
              htmlFor={`role-${id}`}
              className={cn(
                "flex min-h-40 cursor-pointer flex-col gap-2.5 rounded-lg border-2 bg-bg-surface p-4 shadow-md transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-500/30",
                active ? "border-brand-500 bg-brand-50" : "border-transparent",
              )}
            >
              <RadioGroupItem id={`role-${id}`} value={id} className="sr-only" />
              <Icon className="size-12 text-brand-800" strokeWidth={1.25} aria-hidden="true" />
              <span className="min-w-0">
                <span className={cn("block text-h3", active ? "text-brand-800" : "text-text-primary")}>
                  {t(`roles.${id}.name`)}
                </span>
                <span className="mt-0.5 block text-caption text-text-secondary">
                  {t(`roles.${id}.description`)}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      {serverError ? (
        <p role="alert" aria-live="polite" className="text-small text-danger-800">
          {te.has(serverError as ErrorKey) ? te(serverError as ErrorKey) : te("generic")}
        </p>
      ) : null}

      <Button size="lg" className="w-full" onClick={submit} disabled={!selected || pending}>
        {pending ? t("common.saving") : t("onboarding.role.continue")}
      </Button>
    </div>
  );
}
