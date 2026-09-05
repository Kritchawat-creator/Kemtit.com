"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "cn";

import { choosePersona } from "@/core/profile/actions";
import type { PersonaId } from "@/core/profile/personas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { PERSONA_OPTIONS } from "./personas";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

/** ขั้น 2: เลือก persona — 4 card ใหญ่ บังคับเลือก (Design §8.3); POC เปิดแค่ seller */
export function PersonaPicker() {
  const t = useTranslations();
  const te = useTranslations("errors");
  const router = useRouter();
  const [selected, setSelected] = useState<PersonaId | null>(
    PERSONA_OPTIONS.find((p) => p.enabled)?.id ?? null,
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!selected) return;
    setServerError(null);
    startTransition(async () => {
      const result = await choosePersona({ persona: selected });
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
        onValueChange={(value) => setSelected(value as PersonaId)}
        aria-label={t("onboarding.persona.title")}
        className="grid gap-3"
      >
        {PERSONA_OPTIONS.map(({ id, icon: Icon, enabled }) => {
          const active = selected === id;
          return (
            <label
              key={id}
              htmlFor={`persona-${id}`}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-lg border bg-bg-surface p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                active ? "border-brand-500 bg-brand-50" : "border-border hover:border-border-strong",
                !enabled && "cursor-not-allowed opacity-60",
              )}
            >
              <RadioGroupItem id={`persona-${id}`} value={id} disabled={!enabled} className="sr-only" />
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full",
                  active ? "bg-brand-500 text-neutral-0" : "bg-brand-50 text-brand-700",
                )}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("text-h3", active ? "text-brand-800" : "text-text-primary")}>
                    {t(`personas.${id}.name`)}
                  </span>
                  {!enabled ? (
                    <Badge variant="outline" className="rounded-full">
                      {t("common.comingSoon")}
                    </Badge>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-small text-text-secondary">
                  {t(`personas.${id}.description`)}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      <p className="text-caption text-text-muted">{t("onboarding.persona.disabledHint")}</p>

      {serverError ? (
        <p role="alert" aria-live="polite" className="text-small text-danger-800">
          {te.has(serverError as ErrorKey) ? te(serverError as ErrorKey) : te("generic")}
        </p>
      ) : null}

      <Button size="lg" className="w-full" onClick={submit} disabled={!selected || pending}>
        {pending ? t("common.saving") : t("onboarding.persona.continue")}
      </Button>
    </div>
  );
}
