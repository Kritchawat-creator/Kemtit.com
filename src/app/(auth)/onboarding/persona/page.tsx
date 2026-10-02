import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { OnboardingSteps } from "@/components/layout/OnboardingSteps";

import { PersonaPicker } from "./persona-picker";

export default async function PersonaPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const gate = nextRouteFor(me.profile);
  if (gate !== ROUTES.persona) redirect(gate);

  const t = await getTranslations("onboarding.role");
  return (
    <section aria-labelledby="role-title">
      <OnboardingSteps current={1} total={3} />
      <h1 id="role-title" className="text-h1 text-text-primary">
        {t("title")}
      </h1>
      <p className="mt-1 mb-5 text-body text-text-secondary">{t("subtitle")}</p>
      <PersonaPicker />
    </section>
  );
}
