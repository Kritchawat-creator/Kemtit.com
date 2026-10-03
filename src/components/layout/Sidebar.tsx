"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  Goal,
  HeartPulse,
  Home,
  Layers3,
  Settings,
  WalletCards,
  type LucideIcon,
} from "@/components/icons/ui-icons";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";

import { BrandLogo } from "@/components/BrandLogo";
import { LetterAvatar } from "@/components/domain/AvatarSlot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { WorkMode } from "@/core/profile/work-modes";
import { avatarLetter } from "@/lib/format";

import { QuickAddMenu } from "./QuickAddMenu";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  shell: { openTasks: number; tier: string };
  profile: {
    displayName: string | null;
    email: string | null;
    workMode: WorkMode | null;
    avatarUrl: string | null;
  };
};

type ChildItem = { key: string; label: string; href: string; badge?: number };
type GroupItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  children?: ChildItem[];
};

function hrefMatches(pathname: string, searchParams: { get: (key: string) => string | null }, href: string) {
  const [targetPath, query = ""] = href.split("?");
  if (pathname !== targetPath && !pathname.startsWith(`${targetPath}/`)) return false;
  if (!query) return pathname === targetPath || pathname.startsWith(`${targetPath}/`);

  const target = new URLSearchParams(query);
  for (const [key, value] of target.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

export function Sidebar({ collapsed, onToggle, shell, profile }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const nameLabel = profile.displayName?.trim() || profile.email || "";
  const workModeLabel = profile.workMode ? t(`workModes.${profile.workMode}`) : null;
  const letter = avatarLetter(profile.displayName, profile.email);
  const currentScope =
    pathname === "/today" && searchParams.get("scope") === "work"
      ? "work"
      : pathname === "/today" && searchParams.get("scope") === "life"
        ? "life"
        : "all";

  const workspaceChildren: ChildItem[] = [
    { key: "inbox", label: t("nav.inbox"), href: "/inbox" },
    { key: "tasks", label: t("nav.tasks"), href: "/tasks", badge: shell.openTasks },
  ];

  if (profile.workMode === "professional") {
    workspaceChildren.push({ key: "projects", label: t("nav.projects"), href: "/work/projects" });
  } else if (profile.workMode === "seller") {
    workspaceChildren.push({ key: "sales", label: t("nav.workSales"), href: "/work/sales" });
  }

  const groups: GroupItem[] = [
    { key: "today", label: t("nav.today"), href: "/today", icon: Home },
    {
      key: "workspace",
      label: t("nav.workspace"),
      href: "/inbox",
      icon: Layers3,
      children: workspaceChildren,
    },
    {
      key: "planner",
      label: t("nav.plan"),
      href: "/plan",
      icon: CalendarDays,
      children: [
        { key: "planner-year", label: t("planner.views.year"), href: "/plan?view=year" },
        { key: "planner-month", label: t("planner.views.month"), href: "/plan?view=month" },
        { key: "planner-week", label: t("planner.views.week"), href: "/plan?view=week" },
      ],
    },
    {
      key: "calendar",
      label: t("nav.calendar"),
      href: "/calendar",
      icon: CalendarDays,
      children: [
        { key: "calendar-day", label: t("calendar.views.day"), href: "/calendar?view=day" },
        { key: "calendar-week", label: t("calendar.views.week"), href: "/calendar?view=week" },
        { key: "calendar-month", label: t("calendar.views.month"), href: "/calendar?view=month" },
      ],
    },
    { key: "goals", label: t("nav.goals"), href: "/goals", icon: Goal },
    { key: "finance", label: t("nav.finance"), href: "/finance", icon: WalletCards },
    {
      key: "routine",
      label: t("nav.routine"),
      href: "/life",
      icon: HeartPulse,
      children: [
        { key: "habits", label: t("nav.life"), href: "/life" },
        { key: "reviews", label: t("nav.reviews"), href: "/reviews" },
      ],
    },
    {
      key: "insights",
      label: t("nav.insights"),
      href: "/insights",
      icon: BarChart3,
      children: [
        { key: "insights-overview", label: t("insights.tabs.overview"), href: "/insights?tab=overview" },
        {
          key: "insights-productivity",
          label: t("insights.tabs.productivity"),
          href: "/insights?tab=productivity",
        },
        { key: "insights-time", label: t("insights.tabs.time"), href: "/insights?tab=time" },
        {
          key: "insights-balance",
          label: t("insights.tabs.lifeBalance"),
          href: "/insights?tab=lifeBalance",
        },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-border bg-bg-surface transition-[width] duration-200 min-[1151px]:flex",
        collapsed ? "w-[72px] px-2 py-3" : "w-[268px] px-3.5 py-4",
      )}
    >
      <div
        className={cn(
          "flex h-12 shrink-0 items-center",
          collapsed ? "justify-center" : "justify-between px-1",
        )}
      >
        {!collapsed ? (
          <Link
            href="/today"
            aria-label={t("a11y.brandHome")}
            className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none"
          >
            <BrandLogo className="size-8 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-base font-bold tracking-[-0.02em] text-text-primary">
                {t("app.name")}
              </span>
              <small className="mt-0.5 block text-[10px] font-semibold tracking-[.09em] text-text-muted uppercase">
                {t("shell.personalOs")}
              </small>
            </span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          aria-expanded={!collapsed}
          className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-bg-surface text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none"
        >
          <ChevronsLeft
            className={cn("size-[18px] transition-transform duration-200", collapsed && "rotate-180")}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>
      </div>

      {!collapsed ? (
        <section
          className="mt-2 mb-3 rounded-xl border border-border bg-bg-subtle p-2.5"
          aria-label={t("shell.area")}
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-text-primary">
              <Layers3 className="size-3.5 text-brand-600" aria-hidden="true" />
              {t("shell.area")}
            </span>
            <small className="text-[11px] text-text-muted">{t(`scopes.${currentScope}`)}</small>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {(["all", "work", "life"] as const).map((scope) => (
              <Link
                key={scope}
                href={scope === "all" ? "/today" : `/today?scope=${scope}`}
                aria-current={currentScope === scope ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors",
                  currentScope === scope
                    ? "border border-border bg-bg-surface text-text-primary shadow-xs"
                    : "text-text-secondary hover:bg-bg-surface hover:text-text-primary",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    scope === "all"
                      ? "bg-brand-500"
                      : scope === "work"
                        ? "bg-domain-work-dot"
                        : "bg-domain-health-dot",
                  )}
                  aria-hidden="true"
                />
                {t(`scopes.${scope}`)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!collapsed ? (
        <div className="flex min-h-7 items-center gap-2 px-2 text-[11px] font-bold tracking-[.09em] text-text-muted uppercase">
          <span>{t("shell.navigate")}</span>
          <span className="ml-auto size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
        </div>
      ) : null}

      <nav aria-label={t("a11y.mainNav")} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="grid gap-0.5">
          {groups.map((group) => {
            const childActive = group.children?.some((child) =>
              hrefMatches(pathname, searchParams, child.href),
            );
            const active = hrefMatches(pathname, searchParams, group.href) || Boolean(childActive);
            const open = group.children ? (openGroups[group.key] ?? active) : false;
            const Icon = group.icon;

            return (
              <div key={group.key} className="min-w-0">
                <div className="flex min-w-0 items-center gap-1">
                  <Link
                    href={group.href}
                    aria-label={collapsed ? group.label : undefined}
                    aria-current={hrefMatches(pathname, searchParams, group.href) ? "page" : undefined}
                    title={collapsed ? group.label : undefined}
                    className={cn(
                      "flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-small font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none",
                      collapsed && "justify-center px-0",
                      active
                        ? "font-semibold text-brand-700"
                        : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-[30px] shrink-0 items-center justify-center rounded-md border transition-colors",
                        active
                          ? "border-brand-200 bg-brand-50 text-brand-700"
                          : "border-border bg-bg-surface text-text-muted",
                      )}
                    >
                      <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    {!collapsed ? <span className="min-w-0 flex-1 truncate">{group.label}</span> : null}
                  </Link>

                  {!collapsed && group.children ? (
                    <button
                      type="button"
                      aria-label={
                        open
                          ? t("nav.collapseItem", { item: group.label })
                          : t("nav.expandItem", { item: group.label })
                      }
                      aria-expanded={open}
                      onClick={() =>
                        setOpenGroups((current) => ({ ...current, [group.key]: !open }))
                      }
                      className="flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none"
                    >
                      <ChevronDown
                        className={cn("size-3.5 transition-transform", open && "rotate-180")}
                        aria-hidden="true"
                      />
                    </button>
                  ) : null}
                </div>

                {!collapsed && group.children && open ? (
                  <div className="mt-0.5 mb-1 ml-10 grid gap-0.5">
                    {group.children.map((child) => {
                      const activeChild = hrefMatches(pathname, searchParams, child.href);
                      return (
                        <Link
                          key={child.key}
                          href={child.href}
                          aria-current={activeChild ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 min-w-0 items-center gap-2 rounded-md px-2 text-[12px] font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none",
                            activeChild
                              ? "bg-brand-50 text-brand-700"
                              : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{child.label}</span>
                          {child.badge ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700">
                              {child.badge}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>

      {!collapsed ? (
        <div className="mt-2 grid min-w-0 shrink-0 grid-cols-1 gap-2">
          <QuickAddMenu variant="sidebar" />
          <Link
            href="/settings"
            className={cn(
              "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-small transition-colors",
              pathname.startsWith("/settings")
                ? "bg-brand-50 font-semibold text-brand-700"
                : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
            )}
          >
            <Settings className="size-4" strokeWidth={1.8} aria-hidden="true" />
            <span>{t("nav.settings")}</span>
          </Link>

          <div className="flex items-center gap-2.5 border-t border-border px-1 pt-3">
            {profile.avatarUrl ? (
              <Avatar className="size-9 shrink-0 border border-border">
                <AvatarImage src={profile.avatarUrl} alt="" className="object-cover" />
                <AvatarFallback className="bg-brand-50 text-small font-semibold text-brand-700">
                  {letter}
                </AvatarFallback>
              </Avatar>
            ) : (
              <LetterAvatar letter={letter} className="size-9 shrink-0 border border-border shadow-none" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-semibold text-text-primary">{nameLabel}</p>
              <p className="truncate text-[11px] text-text-muted">
                {workModeLabel ?? profile.email ?? ""}
              </p>
            </div>
            <span
              className="size-2 rounded-full bg-success-500"
              aria-label={t("shell.active")}
            />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
