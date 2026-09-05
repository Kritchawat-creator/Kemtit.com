import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { todayBkk } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

import { layoutForPersona } from "./registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

/** แดชบอร์ด (Design §8.2): เห็น % เป้าหลักเดือนนี้ใน 3 วินาที · layout คงที่ · widget โหลดแยกด้วย Suspense */
export default async function DashboardPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const t = await getTranslations("dashboard");
  const today = todayBkk();
  const widgets = layoutForPersona(me.profile.active_persona);

  return (
    <>
      <PageHeader title={t("title")} description={t("greeting", { date: formatThaiDate(today, "weekday") })} />
      <div className="grid gap-4 lg:grid-cols-2">
        {widgets.map(({ id, component: Widget, span }) => (
          <div key={id} className={span === 2 ? "lg:col-span-2" : undefined}>
            <Suspense fallback={<WidgetSkeleton />}>
              <Widget today={today} />
            </Suspense>
          </div>
        ))}
      </div>
    </>
  );
}
