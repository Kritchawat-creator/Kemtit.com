"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { applyGoalWizard } from "@/core/goals/wizard-actions";
import { goalWizardApplySchema, type GoalWizardSpec } from "@/core/goals/wizard-schema";
import { starterPackDomain, type StarterPackId } from "@/core/goals/starter-packs";
import { DOMAINS, type Domain } from "@/core/domain/domains";
import { PERIOD_TYPES, normalizePeriodStart, type PeriodType } from "@/core/domain/periods";
import { addDaysISO, isISODate, type ISODate } from "@/lib/date";
import type { AppLocale } from "@/i18n/config";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

type SavedAttempt = { requestId: string; spec: GoalWizardSpec };
type WizardField = "goalTitle" | "periodStart" | "firstStep" | "dueDate";
type Reservation =
  | { status: "ready"; attempt: SavedAttempt; created: boolean }
  | { status: "unavailable" | "invalid" };
type AttemptSnapshot =
  | { status: "loading" }
  | { status: "ready"; attempt: SavedAttempt | null }
  | { status: "unavailable" }
  | { status: "invalid" };

const LOCAL_ATTEMPT_EVENT = "kemtit:goal-wizard-attempt";
const SERVER_ATTEMPT_SNAPSHOT: AttemptSnapshot = { status: "loading" };
const EMPTY_ATTEMPT_SNAPSHOT: AttemptSnapshot = { status: "ready", attempt: null };
const UNAVAILABLE_ATTEMPT_SNAPSHOT: AttemptSnapshot = { status: "unavailable" };
const INVALID_ATTEMPT_SNAPSHOT: AttemptSnapshot = { status: "invalid" };
const attemptSnapshotCache = new Map<string, { raw: string; snapshot: AttemptSnapshot }>();

function readAttemptSnapshot(storageKey: string): AttemptSnapshot {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return EMPTY_ATTEMPT_SNAPSHOT;
    const cached = attemptSnapshotCache.get(storageKey);
    if (cached?.raw === raw) return cached.snapshot;

    const parsed = goalWizardApplySchema.safeParse(JSON.parse(raw));
    const snapshot: AttemptSnapshot = parsed.success
      ? { status: "ready", attempt: { requestId: parsed.data.requestId, spec: parsed.data.spec } }
      : INVALID_ATTEMPT_SNAPSHOT;
    attemptSnapshotCache.set(storageKey, { raw, snapshot });
    return snapshot;
  } catch {
    return UNAVAILABLE_ATTEMPT_SNAPSHOT;
  }
}

function subscribeToAttempt(storageKey: string, onStoreChange: () => void) {
  const onLocalChange = () => {
    attemptSnapshotCache.delete(storageKey);
    onStoreChange();
  };
  const onStorageChange = (event: StorageEvent) => {
    if (event.key === null || event.key === storageKey) onLocalChange();
  };
  window.addEventListener(LOCAL_ATTEMPT_EVENT, onLocalChange);
  window.addEventListener("storage", onStorageChange);
  return () => {
    window.removeEventListener(LOCAL_ATTEMPT_EVENT, onLocalChange);
    window.removeEventListener("storage", onStorageChange);
  };
}

function notifyAttemptChanged() {
  window.dispatchEvent(new Event(LOCAL_ATTEMPT_EVENT));
}

function reserveOperation(storageKey: string, spec: GoalWizardSpec): Reservation {
  const existing = readAttemptSnapshot(storageKey);
  if (existing.status !== "ready") {
    return existing.status === "unavailable" || existing.status === "invalid"
      ? existing
      : { status: "invalid" };
  }
  if (existing.attempt) return { status: "ready", attempt: existing.attempt, created: false };

  const operation = { requestId: crypto.randomUUID(), spec };
  window.localStorage.setItem(storageKey, JSON.stringify(operation));
  attemptSnapshotCache.delete(storageKey);
  const confirmed = readAttemptSnapshot(storageKey);
  if (confirmed.status !== "ready" || !confirmed.attempt) {
    return confirmed.status === "invalid" || confirmed.status === "unavailable"
      ? confirmed
      : { status: "invalid" };
  }
  notifyAttemptChanged();
  return {
    status: "ready",
    attempt: confirmed.attempt,
    created: confirmed.attempt.requestId === operation.requestId,
  };
}

