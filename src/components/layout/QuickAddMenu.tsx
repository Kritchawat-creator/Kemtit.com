"use client";

import { Command, Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

type Props = { variant?: "button" | "fab" | "command" | "sidebar"; className?: string };

/**
 * Universal creation entry point.
 * - button: normal action button
 * - fab: mobile capture action
 * - command: Prototype-style command bar that opens Quick Capture
 */
export function QuickAddMenu({ variant = "button", className }: Props) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  const openCapture = useCallback(() => {
    const next = new URLSearchParams(window.location.search);
    next.set("capture", "1");
    for (const key of [
      "new",
      "parent",
      "goal",
      "domain",
      "goalKind",
      "unit",
      "periodType",
      "periodStart",
      "project",
    ]) {
      next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (variant !== "command") return;

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCapture();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCapture, variant]);

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={openCapture}
        aria-label={t("a11y.openQuickAdd")}
        className={cn(
          "box-border grid w-full min-w-0 max-w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-dashed border-brand-200 bg-brand-50/70 p-2 text-left transition-[border-color,background-color,box-shadow] hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-[3px] focus-visible:ring-brand-500/10 focus-visible:outline-none",
          className,
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-brand-500 text-neutral-0">
          <Plus className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-small font-semibold text-text-primary">
            {t("capture.title")}
          </strong>
          <small className="mt-0.5 block truncate text-[11px] text-text-secondary">
            {t("capture.description")}
          </small>
        </span>
        <kbd className="rounded-sm border border-border bg-bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
          ⌘K
        </kbd>
      </button>
    );
  }

  if (variant === "command") {
    return (
      <button
        type="button"
        onClick={openCapture}
        aria-label={t("a11y.openQuickAdd")}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2.5 rounded-md border border-border bg-bg-surface px-3 text-left text-small text-text-secondary shadow-xs transition-[border-color,box-shadow,background-color] hover:border-border-strong hover:bg-bg-subtle focus-visible:border-brand-500 focus-visible:ring-[3px] focus-visible:ring-brand-500/10 focus-visible:outline-none",
          className,
        )}
      >
        <Sparkles className="size-4 shrink-0 text-brand-600" strokeWidth={1.7} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t("capture.placeholder")}</span>
        <kbd className="hidden shrink-0 items-center gap-1 rounded-sm border border-border bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:inline-flex">
          <Command className="size-2.5" aria-hidden="true" />K
        </kbd>
      </button>
    );
  }

  return (
    <Button
      type="button"
      size={variant === "fab" ? "icon-lg" : "default"}
      onClick={openCapture}
      aria-label={variant === "fab" ? t("a11y.openQuickAdd") : undefined}
      className={cn(
        variant === "fab"
          ? "size-14 rounded-xl bg-brand-500 text-neutral-0 shadow-fab hover:bg-brand-600 active:bg-brand-700"
          : undefined,
        className,
      )}
    >
      <Plus
        className={variant === "fab" ? "size-[26px]" : undefined}
        strokeWidth={variant === "fab" ? 1.75 : undefined}
        aria-hidden="true"
      />
      {variant === "button" ? t("nav.quickAdd") : null}
    </Button>
  );
}
