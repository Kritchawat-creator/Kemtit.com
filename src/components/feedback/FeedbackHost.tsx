"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { submitFeedback } from "@/core/feedback/actions";
import { feedbackTopicCodes, type FeedbackTopicCode } from "@/core/feedback/topics";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type PendingFeedback = { requestId: string; topicCode: FeedbackTopicCode };
type FeedbackStatus = "editing" | "submitting" | "uncertain" | "success";
type FeedbackErrorKey =
  | "feedback.errors.outcomeUnknown"
  | "feedback.errors.requestConflict"
  | "feedback.errors.validation"
  | "feedback.errors.unauthorized"
  | "feedback.errors.feedbackRateLimited"
  | "feedback.errors.storageUnavailable"
  | "feedback.errors.recoveryUnavailable";

type FeedbackHostContextValue = {
  openFeedback: (trigger?: HTMLElement | null) => void;
};

const FeedbackHostContext = createContext<FeedbackHostContextValue | null>(null);

function isFeedbackTopic(value: unknown): value is FeedbackTopicCode {
  return typeof value === "string" && (feedbackTopicCodes as readonly string[]).includes(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function storageKey(userId: string) {
  return `kemtit:pending-feedback:v1:${userId}`;
}

type RestoredPendingFeedback =
  { state: "empty" } | { state: "pending"; request: PendingFeedback } | { state: "blocked" };

function readPendingFeedback(userId: string): RestoredPendingFeedback {
  if (typeof window === "undefined") return { state: "empty" };

  try {
    const saved = window.sessionStorage.getItem(storageKey(userId));
    if (!saved) return { state: "empty" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(saved);
    } catch {
      return { state: "blocked" };
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !isUuid((parsed as Record<string, unknown>).requestId) ||
      !isFeedbackTopic((parsed as Record<string, unknown>).topicCode)
    ) {
      return { state: "blocked" };
    }
    return {
      state: "pending",
      request: {
        requestId: (parsed as PendingFeedback).requestId,
        topicCode: (parsed as PendingFeedback).topicCode,
      },
    };
  } catch {
    return { state: "blocked" };
  }
}

function persistPendingFeedback(userId: string, pending: PendingFeedback): boolean {
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

function clearPendingFeedback(userId: string) {
  try {
    window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // The in-memory state still protects retries if browser storage becomes unavailable.
  }
}

function hasOpenQuickAdd(search: string) {
  const params = new URLSearchParams(search);
  return params.get("capture") === "1" || params.has("new");
}

function FeedbackDialogSurface({
  open,
  onOpenChange,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onQuickAddActive,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAutoFocus: (event: Event) => void;
  onCloseAutoFocus: (event: Event) => void;
  onQuickAddActive: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const quickAddActive = searchParams.get("capture") === "1" || searchParams.has("new");

  useEffect(() => {
    if (quickAddActive) onQuickAddActive();
  }, [onQuickAddActive, quickAddActive]);

  return (
    <ResponsiveDialog
      open={open && !quickAddActive}
      onOpenChange={onOpenChange}
      onOpenAutoFocus={onOpenAutoFocus}
      title={title}
      description={description}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {children}
    </ResponsiveDialog>
  );
}

export function useFeedbackHost() {
  const context = useContext(FeedbackHostContext);
  if (!context) throw new Error("useFeedbackHost must be used within FeedbackHost");
  return context;
}

export function FeedbackHost({
  userId,
  children,
}: {
  /** Verified server session identity, used only to scope this tab's retry record. */
  userId: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const [restoredPending] = useState(() => readPendingFeedback(userId));
  const [pendingRequest, setPendingRequest] = useState<PendingFeedback | null>(() =>
    restoredPending.state === "pending" ? restoredPending.request : null,
  );
  const [storageBlocked] = useState(() => restoredPending.state === "blocked");
  const [selectedTopic, setSelectedTopic] = useState<FeedbackTopicCode | null>(() =>
    restoredPending.state === "pending" ? restoredPending.request.topicCode : null,
  );
  const [status, setStatus] = useState<FeedbackStatus>(() =>
    restoredPending.state === "empty" ? "editing" : "uncertain",
  );
  const [errorKey, setErrorKey] = useState<FeedbackErrorKey | null>(() =>
    restoredPending.state === "pending"
      ? "feedback.errors.outcomeUnknown"
      : restoredPending.state === "blocked"
        ? "feedback.errors.recoveryUnavailable"
        : null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const submittingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openedLocationRef = useRef<string | null>(null);
  const dialogHasOpenedRef = useRef(false);
  const lastDialogFocusKeyRef = useRef<string | null>(null);

  const openFeedback = useCallback((trigger?: HTMLElement | null) => {
    if (typeof window === "undefined" || hasOpenQuickAdd(window.location.search)) return;

    returnFocusRef.current =
      trigger ??
      (document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null);
    openedLocationRef.current = `${window.location.pathname}${window.location.search}`;
    isOpenRef.current = true;
    setIsOpen(true);
  }, []);

  const closeForQuickAdd = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
    returnFocusRef.current = null;
    openedLocationRef.current = null;
    dialogHasOpenedRef.current = false;
    lastDialogFocusKeyRef.current = null;
  }, []);

  const contextValue = useMemo(() => ({ openFeedback }), [openFeedback]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      isOpenRef.current = nextOpen;
      setIsOpen(nextOpen);
      if (!nextOpen && status === "success") {
        setSelectedTopic(null);
        setPendingRequest(null);
        setErrorKey(null);
        setStatus("editing");
      }
      if (!nextOpen) {
        dialogHasOpenedRef.current = false;
        lastDialogFocusKeyRef.current = null;
      }
    },
    [status],
  );

  const handleOpenAutoFocus = useCallback((event: Event) => {
    if (!dialogHasOpenedRef.current) {
      dialogHasOpenedRef.current = true;
      return;
    }

    const focusKey = lastDialogFocusKeyRef.current;
    if (!focusKey) return;

    const content = document.querySelector(
      '[data-slot="dialog-content"], [data-slot="sheet-content"]',
    );
    const target =
      content?.querySelector<HTMLElement>(`[data-feedback-focus-key="${focusKey}"]`) ??
      (focusKey === "close"
        ? content?.querySelector<HTMLElement>(
            '[data-slot="dialog-close"], [data-slot="sheet-content"] > button:last-child',
          )
        : null);
    if (!target) return;

    event.preventDefault();
    target.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function rememberFocusedControl(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest('[data-slot="dialog-content"], [data-slot="sheet-content"]')) return;

      const focusKey = target.dataset.feedbackFocusKey;
      if (focusKey) {
        lastDialogFocusKeyRef.current = focusKey;
      } else if (target.textContent?.trim() === t("common.close")) {
        lastDialogFocusKeyRef.current = "close";
      }
    }

    document.addEventListener("focusin", rememberFocusedControl);
    return () => document.removeEventListener("focusin", rememberFocusedControl);
  }, [isOpen, t]);

  const handleCloseAutoFocus = useCallback((event: Event) => {
    // ResponsiveDialog swaps Dialog and Sheet when the viewport crosses its breakpoint.
    if (isOpenRef.current) {
      event.preventDefault();
      return;
    }

    const openedLocation = openedLocationRef.current;
    const routeChanged =
      openedLocation !== null &&
      openedLocation !== `${window.location.pathname}${window.location.search}`;
    openedLocationRef.current = null;

    event.preventDefault();
    if (routeChanged) {
      returnFocusRef.current = null;
      return;
    }

    const trigger = returnFocusRef.current;
    returnFocusRef.current = null;
    if (trigger?.isConnected && !trigger.matches(":disabled")) {
      trigger.focus({ preventScroll: true });
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTopic || submittingRef.current || status === "success" || storageBlocked) return;

    const request = pendingRequest ?? {
      requestId: crypto.randomUUID(),
      topicCode: selectedTopic,
    };
    if (request.topicCode !== selectedTopic) return;

    if (!pendingRequest && !persistPendingFeedback(userId, request)) {
      setErrorKey("feedback.errors.storageUnavailable");
      return;
    }

    submittingRef.current = true;
    setPendingRequest(request);
    setStatus("submitting");
    setErrorKey(null);

    try {
      const result = await submitFeedback(request);
      if (result.ok) {
        clearPendingFeedback(userId);
        setPendingRequest(null);
        setStatus("success");
        return;
      }

      if (
        result.error === "validation" ||
        result.error === "unauthorized" ||
        result.error === "feedbackRateLimited"
      ) {
        const requestOutcomeIsResolved =
          pendingRequest === null || result.error === "feedbackRateLimited";
        if (requestOutcomeIsResolved) {
          clearPendingFeedback(userId);
          setPendingRequest(null);
          setStatus("editing");
        } else {
          // A rejected retry cannot tell us whether the earlier attempt committed.
          setStatus("uncertain");
        }
        const knownErrorKey: Record<
          "validation" | "unauthorized" | "feedbackRateLimited",
          FeedbackErrorKey
        > = {
          validation: "feedback.errors.validation",
          unauthorized: "feedback.errors.unauthorized",
          feedbackRateLimited: "feedback.errors.feedbackRateLimited",
        };
        setErrorKey(knownErrorKey[result.error]);
        return;
      }

      // A generic or conflicting response may follow a committed write. Keep the
      // exact request and choice locked so a retry can resolve it idempotently.
      setStatus("uncertain");
      setErrorKey(
        result.error === "feedbackRequestConflict"
          ? "feedback.errors.requestConflict"
          : "feedback.errors.outcomeUnknown",
      );
    } catch {
      setStatus("uncertain");
      setErrorKey("feedback.errors.outcomeUnknown");
    } finally {
      submittingRef.current = false;
    }
  }

  const isLocked = status === "submitting" || status === "uncertain" || storageBlocked;
  const dialogTitle = status === "success" ? t("feedback.thanks") : t("feedback.title");

  return (
    <FeedbackHostContext.Provider value={contextValue}>
      {children}
      <Suspense fallback={null}>
        <FeedbackDialogSurface
          open={isOpen}
          onOpenChange={handleOpenChange}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          onQuickAddActive={closeForQuickAdd}
          title={dialogTitle}
          description={
            status === "success" ? t("feedback.successDescription") : t("feedback.description")
          }
        >
          {status === "success" ? (
            <div className="space-y-5" data-testid="feedback-success">
              <p className="text-small text-text-secondary">{t("feedback.successDescription")}</p>
              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
                data-feedback-focus-key="close"
              >
                {t("common.close")}
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={submit} data-testid="feedback-form">
              <RadioGroup
                aria-label={t("feedback.topicGroupLabel")}
                value={selectedTopic ?? ""}
                onValueChange={(value) => {
                  if (!isLocked && isFeedbackTopic(value)) setSelectedTopic(value);
                }}
                disabled={isLocked}
                className="gap-2"
              >
                {feedbackTopicCodes.map((topic) => {
                  const id = `feedback-topic-${topic}`;
                  return (
                    <label
                      key={topic}
                      htmlFor={id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-small text-text-primary transition-colors hover:bg-bg-subtle has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70 has-[[data-state=checked]]:border-brand-400 has-[[data-state=checked]]:bg-brand-50"
                    >
                      <RadioGroupItem
                        id={id}
                        value={topic}
                        data-feedback-focus-key={`topic-${topic}`}
                      />
                      <span>{t(`feedback.topics.${topic}`)}</span>
                    </label>
                  );
                })}
              </RadioGroup>

              {errorKey ? (
                <p role="alert" className="text-danger-700 text-small">
                  {t(errorKey)}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={
                  !selectedTopic ||
                  status === "submitting" ||
                  (storageBlocked && status === "uncertain")
                }
                data-testid="feedback-submit"
                data-feedback-focus-key="submit"
              >
                {status === "submitting"
                  ? t("feedback.submitting")
                  : status === "uncertain"
                    ? t("feedback.retrySame")
                    : t("feedback.submit")}
              </Button>
            </form>
          )}
        </FeedbackDialogSurface>
      </Suspense>
    </FeedbackHostContext.Provider>
  );
}
