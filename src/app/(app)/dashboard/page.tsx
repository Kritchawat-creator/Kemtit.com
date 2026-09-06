import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { hourBkk, todayBkk } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { InstallHint } from "@/components/layout/InstallHint";
import { PageHeader } from "@/components/layout/PageHeader";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

import { layoutForPersona } from "./registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

function greetingKey(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * แดชบอร์ด (Design §8.2 + Claude Design 2a "ทิศทางวันนี้"): เห็น % เป้าหลักเดือนนี้ใน 3 วินาที
 * บรรทัดทักทายตามช่วงเวลาไทย + ชื่อ · pill วันที่ขวา · layout คงที่ · widget โหลดแยกด้วย Suspense
 */
export default async function DashboardPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const t = await getTranslations("dashboard");
  const today = todayBkk();
  const widgets = layoutForPersona(me.profile.active_persona);
  const name = me.profile.display_name?.trim();
  const greeting = name
    ? t(`greeting.${greetingKey(hourBkk())}`, { name })
    : t(`greetingNoName.${greetingKey(hourBkk())}`);

  return (
    <>
      <PageHeader
        eyebrow={greeting}
        title={t("heading")}
        actions={
          <span className="inline-flex h-7 items-center rounded-full bg-bg-surface px-3 text-caption font-medium text-text-secondary">
            {formatThaiDate(today, "weekday")}
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {widgets.map(({ id, component: Widget, span }, index) => (
          <div key={id} className={span === 2 ? "lg:col-span-2" : undefined}>
            <Suspense fallback={<WidgetSkeleton variant={index === 0 ? "hero" : "list"} />}>
              <Widget today={today} />
            </Suspense>
          </div>
        ))}
      </div>
      <InstallHint />
    </>
  );
}
