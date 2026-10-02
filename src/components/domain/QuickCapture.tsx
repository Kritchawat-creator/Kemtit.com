"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { confirmQuickCapture } from "@/core/capture/actions";
import { buildConfirmCapturePayload } from "@/core/capture/confirm-payload";
import type { CaptureSmartDefaults } from "@/core/capture/defaults";
import {
  prepareCapture,
  SUPPORTED_CAPTURE_KINDS,
  type CaptureProposal,
  type SupportedCaptureKind,
} from "@/core/capture/parse";
import type { Domain } from "@/core/domain/domains";
import type { AppLocale } from "@/i18n/config";
import { formatDate, formatNumber, formatTHB } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/domain/DatePicker";
import { DomainSelect } from "@/components/domain/DomainSelect";

type Props = {
  today: string;
  preferredDomain: Domain;
  smartDefaults: CaptureSmartDefaults;
  onDone: () => void;
};

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];
type ProposalEdits = Partial<Omit<CaptureProposal, "kind" | "supported">>;
type EditableProposalField = keyof ProposalEdits;

function PreviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <dt className="min-w-0 flex-1 text-caption text-text-secondary">{label}</dt>
      <dd className="min-w-0 max-w-[60%] break-words text-right text-caption font-medium text-text-primary">
        {value}
      </dd>
    </div>
  );
}

