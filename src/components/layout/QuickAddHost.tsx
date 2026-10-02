"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";

import type { CaptureSmartDefaults } from "@/core/capture/defaults";
import { DOMAINS, type Domain } from "@/core/domain/domains";
import {
  childPeriodType,
  PERIOD_TYPES,
  periodContains,
  periodOf,
  type PeriodType,
} from "@/core/domain/periods";
import type { EntryGoalOption } from "@/core/entries/schema";
import type { ParentCandidate } from "@/core/goals/schema";
import type { GoalFormValues } from "@/core/goals/schema";
import { isISODate, todayBkk } from "@/lib/date";
import { ConfirmSheet } from "@/components/domain/ConfirmSheet";
import { EntryForm } from "@/components/domain/EntryForm";
import { GoalForm } from "@/components/domain/GoalForm";
import { QuickCapture } from "@/components/domain/QuickCapture";
import { TaskForm } from "@/components/domain/TaskForm";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type Props = {
  parentCandidates: ParentCandidate[];
  preferredCaptureDomain: Domain;
  captureSmartDefaults: CaptureSmartDefaults;
  /** เป้า metric ที่บันทึกยอดได้ (Claude Design turn 6/7) — ว่างได้ ฟอร์มจะชวนไปตั้งเป้าก่อน */
  entryGoals: EntryGoalOption[];
  projectOptions: { id: string; title: string }[];
};

/**
 * อ่าน `?new=goal|task` (+ `parent`, `goal`, `date`) แล้ว render ฟอร์มใน Sheet/Dialog จุดเดียวทั้งแอป
 * ปิด = ลบ query ออกจาก URL (ไม่เปลี่ยนหน้า)
 */
