import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { daysLeft, periodOf } from "@/core/domain/periods";
import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { addMonthsISO, todayBkk } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { OnboardingSteps } from "@/components/layout/OnboardingSteps";

import { FirstGoalForm } from "./first-goal-form";

const FEW_DAYS_THRESHOLD = 7; // Q18: เหลือ < 7 วัน → default เดือนหน้า

export default async function FirstGoalPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);
  const gate = nextRouteFor(me.profile);
  if (gate !== ROUTES.firstGoal) redirect(gate);

  const t = await getTranslations("onboarding.firstGoal");
  const today = todayBkk();
  const thisMonth = periodOf("month", today);
  const nextMonth = periodOf("month", addMonthsISO(thisMonth.start, 1));
  const fewDaysLeft = daysLeft(thisMonth, today) < FEW_DAYS_THRESHOLD;

  return (
    <section aria-labelledby="first-goal-title">
      <OnboardingSteps current={3} />
      <h1 id="first-goal-title" className="text-h1 text-text-primary">
        {t("title")}
      </h1>
      <p className="mt-1 mb-6 text-body text-text-secondary">{t("subtitle")}</p>
      <FirstGoalForm
        monthOptions={[
          { value: thisMonth.start, label: t("thisMonth", { month: formatThaiDate(thisMonth.start, "monthYear") }) },
          { value: nextMonth.start, label: t("nextMonth", { month: formatThaiDate(nextMonth.start, "monthYear") }) },
        ]}
        defaultMonth={fewDaysLeft ? nextMonth.start : thisMonth.start}
        fewDaysLeft={fewDaysLeft}
      />
    </section>
  );
}
