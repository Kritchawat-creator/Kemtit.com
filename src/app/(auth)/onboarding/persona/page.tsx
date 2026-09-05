import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { OnboardingSteps } from "@/components/layout/OnboardingSteps";

import { PersonaPicker } from "./persona-picker";

export default async function PersonaPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);
  if (me.profile.active_persona) redirect(nextRouteFor(me.profile));

  const t = await getTranslations("onboarding.persona");
  return (
    <section aria-labelledby="persona-title">
      <OnboardingSteps current={2} />
      <h1 id="persona-title" className="text-h1 text-text-primary">
        {t("title")}
      </h1>
      <p className="mt-1 mb-6 text-body text-text-secondary">{t("subtitle")}</p>
      <PersonaPicker />
    </section>
  );
}
