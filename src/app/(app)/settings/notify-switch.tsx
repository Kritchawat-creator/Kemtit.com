"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateNotifyOverdue } from "@/core/profile/actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function NotifySwitch({ initial }: { initial: boolean }) {
  const t = useTranslations("settings.notifications");
  const te = useTranslations("errors");
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [, startTransition] = useTransition();

  function change(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const result = await updateNotifyOverdue({ enabled: next });
      if (!result.ok) {
        setEnabled(!next);
        toast.error(te("generic"));
        return;
      }
      toast.success(t("savedToast"));
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor="notify-overdue" className="text-body text-text-primary">
          {t("overdue")}
        </Label>
        <p className="mt-0.5 text-caption text-text-secondary">{t("overdueDescription")}</p>
      </div>
      <Switch id="notify-overdue" checked={enabled} onCheckedChange={change} />
    </div>
  );
}