export function QuickAddHost({
  parentCandidates,
  preferredCaptureDomain,
  captureSmartDefaults,
  entryGoals,
  projectOptions,
}: Props) {
  const t = useTranslations();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const capture = params.get("capture") === "1";
  const contextualCaptureDomain: Domain = pathname.startsWith("/finance")
    ? "finance"
    : pathname.startsWith("/work")
      ? "work"
      : captureSmartDefaults.preferredDomain || preferredCaptureDomain;
  const kind = params.get("new");
  const requestedDomain = params.get("domain");
  const requestedGoalKind = params.get("goalKind");
  const requestedUnit = params.get("unit");
  const requestedPeriodType = params.get("periodType");
  const requestedPeriodStart = params.get("periodStart");
  const requestedProject = params.get("project");
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openLocationRef = useRef<string | null>(null);
  const shouldRestoreFocusRef = useRef(false);

  const rememberFocus = useCallback(() => {
    const activeElement = document.activeElement;
    openLocationRef.current = `${window.location.pathname}${window.location.search}`;
    returnFocusRef.current =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    shouldRestoreFocusRef.current = false;
  }, []);

  const restoreFocus = useCallback((event: Event) => {
    const returnFocusTarget = returnFocusRef.current;
    returnFocusRef.current = null;
    const hostInitiatedClose = shouldRestoreFocusRef.current;
    shouldRestoreFocusRef.current = false;

    const routeChanged =
      openLocationRef.current !== null &&
      openLocationRef.current !== `${window.location.pathname}${window.location.search}`;
    openLocationRef.current = null;
    if (!hostInitiatedClose) {
      if (routeChanged) event.preventDefault();
      return;
    }

    const activeElement = document.activeElement;
    const closingDialog = event.target instanceof HTMLElement ? event.target : null;
    if (activeElement !== document.body && !closingDialog?.contains(activeElement)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    if (!returnFocusTarget?.isConnected || returnFocusTarget.matches(":disabled")) return;
    returnFocusTarget.focus({ preventScroll: true });
  }, []);

  const initialDomain =
    requestedDomain && (DOMAINS as readonly string[]).includes(requestedDomain)
      ? (requestedDomain as Domain)
      : undefined;
  const initialGoalKind: GoalFormValues["goalKind"] | undefined =
    requestedGoalKind === "metric" || requestedGoalKind === "execution"
      ? requestedGoalKind
      : undefined;
  const requestedPeriod =
    requestedPeriodType &&
    (PERIOD_TYPES as readonly string[]).includes(requestedPeriodType) &&
    requestedPeriodStart &&
    isISODate(requestedPeriodStart)
      ? {
          periodType: requestedPeriodType as PeriodType,
          periodStart: requestedPeriodStart,
        }
      : undefined;
  const standaloneGoalInitial =
    initialDomain || initialGoalKind || requestedUnit || requestedPeriod
      ? {
          ...(initialDomain ? { domain: initialDomain } : {}),
          ...(initialGoalKind ? { goalKind: initialGoalKind } : {}),
          ...(requestedUnit ? { unit: requestedUnit } : {}),
          ...(requestedPeriod ?? {}),
        }
      : undefined;

  const close = useCallback(() => {
    shouldRestoreFocusRef.current = true;
    const next = new URLSearchParams(params);

    if (capture) {
      // Universal Capture must preserve the page's own state, e.g. Planner view/date.
      next.delete("capture");
    } else {
      // Contextual create forms own these query parameters.
      next.delete("new");
      next.delete("parent");
      next.delete("goal");
      // date is host-page state (Planner/Calendar) and may also seed TaskForm.
      // Preserve it so closing the form keeps the same period/day visible.
      next.delete("domain");
      next.delete("goalKind");
      next.delete("unit");
      next.delete("periodType");
      next.delete("periodStart");
      next.delete("project");
    }

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [capture, params, pathname, router]);

  if (capture) {
    return (
      <ConfirmSheet
        open
        onOpenChange={(open) => !open && close()}
        title={t("capture.title")}
        description={t("capture.description")}
        onOpenAutoFocus={rememberFocus}
        onCloseAutoFocus={restoreFocus}
      >
        <QuickCapture
          today={todayBkk()}
          preferredDomain={contextualCaptureDomain}
          smartDefaults={captureSmartDefaults}
          onDone={close}
        />
      </ConfirmSheet>
    );
  }

  if (kind === "goal") {
    const parent = parentCandidates.find((c) => c.id === params.get("parent"));
    const childType = parent ? childPeriodType(parent.period_type) : null;
    // ช่วงเริ่มต้นของเป้าย่อย: ช่วงปัจจุบันถ้าวันนี้อยู่ในช่วงแม่ (ช่วงแรกของเดือนอาจผ่านไปแล้ว) ไม่งั้นช่วงแรกของแม่
    const today = todayBkk();
    const childStart =
      parent && childType
        ? periodContains(periodOf(parent.period_type, parent.period_start), today)
          ? periodOf(childType, today).start
          : periodOf(childType, parent.period_start).start
        : undefined;
    return (
      <ResponsiveDialog
        open
        onOpenChange={(open) => !open && close()}
        title={t("goals.new")}
        onOpenAutoFocus={rememberFocus}
        onCloseAutoFocus={restoreFocus}
      >
        <GoalForm
          mode="create"
          parentCandidates={parentCandidates}
          initial={
            parent && childType && childStart
              ? {
                  parentId: parent.id,
                  periodType: childType,
                  periodStart: childStart,
                  domain: parent.domain,
                }
              : standaloneGoalInitial
          }
          onDone={close}
        />
      </ResponsiveDialog>
    );
  }

  if (kind === "entry") {
    const goalId = params.get("goal");
    const preselected = entryGoals.find((g) => g.id === goalId)?.id ?? entryGoals[0]?.id;
    return (
      <ResponsiveDialog
        open
        onOpenChange={(open) => !open && close()}
        title={t("entries.new")}
        onOpenAutoFocus={rememberFocus}
        onCloseAutoFocus={restoreFocus}
      >
        <EntryForm
          mode="create"
          goalOptions={entryGoals}
          initial={preselected ? { goalId: preselected } : undefined}
          onDone={close}
        />
      </ResponsiveDialog>
    );
  }

  if (kind === "task") {
    const goal = parentCandidates.find((c) => c.id === params.get("goal"));
    const date = params.get("date");
    return (
      <ResponsiveDialog
        open
        onOpenChange={(open) => !open && close()}
        title={t("tasks.new")}
        onOpenAutoFocus={rememberFocus}
        onCloseAutoFocus={restoreFocus}
      >
        <TaskForm
          mode="create"
          goalOptions={parentCandidates}
          projectOptions={projectOptions}
          initial={{
            goalId: goal?.id ?? null,
            projectId: projectOptions.some((project) => project.id === requestedProject)
              ? requestedProject
              : null,
            domain: goal?.domain ?? "work",
            dueDate: date && isISODate(date) ? date : todayBkk(),
          }}
          onDone={close}
        />
      </ResponsiveDialog>
    );
  }

  return null;
}
