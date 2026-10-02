"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { SuggestedItem } from "@/components/domain/SuggestedItem";
import { SuggestionGroup } from "@/components/domain/SuggestionGroup";
import { Button } from "@/components/ui/button";
import type { SuggestionDecision } from "@/core/shared/suggestions";

import {
  acceptStarterSuggestion,
  finishStarterWorkspace,
  skipStarterSuggestion,
} from "./actions";

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

export type StarterSuggestionView = {
  id: string;
  type: "task" | "goal" | "habit";
  area: string;
  areaLabel: string;
  title: string;
  subtitle: string;
  reason: string;
  status: SuggestionDecision;
};

type Props = {
  suggestions: StarterSuggestionView[];
  calendarConfigured: boolean;
  calendarConnected: boolean;
};

export function StarterWorkspace({
  suggestions,
  calendarConfigured,
  calendarConnected,
}: Props) {
  const t = useTranslations("onboarding.starter");
  const te = useTranslations("errors");
  const router = useRouter();
  const [items, setItems] = useState(suggestions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [finishing, startFinish] = useTransition();

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: StarterSuggestionView[] }>();
    for (const item of items) {
      if (item.status === "skipped") continue;
      const group = map.get(item.area) ?? { label: item.areaLabel, items: [] };
      group.items.push(item);
      map.set(item.area, group);
    }
    return [...map.values()];
  }, [items]);

  async function accept(item: StarterSuggestionView, title: string) {
    setPendingId(item.id);
    setServerError(null);
    const result = await acceptStarterSuggestion({ suggestionId: item.id, title });
    setPendingId(null);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, title, status: "accepted" } : candidate,
      ),
    );
  }

  async function skip(item: StarterSuggestionView) {
    setPendingId(item.id);
    setServerError(null);
    const result = await skipStarterSuggestion({ suggestionId: item.id });
    setPendingId(null);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, status: result.data.status } : candidate,
      ),
    );
  }

  function finish() {
    setServerError(null);
    startFinish(async () => {
      const result = await finishStarterWorkspace();
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.replace(result.data.next);
      router.refresh();
    });
  }

  const visibleCount = items.filter((item) => item.status !== "skipped").length;
  const hasAcceptedSuggestion = items.some((item) => item.status === "accepted");

  return (
    <div className="space-y-6">
      {!hasAcceptedSuggestion ? (
        <div className="rounded-xl bg-brand-50 p-4 text-small text-brand-800">
          <p className="font-semibold">{t("nothingAddedTitle")}</p>
          <p className="mt-1">{t("nothingAddedDescription")}</p>
        </div>
      ) : null}

      {groups.map((group) => (
        <SuggestionGroup key={group.label} title={group.label}>
          {group.items.map((item) => (
            <SuggestedItem
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              reason={item.reason}
              typeLabel={t(`types.${item.type}`)}
              status={item.status}
              pending={pendingId === item.id}
              acceptLabel={t("accept")}
              editLabel={t("edit")}
              skipLabel={t("skip")}
              acceptedLabel={t("accepted")}
              suggestedLabel={t("suggested")}
              onAccept={(title) => accept(item, title)}
              onSkip={() => skip(item)}
            />
          ))}
        </SuggestionGroup>
      ))}

      {visibleCount === 0 ? (
        <div className="rounded-xl border border-border bg-bg-surface p-5 text-center shadow-md">
          <p className="text-h3 text-brand-800">{t("allSkippedTitle")}</p>
          <p className="mt-1 text-small text-text-secondary">{t("allSkippedDescription")}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-bg-surface p-4">
        <p className="text-small font-medium text-text-primary">{t("calendarTitle")}</p>
        <p className="mt-1 text-caption text-text-secondary">{t("calendarDescription")}</p>
        {calendarConnected ? (
          <p className="mt-3 text-small font-medium text-brand-700">{t("calendarConnected")}</p>
        ) : calendarConfigured ? (
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/api/calendar/google/connect">{t("calendarConnect")}</Link>
          </Button>
        ) : (
          <p className="mt-3 text-caption text-text-muted">{t("calendarUnavailable")}</p>
        )}
      </div>

      {serverError ? (
        <p role="alert" aria-live="polite" className="text-small text-danger-800">
          {te.has(serverError as ErrorKey) ? te(serverError as ErrorKey) : te("generic")}
        </p>
      ) : null}

      <Button size="lg" className="w-full" onClick={finish} disabled={finishing || pendingId !== null}>
        {finishing ? t("finishing") : t("finish")}
      </Button>
      <p className="text-center text-caption text-text-secondary">{t("manualHint")}</p>
    </div>
  );
}
