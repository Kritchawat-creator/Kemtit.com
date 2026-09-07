import { CalendarDays, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { hourBkk, todayBkk } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { InstallHint } from "@/components/layout/InstallHint";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResponsiveSwitch } from "@/components/layout/ResponsiveSwitch";
import { Button } from "@/components/ui/button";
import { WidgetSkeleton } from "@/components/widgets/WidgetSkeleton";

import { DesktopDashboard, type ChartRange } from "./desktop-dashboard";
import { layoutForPersona, SPAN_CLASS } from "./registry";

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

function parseChart(value: string | string[] | undefined): ChartRange {
  return value === "week" ? "week" : "month";
}

/**
 * แดชบอร์ด (Design §8.2 + Claude Design 2a/turn 7)
 * มือถือ = "ทิศทางวันนี้" + widget grid เดิม · desktop = โครง v3 (KPI 4 ใบ, กราฟ, การ์ดเข็มทิศ, ตารางบันทึกยอด)
 * สลับด้วย ResponsiveSwitch — เรนเดอร์ต้นไม้เดียวเสมอ ห้ามซ่อนอีกฝั่งด้วย CSS (§1.10 ของแผน turn 6/7)
 */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const { chart } = await searchParams;
  const [t, tn] = await Promise.all([getTranslations("dashboard"), getTranslations("nav")]);
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
        breadcrumb={t("title")}
        meta={formatThaiDate(today, "longWeekday")}
        actions={
          <span className="inline-flex h-7 items-center rounded-full bg-bg-surface px-3 text-caption font-medium text-text-secondary">
            {formatThaiDate(today, "weekday")}
          </span>
        }
        toolbarStart={
          <span className="hidden h-12 items-center gap-2.5 rounded-full bg-bg-surface pr-5 pl-4 text-base font-medium text-brand-800 shadow-sm lg:inline-flex">
            <CalendarDays className="size-5 text-brand-500" strokeWidth={1.5} aria-hidden="true" />
            {formatThaiDate(today, "longWeekday")}
          </span>
        }
        toolbarEnd={
          <Button className="bg-accent-500 shadow-fab hover:bg-accent-700" asChild>
            <Link href="?new=task" scroll={false}>
              <Plus aria-hidden="true" />
              {tn("addTask")}
            </Link>
          </Button>
        }
      />
      <ResponsiveSwitch
        mobile={
          <div className="grid gap-4">
            {widgets.map(({ id, component: Widget, span }, index) => (
              <div key={id} className={SPAN_CLASS[span]}>
                <Suspense fallback={<WidgetSkeleton variant={index === 0 ? "hero" : "list"} />}>
                  <Widget today={today} />
                </Suspense>
              </div>
            ))}
          </div>
        }
        desktop={
          <Suspense fallback={<WidgetSkeleton variant="hero" />}>
            <DesktopDashboard today={today} chart={parseChart(chart)} />
          </Suspense>
        }
      />
      <InstallHint />
    </>
  );
}
