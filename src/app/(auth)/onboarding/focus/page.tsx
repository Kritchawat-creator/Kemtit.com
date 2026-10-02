import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { OnboardingSteps } from "@/components/layout/OnboardingSteps";
import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";

import { FocusPicker } from "./focus-picker";

export default async function FocusPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const gate = nextRouteFor(me.profile);
  if (gate !== ROUTES.focus) redirect(gate);

  const t = await getTranslations("onboarding.focus");
  return (
    <section aria-labelledby="focus-title">
      <OnboardingSteps current={2} total={3} />
      <h1 id="focus-title" className="text-h1 text-text-primary">
        {t("title")}
      </h1>
      <p className="mt-1 mb-5 text-body text-text-secondary">{t("subtitle")}</p>
      <FocusPicker />
    </section>
  );
}
