import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { OnboardingSteps } from "@/components/layout/OnboardingSteps";
import { listExternalCalendarConnections } from "@/core/calendar-integrations/queries";
import { nextRouteFor, ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import type { FocusAreaId } from "@/core/profile/roles";
import {
  getStarterSuggestions,
  type StarterSuggestionCopyKey,
} from "@/core/profile/starter";
import { listStarterSuggestionDecisions } from "@/core/profile/starter-queries";
import type { SuggestionDecision } from "@/core/shared/suggestions";
import { isGoogleCalendarConfigured } from "@/lib/env.server";

import { StarterWorkspace, type StarterSuggestionView } from "./starter-workspace";

export default async function StarterPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const gate = nextRouteFor(me.profile);
  if (gate !== ROUTES.starter) redirect(gate);
  if (!me.profile.role_code) redirect(ROUTES.persona);

  const [t, rootT, decisions, calendarConnections] = await Promise.all([
    getTranslations("onboarding.starter"),
    getTranslations(),
    listStarterSuggestionDecisions(),
    listExternalCalendarConnections(),
  ]);
  const calendarConfigured = isGoogleCalendarConfigured();
  const calendarConnected = calendarConnections.some(
    (connection) => connection.provider === "google" && connection.status === "active",
  );

  const copies: Record<StarterSuggestionCopyKey, { title: string; subtitle: string }> = {
    employeeGoal: {
      title: t("suggestions.employeeGoal.title"),
      subtitle: t("suggestions.employeeGoal.subtitle"),
    },
    sellerGoal: {
      title: t("suggestions.sellerGoal.title"),
      subtitle: t("suggestions.sellerGoal.subtitle"),
    },
    studentGoal: {
      title: t("suggestions.studentGoal.title"),
      subtitle: t("suggestions.studentGoal.subtitle"),
    },
    freelancerGoal: {
      title: t("suggestions.freelancerGoal.title"),
      subtitle: t("suggestions.freelancerGoal.subtitle"),
    },
    workPriority: {
      title: t("suggestions.workPriority.title"),
      subtitle: t("suggestions.workPriority.subtitle"),
    },
    dailyLifePlan: {
      title: t("suggestions.dailyLifePlan.title"),
      subtitle: t("suggestions.dailyLifePlan.subtitle"),
    },
    financeBudget: {
      title: t("suggestions.financeBudget.title"),
      subtitle: t("suggestions.financeBudget.subtitle"),
    },
    healthRoutine: {
      title: t("suggestions.healthRoutine.title"),
      subtitle: t("suggestions.healthRoutine.subtitle"),
    },
    studyRoutine: {
      title: t("suggestions.studyRoutine.title"),
      subtitle: t("suggestions.studyRoutine.subtitle"),
    },
  };

  const areaLabels: Record<FocusAreaId, string> = {
    work: rootT("focusAreas.work.name"),
    daily_life: rootT("focusAreas.daily_life.name"),
    finance: rootT("focusAreas.finance.name"),
    health: rootT("focusAreas.health.name"),
    study: rootT("focusAreas.study.name"),
  };

  const decisionById = new Map(decisions.map((decision) => [decision.suggestion_id, decision]));
  const suggestions = getStarterSuggestions(me.profile.role_code, me.profile.focus_areas);

  const views: StarterSuggestionView[] = suggestions.map((suggestion) => {
    const copy = copies[suggestion.copyKey];
    const decision = decisionById.get(suggestion.id);
    const status: SuggestionDecision =
      decision?.status === "accepted" || decision?.status === "skipped"
        ? decision.status
        : "pending";

    return {
      id: suggestion.id,
      type: suggestion.type,
      area: suggestion.area,
      areaLabel: areaLabels[suggestion.area],
      title: decision?.custom_title ?? copy.title,
      subtitle: copy.subtitle,
      reason: suggestion.reasonKey === "role" ? t("reasonRole") : t("reasonFocus"),
      status,
    };
  });

  return (
    <section aria-labelledby="starter-title">
      <OnboardingSteps current={3} total={3} />
      <h1 id="starter-title" className="text-h1 text-text-primary">
        {t("title")}
      </h1>
      <p className="mt-1 mb-5 text-body text-text-secondary">{t("subtitle")}</p>
      <StarterWorkspace
        suggestions={views}
        calendarConfigured={calendarConfigured}
        calendarConnected={calendarConnected}
      />
    </section>
  );
}