export function QuickCapture({ today, preferredDomain, smartDefaults, onDone }: Props) {
  const t = useTranslations();
  const td = useTranslations("domains");
  const te = useTranslations("errors");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [input, setInput] = useState("");
  const [manualKind, setManualKind] = useState<SupportedCaptureKind | null>(null);
  const [edits, setEdits] = useState<ProposalEdits>({});
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submittingRef = useRef(false);

  const detectedProposal = useMemo(() => {
    if (!input.trim()) return null;
    return prepareCapture(input, today, manualKind ?? undefined, preferredDomain, {
      taskEstimatedMinutes: smartDefaults.taskEstimatedMinutes,
      habitCadence: smartDefaults.habitCadence,
      habitTargetPerWeek: smartDefaults.habitTargetPerWeek,
    });
  }, [
    input,
    today,
    manualKind,
    preferredDomain,
    smartDefaults.taskEstimatedMinutes,
    smartDefaults.habitCadence,
    smartDefaults.habitTargetPerWeek,
  ]);

  const proposal = detectedProposal ? { ...detectedProposal, ...edits } : null;
  const titleLimit =
    proposal?.kind === "goal" ? 120 : proposal?.kind === "habit" ? 160 : 200;
  const titleInvalid =
    proposal !== null &&
    (!proposal.title.trim() || proposal.title.trim().length > titleLimit);
  const titleErrorKey =
    proposal && !proposal.title.trim()
      ? "required"
      : proposal && proposal.title.trim().length > titleLimit
        ? "tooLong"
        : null;
  const titleError = titleErrorKey ? te(titleErrorKey as ErrorKey) : null;
  const expenseMissingAmount =
    proposal?.kind === "expense" && (proposal.amount === null || proposal.amount <= 0);
  const hasDomain =
    proposal?.kind === "task" || proposal?.kind === "habit" || proposal?.kind === "goal";
  const hasDate =
    proposal?.kind === "task" ||
    proposal?.kind === "event" ||
    proposal?.kind === "bill" ||
    proposal?.kind === "expense";

  function resetIntent() {
    setRequestId(null);
    setError(null);
  }

  function changeInput(nextInput: string) {
    if (nextInput !== input) {
      setManualKind(null);
      setEdits({});
      resetIntent();
    }
    setInput(nextInput);
  }

  function changeKind(kind: SupportedCaptureKind) {
    if (kind === proposal?.kind) return;
    setManualKind(kind);
    setEdits({});
    resetIntent();
  }

  function updateProposal<Key extends EditableProposalField>(
    field: Key,
    value: ProposalEdits[Key],
  ) {
    setEdits((current) => ({ ...current, [field]: value }));
    resetIntent();
  }

  function confirm() {
    if (
      submittingRef.current ||
      !proposal?.supported ||
      titleInvalid ||
      expenseMissingAmount
    ) {
      return;
    }

    const nextRequestId = requestId ?? crypto.randomUUID();
    const payload = buildConfirmCapturePayload(proposal, nextRequestId, today);
    if (!payload) {
      setError("positive");
      return;
    }

    submittingRef.current = true;
    if (!requestId) setRequestId(nextRequestId);
    setError(null);

    startTransition(async () => {
      try {
        const result = await confirmQuickCapture(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        router.refresh();
        onDone();
      } catch {
        setError("generic");
      } finally {
        submittingRef.current = false;
      }
    });
  }

  const previewDetails: Array<{ label: string; value: string }> = [];
  if (proposal && hasDomain) {
    previewDetails.push({ label: t("capture.domain"), value: td(proposal.domain) });
  }
  if (proposal && hasDate) {
    const dateLabel =
      proposal.kind === "bill"
        ? t("capture.dueDate")
        : proposal.kind === "expense"
          ? t("capture.occurredOn")
          : t("capture.when");
    previewDetails.push({
      label: dateLabel,
      value: proposal.dueDate ? formatDate(proposal.dueDate, "medium", locale) : "—",
    });
  }
  if (proposal?.kind === "goal") {
    previewDetails.push({
      label: t("capture.goalMonth"),
      value: formatDate(proposal.periodStart ?? today, "monthYear", locale),
    });
  }
  if (proposal?.kind === "task") {
    previewDetails.push({
      label: t("capture.estimatedMinutes"),
      value:
        proposal.estimatedMinutes === null
          ? t("capture.estimatedMinutesOptional")
          : formatNumber(proposal.estimatedMinutes, locale),
    });
  }
  if (proposal?.kind === "habit") {
    previewDetails.push(
      {
        label: t("capture.repeat"),
        value: proposal.cadence ? t(`capture.cadence.${proposal.cadence}`) : "—",
      },
      {
        label: t("capture.targetPerWeek"),
        value: formatNumber(proposal.targetPerWeek ?? 1, locale),
      },
    );
  }
  if (proposal?.kind === "bill") {
    previewDetails.push({
      label: t("capture.billRecurrence"),
      value: t(`capture.billRecurrenceOptions.${proposal.recurrence ?? "none"}`),
    });
  }
  if (proposal?.kind === "bill") {
    previewDetails.push({
      label: t("capture.billAmount"),
      value:
        proposal.amount === null
          ? t("capture.amountOptional")
          : formatTHB(proposal.amount, locale),
    });
  }

  return (
    <form
      className="space-y-3 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        confirm();
      }}
    >
      <div className="rounded-xl border border-border bg-bg-subtle p-4">
        <label htmlFor="quick-capture-input" className="text-small font-medium text-text-primary">
          {t("capture.prompt")}
        </label>
        <Input
          id="quick-capture-input"
          value={input}
          onChange={(event) => changeInput(event.target.value)}
          placeholder={t("capture.placeholder")}
          disabled={pending}
          className="mt-2 bg-bg-surface"
        />
        <p className="mt-2 text-caption text-text-secondary">{t("capture.hint")}</p>
      </div>

      {proposal ? (
        <>
          <section
            aria-label={t("capture.livePreview")}
            className="rounded-xl border border-border bg-bg-surface p-4 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-caption font-medium text-text-secondary">
                {t("capture.livePreview")}
              </h2>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-800">
                {t(`capture.types.${proposal.kind}`)}
              </span>
            </div>
            <p className="mt-3 break-words text-small font-semibold text-text-primary">
              {proposal.title || "—"}
            </p>
            <dl className="mt-2">
              {previewDetails.map(({ label, value }, index) => (
                <PreviewDetail key={`${label}-${index}`} label={label} value={value} />
              ))}
            </dl>
            {proposal.kind === "task" && smartDefaults.taskEstimatedMinutes ? (
              <p className="mt-2 text-caption text-text-secondary">
                {t("capture.historyDefaultHint")}
              </p>
            ) : null}
            {titleError ? (
              <p role="alert" className="mt-3 text-caption text-danger-800">
                {titleError}
              </p>
            ) : null}
            {proposal.kind === "expense" ? (
              <div className="mt-3">
                <label
                  htmlFor="quick-capture-amount"
                  className="block text-caption font-medium text-text-secondary"
                >
                  {t("capture.expenseAmount")}
                </label>
                <Input
                  id="quick-capture-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={proposal.amount ?? ""}
                  placeholder={t("capture.expenseAmountPlaceholder")}
                  disabled={pending}
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    const amount = rawValue === "" ? null : Number(rawValue);
                    updateProposal(
                      "amount",
                      amount !== null && Number.isFinite(amount) ? amount : null,
                    );
                  }}
                  className="mt-1"
                />
              </div>
            ) : null}
            {expenseMissingAmount ? (
              <p role="alert" className="mt-3 text-caption text-danger-800">
                {t("capture.expenseAmountRequired")}
              </p>
            ) : null}
            {!proposal.supported ? (
              <p role="alert" className="mt-3 text-caption text-danger-800">
                {t("capture.unsupportedDescription", {
                  type: t(`capture.types.${proposal.kind}`),
                })}
              </p>
            ) : null}
          </section>

          <details className="rounded-lg border border-border bg-bg-surface">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-caption font-medium text-text-secondary hover:text-brand-600 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none">
              {t("capture.editDetails")}
            </summary>
            <div className="space-y-4 border-t border-border px-3 py-3">
              <p className="text-caption text-text-secondary">{t("capture.smartDefaultsHint")}</p>
              <div>
                <label
                  htmlFor="quick-capture-type"
                  className="mb-2 block text-caption font-medium text-text-secondary"
                >
                  {t("capture.typeField")}
                </label>
                <select
                  id="quick-capture-type"
                  value={proposal.kind}
                  disabled={pending}
                  onChange={(event) =>
                    changeKind(event.target.value as SupportedCaptureKind)
                  }
                  className="h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
                >
                  {SUPPORTED_CAPTURE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`capture.types.${kind}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="quick-capture-title"
                  className="block text-caption font-medium text-text-secondary"
                >
                  {t("capture.titleField")}
                </label>
                <Input
                  id="quick-capture-title"
                  value={proposal.title}
                  maxLength={titleLimit}
                  disabled={pending}
                  onChange={(event) => updateProposal("title", event.target.value)}
                  className="mt-1"
                />
              </div>

              {hasDomain ? (
                <div>
                  <p className="mb-2 text-caption font-medium text-text-secondary">
                    {t("capture.domain")}
                  </p>
                  <DomainSelect
                    value={proposal.domain}
                    disabled={pending}
                    onValueChange={(domain) => updateProposal("domain", domain)}
                  />
                </div>
              ) : null}

              {hasDate ? (
                <div>
                  <label
                    htmlFor="quick-capture-date"
                    className="block text-caption font-medium text-text-secondary"
                  >
                    {proposal.kind === "bill"
                      ? t("capture.dueDate")
                      : proposal.kind === "expense"
                        ? t("capture.occurredOn")
                        : t("capture.when")}
                  </label>
                  <div className="mt-1">
                    <DatePicker
                      id="quick-capture-date"
                      value={proposal.dueDate ?? today}
                      disabled={pending}
                      onChange={(next) => updateProposal("dueDate", next ?? today)}
                    />
                  </div>
                </div>
              ) : null}

              {proposal.kind === "goal" ? (
                <div>
                  <label
                    htmlFor="quick-capture-period"
                    className="block text-caption font-medium text-text-secondary"
                  >
                    {t("capture.goalMonth")}
                  </label>
                  <div className="mt-1">
                    <DatePicker
                      id="quick-capture-period"
                      value={proposal.periodStart ?? today}
                      disabled={pending}
                      onChange={(next) => updateProposal("periodStart", next ?? today)}
                    />
                  </div>
                </div>
              ) : null}

              {proposal.kind === "task" ? (
                <div>
                  <label
                    htmlFor="quick-capture-estimate"
                    className="block text-caption font-medium text-text-secondary"
                  >
                    {t("capture.estimatedMinutes")}
                  </label>
                  <Input
                    id="quick-capture-estimate"
                    type="number"
                    min="1"
                    max="1440"
                    value={proposal.estimatedMinutes ?? ""}
                    placeholder={t("capture.estimatedMinutesOptional")}
                    disabled={pending}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateProposal(
                        "estimatedMinutes",
                        value === "" ? null : Math.max(1, Math.min(1440, Number(value) || 1)),
                      );
                    }}
                    className="mt-1"
                  />
                  {smartDefaults.taskEstimatedMinutes ? (
                    <p className="mt-1 text-caption text-text-muted">
                      {t("capture.historyDefaultHint")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {proposal.kind === "habit" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="quick-capture-cadence"
                      className="block text-caption font-medium text-text-secondary"
                    >
                      {t("capture.repeat")}
                    </label>
                    <select
                      id="quick-capture-cadence"
                      value={proposal.cadence ?? "daily"}
                      disabled={pending}
                      onChange={(event) => {
                        const cadence = event.target.value as "daily" | "weekly";
                        updateProposal("cadence", cadence);
                        if (proposal.targetPerWeek === null) {
                          updateProposal("targetPerWeek", cadence === "daily" ? 7 : 3);
                        }
                      }}
                      className="mt-1 h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
                    >
                      <option value="daily">{t("capture.cadence.daily")}</option>
                      <option value="weekly">{t("capture.cadence.weekly")}</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="quick-capture-target"
                      className="block text-caption font-medium text-text-secondary"
                    >
                      {t("capture.targetPerWeek")}
                    </label>
                    <Input
                      id="quick-capture-target"
                      type="number"
                      min="1"
                      max="7"
                      value={proposal.targetPerWeek ?? 1}
                      disabled={pending}
                      onChange={(event) => {
                        const value = Math.max(1, Math.min(7, Number(event.target.value) || 1));
                        updateProposal("targetPerWeek", value);
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : null}

              {proposal.kind === "bill" ? (
                <div>
                  <label
                    htmlFor="quick-capture-bill-recurrence"
                    className="block text-caption font-medium text-text-secondary"
                  >
                    {t("capture.billRecurrence")}
                  </label>
                  <select
                    id="quick-capture-bill-recurrence"
                    value={proposal.recurrence ?? "none"}
                    disabled={pending}
                    onChange={(event) =>
                      updateProposal("recurrence", event.target.value as "none" | "monthly")
                    }
                    className="mt-1 h-11 w-full rounded-md border border-border bg-bg-surface px-3.5 text-base text-text-primary shadow-xs outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/10"
                  >
                    <option value="none">{t("capture.billRecurrenceOptions.none")}</option>
                    <option value="monthly">{t("capture.billRecurrenceOptions.monthly")}</option>
                  </select>
                </div>
              ) : null}

              {proposal.kind === "bill" ? (
                <div>
                  <label
                    htmlFor="quick-capture-amount"
                    className="block text-caption font-medium text-text-secondary"
                  >
                    {t("capture.billAmount")}
                  </label>
                  <Input
                    id="quick-capture-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={proposal.amount ?? ""}
                    placeholder={t("capture.amountOptional")}
                    disabled={pending}
                    onChange={(event) => {
                      const rawValue = event.target.value;
                      const amount = rawValue === "" ? null : Number(rawValue);
                      updateProposal(
                        "amount",
                        amount !== null && Number.isFinite(amount) ? amount : null,
                      );
                    }}
                    className="mt-1"
                  />
                  {expenseMissingAmount ? (
                    <p className="mt-1 text-caption text-danger-800">
                      {t("capture.expenseAmountRequired")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </details>
        </>
      ) : null}

      {error ? (
        <p role="alert" aria-live="polite" className="text-small text-danger-800">
          {te.has(error as ErrorKey) ? te(error as ErrorKey) : te("generic")}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={
          pending ||
          !proposal?.supported ||
          !proposal.title.trim() ||
          proposal.title.trim().length > titleLimit ||
          expenseMissingAmount
        }
      >
        <Sparkles aria-hidden="true" />
        {pending ? t("common.saving") : t("capture.save")}
      </Button>
    </form>
  );
}
