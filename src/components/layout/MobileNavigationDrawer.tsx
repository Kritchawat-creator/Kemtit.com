"use client";

import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Goal,
  HeartPulse,
  Home,
  Inbox,
  Layers3,
  ListTodo,
  Menu,
  Settings,
  WalletCards,
} from "@/components/icons/ui-icons";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";

import { BrandLogo } from "@/components/BrandLogo";
import type { WorkMode } from "@/core/profile/work-modes";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Props = { workMode: WorkMode | null; triggerVariant?: "topbar" | "bottomNav" };

export function MobileNavigationDrawer({ workMode, triggerVariant = "topbar" }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations();

  const items = [
    { label: t("nav.today"), href: "/today", icon: Home },
    { label: t("nav.inbox"), href: "/inbox", icon: Inbox },
    { label: t("nav.tasks"), href: "/tasks", icon: ListTodo },
    { label: t("nav.plan"), href: "/plan", icon: CalendarDays },
    { label: t("nav.calendar"), href: "/calendar", icon: CalendarDays },
    { label: t("nav.goals"), href: "/goals", icon: Goal },
    { label: t("nav.finance"), href: "/finance", icon: WalletCards },
    { label: t("nav.life"), href: "/life", icon: HeartPulse },
    { label: t("nav.reviews"), href: "/reviews", icon: ClipboardCheck },
    { label: t("nav.insights"), href: "/insights", icon: BarChart3 },
    ...(workMode === "professional"
      ? [{ label: t("nav.projects"), href: "/work/projects", icon: Layers3 }]
      : workMode === "seller"
        ? [{ label: t("nav.workSales"), href: "/work/sales", icon: Layers3 }]
        : []),
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {triggerVariant === "bottomNav" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("common.menu")}
          aria-expanded={open}
          className={cn(
            "flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-caption font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none focus-visible:ring-inset",
            pathname === "/today" || pathname.startsWith("/plan") || pathname.startsWith("/insights")
              ? "text-text-secondary hover:text-text-primary"
              : "text-brand-600",
          )}
        >
          <span
            className={cn(
              "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
              pathname === "/today" || pathname.startsWith("/plan") || pathname.startsWith("/insights")
                ? undefined
                : "bg-brand-50",
            )}
          >
            <Menu className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span>{t("nav.more")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("common.menu")}
          aria-expanded={open}
          className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-bg-surface text-text-secondary shadow-xs transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none min-[1151px]:hidden"
        >
          <Menu className="size-[18px]" aria-hidden="true" />
        </button>
      )}

      <SheetContent
        side="left"
        className="w-[min(320px,calc(100vw_-_24px))] gap-0 p-0"
      >
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2.5 text-text-primary">
            <BrandLogo className="size-8 shrink-0" />
            <span>
              <span className="block text-base font-bold">{t("app.name")}</span>
              <small className="block text-[10px] font-semibold tracking-[.08em] text-text-muted uppercase">
                {t("shell.personalOs")}
              </small>
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">{t("a11y.mainNav")}</SheetDescription>
        </SheetHeader>

        <div className="border-b border-border p-3">
          <div className="rounded-xl border border-border bg-bg-subtle p-2.5">
            <div className="flex items-center gap-1.5 px-1 text-caption font-semibold text-text-primary">
              <Layers3 className="size-3.5 text-brand-600" aria-hidden="true" />
              {t("shell.area")}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {(["all", "work", "life"] as const).map((scope) => (
                <Link
                  key={scope}
                  href={scope === "all" ? "/today" : `/today?scope=${scope}`}
                  onClick={() => setOpen(false)}
                  className="flex min-h-9 items-center justify-center rounded-md text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-surface hover:text-text-primary"
                >
                  {t(`scopes.${scope}`)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label={t("a11y.mainNav")}>
          <div className="mb-2 px-2 text-[11px] font-bold tracking-[.09em] text-text-muted uppercase">
            {t("shell.navigate")}
          </div>
          <div className="grid gap-1">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-small font-medium transition-colors",
                    active
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[30px] items-center justify-center rounded-md border",
                      active
                        ? "border-brand-200 bg-bg-surface text-brand-700"
                        : "border-border bg-bg-surface text-text-muted",
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-small text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
          >
            <Settings className="size-4" aria-hidden="true" />
            {t("nav.settings")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
