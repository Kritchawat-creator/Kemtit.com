import { ArrowLeft, CalendarDays } from "@/components/icons/ui-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { getRescueProposal } from "@/core/planning/rescue-queries";
import { isISODate, todayBkk } from "@/lib/date";
import { RescueReview } from "@/components/planning/RescueReview";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { getMe } from "@/core/profile/queries";
import { ROUTES } from "@/core/profile/onboarding";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rescue");
  return { title: t("title") };
}

export default async function RescuePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);
  const params = await searchParams;
  const date = typeof params.date === "string" && isISODate(params.date) ? params.date : todayBkk();
  const [t, result] = await Promise.all([getTranslations("rescue"), getRescueProposal(date)]);

  return (
    <>
      <PageHeader
        title={t("title")}
        meta={t("dateLabel", { date })}
        toolbarEnd={
          <Button variant="outline" asChild>
            <Link href={`/calendar?view=day&date=${date}`}>
              <CalendarDays aria-hidden="true" />
              {t("openCalendar")}
            </Link>
          </Button>
        }
      />
      <div className="mb-4">
        <Link href={`/today?date=${date}`} className="inline-flex items-center gap-1 text-small text-brand-600 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("backToToday")}
        </Link>
      </div>
      <div className="max-w-3xl space-y-4">
        <section className="rounded-xl bg-brand-50 p-5" aria-label={t("capacityLabel")}>
          <p className="text-small text-brand-800">
            {t("capacitySummary", {
              free: result.availability.availableMinutes,
              tasks: result.availability.unscheduledTaskMinutes,
            })}
          </p>
        </section>
        <RescueReview proposal={result.proposal} />
      </div>
    </>
  );
}
