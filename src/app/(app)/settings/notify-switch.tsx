"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateNotificationPreference } from "@/core/profile/actions";
import type { NotificationPreferenceKey } from "@/core/profile/schema";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Preferences = Record<NotificationPreferenceKey, boolean>;

const ITEMS: NotificationPreferenceKey[] = [
  "overdue",
  "dailyBrief",
  "weeklyReview",
  "habits",
  "investment",
];

export function NotifySwitch({ initial }: { initial: Preferences }) {
  const t = useTranslations("settings.notifications");
  const te = useTranslations("errors");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pendingKey, setPendingKey] = useState<NotificationPreferenceKey | null>(null);
  const [, startTransition] = useTransition();

  function change(key: NotificationPreferenceKey, next: boolean) {
    const previous = values[key];
    setValues((current) => ({ ...current, [key]: next }));
    setPendingKey(key);

    startTransition(async () => {
      const result = await updateNotificationPreference({ key, enabled: next });
      setPendingKey(null);
      if (!result.ok) {
        setValues((current) => ({ ...current, [key]: previous }));
        toast.error(te("generic"));
        return;
      }
      toast.success(t("savedToast"));
      router.refresh();
    });
  }

  return (
    <div className="divide-y divide-border">
      {ITEMS.map((key) => {
        const id = `notify-${key}`;
        return (
          <div
            key={key}
            className="flex min-h-14 items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <Label htmlFor={id} className="text-body text-text-primary">
                {t(key)}
              </Label>
              <p className="mt-0.5 text-caption text-text-secondary">
                {t(`${key}Description`)}
              </p>
            </div>
            <Switch
              id={id}
              checked={values[key]}
              disabled={pendingKey === key}
              onCheckedChange={(next) => change(key, next)}
            />
          </div>
        );
      })}
    </div>
  );
}
