"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePlanningContext } from "@/core/profile/actions";
import {
  FOCUS_AREA_IDS,
  ROLE_CODES,
  type FocusAreaId,
  type RoleCode,
} from "@/core/profile/roles";
import type { Scope } from "@/core/profile/scope";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ContextSettings({
  role,
  focusAreas,
  scope,
}: {
  role: RoleCode | null;
  focusAreas: FocusAreaId[];
  scope: Scope;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleCode>(role ?? "employee");
  const [selectedAreas, setSelectedAreas] = useState<FocusAreaId[]>(focusAreas);
  const [selectedScope, setSelectedScope] = useState<Scope>(scope);
  const [pending, startTransition] = useTransition();

  function toggleArea(area: FocusAreaId, checked: boolean) {
    setSelectedAreas((current) =>
      checked ? [...new Set([...current, area])] : current.filter((item) => item !== area),
    );
  }

  function save() {
    if (selectedAreas.length === 0) {
      toast.error(t("errors.focusAreaRequired"));
      return;
    }

    startTransition(async () => {
      const result = await updatePlanningContext({
        role: selectedRole,
        focusAreas: selectedAreas,
        scope: selectedScope,
      });
      if (!result.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("settings.context.saved"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <label
          htmlFor="settings-role"
          className="mb-1 block text-caption font-medium text-text-secondary"
        >
          {t("settings.context.role")}
        </label>
        <select
          id="settings-role"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as RoleCode)}
          className="h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
        >
          {ROLE_CODES.map((item) => (
            <option key={item} value={item}>
              {t(`roles.${item}.name`)}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="mb-2 text-caption font-medium text-text-secondary">
          {t("settings.context.focusAreas")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FOCUS_AREA_IDS.map((area) => {
            const checked = selectedAreas.includes(area);
            return (
              <label
                key={area}
                htmlFor={`settings-focus-${area}`}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
              >
                <Checkbox
                  id={`settings-focus-${area}`}
                  checked={checked}
                  onCheckedChange={(value) => toggleArea(area, value === true)}
                />
                <span>
                  <span className="block text-small font-medium text-text-primary">
                    {t(`focusAreas.${area}.name`)}
                  </span>
                  <span className="mt-0.5 block text-caption text-text-secondary">
                    {t(`focusAreas.${area}.description`)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="settings-scope"
          className="mb-1 block text-caption font-medium text-text-secondary"
        >
          {t("settings.context.scope")}
        </label>
        <select
          id="settings-scope"
          value={selectedScope}
          onChange={(event) => setSelectedScope(event.target.value as Scope)}
          className="h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
        >
          <option value="all">{t("scopes.all")}</option>
          <option value="work">{t("scopes.work")}</option>
          <option value="life">{t("scopes.life")}</option>
        </select>
      </div>

      <Button type="button" onClick={save} disabled={pending || selectedAreas.length === 0}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );
}