export function GoalWizard({
  userId,
  today,
  starterPack,
}: {
  userId: string;
  today: ISODate;
  starterPack: StarterPackId | null;
}) {
  const t = useTranslations("goals.wizard");
  const td = useTranslations("domains");
  const tp = useTranslations("periods");
  const te = useTranslations("errors");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(() =>
    starterPack ? t(`starter.packs.${starterPack}.goal`) : "",
  );
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [periodStart, setPeriodStart] = useState<string>(normalizePeriodStart("month", today));
  const [domain, setDomain] = useState<Domain>(
    starterPack ? starterPackDomain(starterPack) : "work",
  );
  const [firstStepTitle, setFirstStepTitle] = useState(() =>
    starterPack ? t(`starter.packs.${starterPack}.task`) : "",
  );
  const [dueDate, setDueDate] = useState<string>(addDaysISO(today, 7));
  const [writeUnavailable, setWriteUnavailable] = useState(false);
  const [invalidField, setInvalidField] = useState<WizardField | null>(null);
  const [failure, setFailure] = useState<"generic" | "conflict" | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fieldRefs = useRef<Record<WizardField, HTMLInputElement | null>>({
    goalTitle: null,
    periodStart: null,
    firstStep: null,
    dueDate: null,
  });

  const storageKey = `kemtit.goal-wizard.v1:${userId}`;
  const attemptSnapshot = useSyncExternalStore(
    (onStoreChange) => subscribeToAttempt(storageKey, onStoreChange),
    () => readAttemptSnapshot(storageKey),
    () => SERVER_ATTEMPT_SNAPSHOT,
  );
  const restoring = attemptSnapshot.status === "loading";
  const storageUnavailable = writeUnavailable || attemptSnapshot.status === "unavailable";
  const storageInvalid = attemptSnapshot.status === "invalid";
  const attempt = attemptSnapshot.status === "ready" ? attemptSnapshot.attempt : null;
  const visibleStep = attempt ? 3 : step;
  const visibleTitle = attempt?.spec.title ?? title;
  const visiblePeriodType = attempt?.spec.periodType ?? periodType;
  const visiblePeriodStart = attempt?.spec.periodStart ?? periodStart;
  const visibleDomain = attempt?.spec.domain ?? domain;
  const visibleFirstStepTitle = attempt?.spec.tasks[0].title ?? firstStepTitle;
  const visibleDueDate = attempt?.spec.tasks[0].dueDate ?? dueDate;

  useEffect(() => {
    headingRef.current?.focus();
  }, [visibleStep]);

  function validateCurrentStep() {
    const invalid: WizardField | null =
      step === 1
        ? !title.trim() || title.trim().length > 120
          ? "goalTitle"
          : !isISODate(periodStart) || normalizePeriodStart(periodType, periodStart) !== periodStart
            ? "periodStart"
            : null
        : !firstStepTitle.trim() || firstStepTitle.trim().length > 200
          ? "firstStep"
          : !isISODate(dueDate)
            ? "dueDate"
            : null;
    setInvalidField(invalid);
    if (invalid) {
      fieldRefs.current[invalid]?.focus();
      return false;
    }
    return true;
  }

  function clearInvalidField(field: WizardField) {
    setInvalidField((current) => (current === field ? null : current));
  }

  function fieldErrorMessage(field: WizardField) {
    switch (field) {
      case "goalTitle":
        return title.trim().length > 120 ? te("tooLong") : te("required");
      case "periodStart":
        return periodStart ? te("invalidDate") : te("required");
      case "firstStep":
        return firstStepTitle.trim().length > 200 ? te("tooLong") : te("required");
      case "dueDate":
        return dueDate ? te("invalidDate") : te("required");
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (restoring || storageUnavailable || storageInvalid || pending || attempt) return;
    if (step < 3) {
      if (!validateCurrentStep()) return;
      setStep((current) => Math.min(3, current + 1));
      return;
    }

    const specResult = goalWizardApplySchema.shape.spec.safeParse({
      title,
      periodType,
      periodStart,
      domain,
      goalKind: "execution",
      tasks: [{ title: firstStepTitle, dueDate, domain }],
    });
    if (!specResult.success) {
      setFailure("generic");
      return;
    }

    setFailure(null);
    startTransition(async () => {
      let reservation: Reservation;
      try {
        if ("locks" in navigator) {
          reservation = await navigator.locks.request(
            `kemtit.goal-wizard:${userId}`,
            { mode: "exclusive" },
            () => reserveOperation(storageKey, specResult.data),
          );
        } else {
          reservation = reserveOperation(storageKey, specResult.data);
        }
      } catch {
        setWriteUnavailable(true);
        return;
      }
      if (reservation.status !== "ready") {
        attemptSnapshotCache.delete(storageKey);
        notifyAttemptChanged();
        return;
      }
      if (JSON.stringify(reservation.attempt.spec) !== JSON.stringify(specResult.data)) {
        attemptSnapshotCache.delete(storageKey);
        notifyAttemptChanged();
        return;
      }
      await runAttempt(reservation.attempt);
    });
  }

  function retry() {
    if (!attempt || pending || storageUnavailable) return;
    setFailure(null);
    startTransition(async () => {
      await runAttempt(attempt);
    });
  }

  async function runAttempt(operation: SavedAttempt) {
    try {
      const result = await applyGoalWizard(operation);
      if (!result.ok) {
        setFailure(result.error === "idempotencyConflict" ? "conflict" : "generic");
        return;
      }
      try {
        window.localStorage.removeItem(storageKey);
        attemptSnapshotCache.delete(storageKey);
        notifyAttemptChanged();
      } catch {
        // A later retry still returns the same IDs if storage could not be cleared.
      }
      router.replace(`/goals/${result.data.goalId}`);
      router.refresh();
    } catch {
      // The server may have committed before the connection failed; preserve this request ID.
      setFailure("generic");
    }
  }

  const locked = Boolean(attempt) || pending || restoring || storageUnavailable || storageInvalid;

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-bg-surface p-5 shadow-md sm:p-7">
      <div className="mb-6">
        <p className="text-caption font-semibold tracking-wide text-brand-700 uppercase">
          {t("stepCount", { current: visibleStep })}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-h2 text-text-primary">
          {t(
            visibleStep === 1
              ? "steps.direction"
              : visibleStep === 2
                ? "steps.firstStep"
                : "steps.review",
          )}
        </h2>
        <div className="mt-3 flex gap-2" aria-hidden="true">
          {[1, 2, 3].map((number) => (
            <span
              key={number}
              className={`h-1.5 flex-1 rounded-full ${number <= visibleStep ? "bg-brand-600" : "bg-bg-subtle"}`}
            />
          ))}
        </div>
      </div>

      {attempt && !pending ? (
        <div role="status" className="mb-5 rounded-lg bg-brand-50 p-4 text-small text-brand-800">
          <p className="font-semibold">{t("retryNoticeTitle")}</p>
          <p className="mt-1">{t("retryNoticeDescription")}</p>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-5">
        {visibleStep === 1 ? (
          <div className="space-y-4">
            {starterPack ? (
              <p className="rounded-lg bg-brand-50 p-3 text-small text-brand-800">
                {t(`starter.packs.${starterPack}.badge`)}
              </p>
            ) : null}
            <div>
              <label htmlFor="wizard-goal-title" className="mb-1 block text-small font-medium">
                {t("goalTitle")}
              </label>
              <input
                ref={(element) => {
                  fieldRefs.current.goalTitle = element;
                }}
                id="wizard-goal-title"
                value={visibleTitle}
                onChange={(event) => {
                  setTitle(event.target.value);
                  clearInvalidField("goalTitle");
                }}
                maxLength={120}
                aria-invalid={invalidField === "goalTitle"}
                aria-describedby={
                  invalidField === "goalTitle" ? "wizard-goal-title-error" : undefined
                }
                disabled={locked}
                className="h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-small text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                placeholder={t("goalTitlePlaceholder")}
              />
              {invalidField === "goalTitle" ? (
                <p
                  id="wizard-goal-title-error"
                  role="alert"
                  className="mt-1 text-caption text-danger-800"
                >
                  {fieldErrorMessage("goalTitle")}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="wizard-goal-domain" className="mb-1 block text-small font-medium">
                {t("domain")}
              </label>
              <select
                id="wizard-goal-domain"
                value={visibleDomain}
                onChange={(event) => setDomain(event.target.value as Domain)}
                disabled={locked}
                className="h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-small text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {DOMAINS.map((value) => (
                  <option key={value} value={value}>
                    {td(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wizard-goal-period" className="mb-1 block text-small font-medium">
                  {t("period")}
                </label>
                <select
                  id="wizard-goal-period"
                  value={visiblePeriodType}
                  onChange={(event) => {
                    const next = event.target.value as PeriodType;
                    setPeriodType(next);
                    const current = attempt?.spec.periodStart ?? periodStart;
                    setPeriodStart(current ? normalizePeriodStart(next, current as ISODate) : "");
                    clearInvalidField("periodStart");
                  }}
                  disabled={locked}
                  className="h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-small text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {PERIOD_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {tp(value)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wizard-period-start" className="mb-1 block text-small font-medium">
                  {t("periodStart")}
                </label>
                <input
                  ref={(element) => {
                    fieldRefs.current.periodStart = element;
                  }}
                  id="wizard-period-start"
                  type="date"
                  value={visiblePeriodStart}
                  onChange={(event) => {
                    setPeriodStart(
                      event.target.value
                        ? normalizePeriodStart(periodType, event.target.value as ISODate)
                        : "",
                    );
                    clearInvalidField("periodStart");
                  }}
                  aria-invalid={invalidField === "periodStart"}
                  aria-describedby={
                    invalidField === "periodStart" ? "wizard-period-start-error" : undefined
                  }
                  disabled={locked}
                  className="h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-small text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                />
                {invalidField === "periodStart" ? (
                  <p
                    id="wizard-period-start-error"
                    role="alert"
                    className="mt-1 text-caption text-danger-800"
                  >
                    {fieldErrorMessage("periodStart")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {visibleStep === 2 ? (
          <div className="space-y-4">
            <p className="text-small text-text-secondary">{t("firstStepDescription")}</p>
            <div>
              <label htmlFor="wizard-first-step" className="mb-1 block text-small font-medium">
                {t("firstStep")}
              </label>
              <input
                ref={(element) => {
                  fieldRefs.current.firstStep = element;
                }}
                id="wizard-first-step"
                value={visibleFirstStepTitle}
                onChange={(event) => {
                  setFirstStepTitle(event.target.value);
                  clearInvalidField("firstStep");
                }}
                maxLength={200}
                aria-invalid={invalidField === "firstStep"}
                aria-describedby={
                  invalidField === "firstStep" ? "wizard-first-step-error" : undefined
                }
                disabled={locked}
                className="h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-small text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                placeholder={t("firstStepPlaceholder")}
              />
              {invalidField === "firstStep" ? (
                <p
                  id="wizard-first-step-error"
                  role="alert"
                  className="mt-1 text-caption text-danger-800"
                >
                  {fieldErrorMessage("firstStep")}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="wizard-first-step-date" className="mb-1 block text-small font-medium">
                {t("dueDate")}
              </label>
              <input
                ref={(element) => {
                  fieldRefs.current.dueDate = element;
                }}
                id="wizard-first-step-date"
                type="date"
                value={visibleDueDate}
                onChange={(event) => {
                  setDueDate(event.target.value);
                  clearInvalidField("dueDate");
                }}
                aria-invalid={invalidField === "dueDate"}
                aria-describedby={
                  invalidField === "dueDate" ? "wizard-first-step-date-error" : undefined
                }
                disabled={locked}
                className="h-11 w-full rounded-lg border border-border bg-bg-surface px-3 text-small text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
              {invalidField === "dueDate" ? (
                <p
                  id="wizard-first-step-date-error"
                  role="alert"
                  className="mt-1 text-caption text-danger-800"
                >
                  {fieldErrorMessage("dueDate")}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {visibleStep === 3 ? (
          <div className="space-y-4">
            <p className="text-small text-text-secondary">{t("reviewDescription")}</p>
            <div className="rounded-xl border border-border bg-bg-subtle p-4">
              <p className="text-caption font-semibold text-text-secondary">{t("goalLabel")}</p>
              <p className="mt-1 text-small font-semibold text-text-primary">
                {visibleTitle.trim()}
              </p>
              <p className="mt-1 text-caption text-text-secondary">
                {td(visibleDomain)} · {tp(visiblePeriodType)} · {visiblePeriodStart}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-bg-subtle p-4">
              <p className="text-caption font-semibold text-text-secondary">
                {t("firstStepLabel")}
              </p>
              <p className="mt-1 text-small font-semibold text-text-primary">
                {visibleFirstStepTitle.trim()}
              </p>
              <p className="mt-1 text-caption text-text-secondary">
                {t("dueDateSummary", {
                  date: formatDate(visibleDueDate as ISODate, "medium", locale),
                })}
              </p>
            </div>
            <p className="rounded-lg bg-brand-50 p-3 text-small text-brand-800">
              {t("willCreate")}
            </p>
            {!attempt ? (
              <p className="text-caption text-text-secondary">{t("nothingSavedUntilConfirm")}</p>
            ) : null}
          </div>
        ) : null}

        {storageUnavailable ? (
          <p role="alert" className="text-small text-danger-800">
            {attemptSnapshot.status === "unavailable"
              ? t("retryStorageUnavailable")
              : t("storageUnavailable")}
          </p>
        ) : null}
        {storageInvalid ? (
          <p role="alert" className="text-small text-danger-800">
            {t("storageInvalid")}
          </p>
        ) : null}
        {failure ? (
          <p role="alert" aria-live="polite" className="text-small text-danger-800">
            {failure === "conflict" ? t("idempotencyConflict") : t("saveFailure")}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={visibleStep === 1 || locked}
          >
            {t("back")}
          </Button>
          {attempt ? (
            <Button type="button" onClick={retry} disabled={pending || storageUnavailable}>
              {pending ? t("saving") : t("retry")}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={pending || restoring || storageUnavailable || storageInvalid}
            >
              {pending ? t("saving") : step < 3 ? t("continue") : t("confirm")}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
