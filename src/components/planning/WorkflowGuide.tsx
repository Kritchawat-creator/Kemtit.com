"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  buildWorkflowNavigationLinks,
  getRoleWorkflow,
  type WorkflowHorizon,
} from "@/core/planning/role-workflow";
import type { ISODate } from "@/lib/date";
import { Button } from "@/components/ui/button";

export type WorkflowGuideAction =
  | { kind: "goal"; href: string; title: string }
  | { kind: "choose-goal"; href: string }
  | { kind: "today-priorities"; href: string };

export type WorkflowGuideProps = {
  roleCode: string | null | undefined;
  horizon: WorkflowHorizon;
  selectedDate: ISODate;
  primaryAction: WorkflowGuideAction;
};

export function WorkflowGuide({
  roleCode,
  horizon,
  selectedDate,
  primaryAction,
}: WorkflowGuideProps) {
  const t = useTranslations("workflowGuide");
  const translate = (key: string) => t(key as never);
  const workflow = getRoleWorkflow(roleCode, horizon);
  const roleName = translate("roles." + workflow.role);
  const periodName = translate("periods." + horizon);
  const steps = workflow.steps.map(translate);
  const navigation = buildWorkflowNavigationLinks(horizon, selectedDate);
  const actionLabel =
    primaryAction.kind === "goal"
      ? t("actions.openGoal", { title: primaryAction.title })
      : primaryAction.kind === "choose-goal"
        ? t("actions.chooseGoal")
        : t("actions.todayPriorities");

  return (
    <section
      aria-labelledby="planning-workflow-guide-heading"
      className="@container/workflow mb-4 min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
    >
      <div
        data-testid="workflow-guide-content-grid"
        className="grid min-w-0 gap-4 @min-[40rem]/workflow:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] @min-[40rem]/workflow:items-start"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="planning-workflow-guide-heading"
              className="text-h3 font-semibold text-text-primary"
            >
              {t("title")}
            </h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-800">
              {periodName}
            </span>
          </div>
          <p className="mt-1 break-words text-small text-text-secondary">
            {t("roleAndPeriod", { role: roleName, period: periodName })}
          </p>
        </div>

        <div role="group" aria-label={t("nextAction")} className="min-w-0">
          <p className="text-caption font-semibold text-brand-700">{t("nextAction")}</p>
          <p className="mt-1 break-words text-small text-text-primary">{steps[0]}</p>
          <Button
            asChild
            size="sm"
            className="mt-3 h-auto min-h-11 min-w-0 max-w-full w-full justify-start whitespace-normal py-2 text-left leading-snug sm:w-auto"
          >
            <Link href={primaryAction.href}>{actionLabel}</Link>
          </Button>
        </div>
      </div>

      <nav
        aria-label={t("horizonNavigation")}
        className="mt-4 flex min-w-0 flex-wrap gap-2 border-t border-border pt-3"
      >
        {navigation.map((item) => (
          <Link
            key={item.horizon}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            className={
              item.current
                ? "inline-flex min-h-11 items-center rounded-full border border-brand-500 bg-brand-50 px-3 py-2 text-caption font-semibold text-brand-800 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
                : "inline-flex min-h-11 items-center rounded-full border border-border px-3 py-2 text-caption font-medium text-text-secondary hover:bg-bg-subtle focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
            }
          >
            {translate("periods." + item.horizon)}
          </Link>
        ))}
      </nav>

      <details className="mt-3 border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md text-small font-medium text-brand-700 hover:text-brand-800 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none">
          {t("showSteps")}
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-small text-text-secondary marker:font-semibold marker:text-brand-600">
          {steps.map((step, index) => (
            <li key={workflow.steps[index]} className="break-words pl-1">
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-3 break-words text-caption text-text-muted">
          <span className="font-semibold text-text-secondary">{t("priorityLabel")}: </span>
          {t("priorityRule")}
        </p>
      </details>
    </section>
  );
}
