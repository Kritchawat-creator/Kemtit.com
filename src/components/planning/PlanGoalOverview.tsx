import { Plus } from "@/components/icons/ui-icons";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import type { Domain } from "@/core/domain/domains";
import type { GoalWithProgress } from "@/core/goals/queries";
import type { GoalNextAction } from "@/core/goals/next-actions";
import { hasMeasuredGoalProgress } from "@/core/goals/overview";
import { buildPlannerGoalHref } from "@/core/planning/role-workflow";
import type { PlannerView } from "@/core/planning/planner";
import {
  buildGoalDetailHref,
  buildPlanContextHref,
  withPlanScope,
} from "@/core/planning/plan-links";
import type { Scope } from "@/core/profile/scope";
import type { AppLocale } from "@/i18n/config";
import type { ISODate } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { DomainTag } from "@/components/domain/DomainTag";
import { GoalCard } from "@/components/domain/GoalCard";
import { PeriodLabel } from "@/components/domain/PeriodLabel";

const VISIBLE_GOALS_PER_DOMAIN = 1;

export async function PlanGoalOverview({
  goals,
  nextActions,
  domains,
  view,
  date,
  selectedDate,
  scope,
}: {
  goals: GoalWithProgress[];
  nextActions: Map<string, GoalNextAction>;
  domains: Domain[];
  view: PlannerView;
  date: ISODate;
  selectedDate: ISODate;
  scope: Scope;
}) {
  const [t, localeValue] = await Promise.all([getTranslations(), getLocale()]);
  const locale = localeValue as AppLocale;
  const populatedDomains = domains.filter((domain) => goals.some((goal) => goal.domain === domain));
  const emptyDomains = domains.filter((domain) => goals.every((goal) => goal.domain !== domain));
  const returnTo = buildPlanContextHref(view, selectedDate, scope);

  return (
    <section aria-labelledby="planner-domain-overview-heading">
      <h2 id="planner-domain-overview-heading" className="mb-3 text-h2 text-text-primary">
        {t("planner.overviewTitle")}
      </h2>
      {populatedDomains.length > 0 ? (
        <div className="grid min-w-0 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {populatedDomains.map((domain) => {
            const domainGoals = goals.filter((goal) => goal.domain === domain);
            const visibleGoals = domainGoals.slice(0, VISIBLE_GOALS_PER_DOMAIN);
            const additionalGoals = domainGoals.slice(VISIBLE_GOALS_PER_DOMAIN);

            const renderGoal = (goal: GoalWithProgress) => {
              const nextAction = nextActions.get(goal.id);
              const actionDate = nextAction?.planned_date ?? nextAction?.due_date ?? null;

              return (
                <li key={goal.id} className="min-w-0 space-y-2">
                  {hasMeasuredGoalProgress(goal) ? (
                    <GoalCard goal={goal} compact href={buildGoalDetailHref(goal.id, returnTo)} />
                  ) : (
                    <Link
                      href={buildGoalDetailHref(goal.id, returnTo)}
                      className="block min-w-0 rounded-xl border border-border bg-bg-surface px-4 py-3 shadow-xs hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <PeriodLabel
                          period={goal.period}
                          className="truncate text-caption text-text-secondary"
                        />
                        <span className="text-caption text-text-secondary">
                          {t("goalKinds.execution")}
                        </span>
                      </div>
                      <h3 className="mt-2 truncate text-body font-medium text-text-primary">
                        {goal.title}
                      </h3>
                    </Link>
                  )}

                  <div className="rounded-lg bg-bg-surface px-3 py-2">
                    <p className="text-caption font-semibold text-text-secondary">
                      {t("planner.nextAction")}
                    </p>
                    {nextAction ? (
                      <>
                        <p className="mt-1 text-small break-words text-text-primary">
                          {nextAction.title}
                        </p>
                        {actionDate ? (
                          <p className="mt-0.5 text-caption text-text-secondary">
                            {t("planner.nextActionPlanned", {
                              date: formatDate(actionDate, "short", locale),
                            })}
                          </p>
                        ) : null}
                      </>
                    ) : goal.status === "active" ? (
                      <p className="mt-1 text-small text-text-secondary">
                        {t("planner.noNextAction")}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            };

            return (
              <article
                key={domain}
                className="min-w-0 rounded-xl border border-border bg-bg-subtle p-4"
              >
                <h3 className="sr-only">{t(`domains.${domain}`)}</h3>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <DomainTag domain={domain} size="md" />
                  <span className="text-caption text-text-secondary">
                    {t("planner.domainGoalCount", { count: domainGoals.length })}
                  </span>
                </div>

                <ul className="mt-3 space-y-3">{visibleGoals.map(renderGoal)}</ul>
                {additionalGoals.length > 0 ? (
                  <details className="mt-3 rounded-lg bg-bg-surface px-3">
                    <summary className="min-h-11 cursor-pointer py-3 text-small font-medium text-brand-700 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none">
                      {t("planner.showAdditionalGoals", { count: additionalGoals.length })}
                    </summary>
                    <ul className="space-y-3 pb-3">{additionalGoals.map(renderGoal)}</ul>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
      {emptyDomains.length > 0 ? (
        <div
          role="group"
          className={`flex flex-wrap gap-2 ${populatedDomains.length > 0 ? "mt-4" : ""}`}
          aria-label={t("planner.addGoal")}
        >
          {emptyDomains.map((domain) => (
            <Link
              key={domain}
              href={withPlanScope(buildPlannerGoalHref(view, date), scope, domain)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-bg-surface px-3 text-caption font-medium text-brand-700 hover:border-border-strong hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>
                {t("planner.addGoal")} · {t(`domains.${domain}`)}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
