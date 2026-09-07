"use client";

import { ChevronsLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import type { PersonaId } from "@/core/profile/personas";
import { avatarLetter } from "@/lib/format";
import { LetterAvatar } from "@/components/domain/AvatarSlot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { isActivePath, NAV_SECTIONS } from "./nav-items";
import { ProCard } from "./ProCard";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  /** ข้อมูลคำนวณจาก AppShell (§3.2): งานค้าง/ต้องทำวันนี้ + แพ็กเกจ — cache() กันยิงซ้ำอยู่แล้วที่ getDayPlan */
  shell: { openTasks: number; tier: string };
  profile: {
    displayName: string | null;
    email: string | null;
    persona: PersonaId | null;
    avatarUrl: string | null;
  };
};

/**
 * Sidebar ซ้าย desktop v3 (Claude Design turn 7): พื้นขาว เงา shadow-sidebar · w-60 พับเหลือ w-[72px]
 * โลโก้เข็มทิศ + ชื่อแอป · เมนู 2 กลุ่ม (หลัก/เพิ่มเติม) พร้อม badge · การ์ด Pro · แถวโปรไฟล์ท้ายสุด
 */
export function Sidebar({ collapsed, onToggle, shell, profile }: Props) {
  const pathname = usePathname();
  const t = useTranslations();

  const nameLabel = profile.displayName?.trim() || profile.email || "";
  const personaLabel = profile.persona ? t(`personas.${profile.persona}.name`) : null;
  const letter = avatarLetter(profile.displayName, profile.email);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden bg-bg-surface p-3 shadow-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "mb-2 flex h-12 shrink-0 items-center",
          collapsed ? "justify-center" : "justify-between pl-1",
        )}
      >
        {!collapsed ? (
          <Link
            href="/dashboard"
            aria-label={t("a11y.brandHome")}
            className="flex min-w-0 items-center gap-2 rounded-md focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-brand-500">
              <svg viewBox="0 0 10 10" aria-hidden="true" className="size-[18px]">
                <polygon points="5,0 7,5 5,10 3,5" className="fill-neutral-0" />
                <polygon points="5,0 7,5 5,5" className="fill-accent-500" />
              </svg>
            </span>
            <span className="truncate text-h2 text-brand-800">{t("app.nameLatin")}</span>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          aria-expanded={!collapsed}
          className="flex size-12 shrink-0 items-center justify-center rounded-md text-brand-800 transition-colors hover:bg-brand-50 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
        >
          <ChevronsLeft
            className={cn(
              "size-[22px] transition-transform duration-200",
              collapsed && "rotate-180",
            )}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </button>
      </div>

      <nav
        aria-label={t("a11y.mainNav")}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.key} className={section.key === "more" ? "mt-1" : undefined}>
            {!collapsed ? (
              <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-[.08em] text-brand-200 uppercase">
                {t(section.key === "primary" ? "nav.sectionPrimary" : "nav.sectionMore")}
              </p>
            ) : null}
            <ul className="space-y-1.5">
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const badgeCount = item.badge === "tasks" ? shell.openTasks : null;
                const label = t(`nav.${item.key}`);
                const content = (
                  <>
                    <item.icon
                      className="size-[22px] shrink-0"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span className={cn("flex-1 truncate", collapsed && "sr-only")}>{label}</span>
                    {!collapsed && item.badge === "pro" ? (
                      <span className="rounded-full bg-brand-800 px-2 text-[11px] font-semibold tracking-[.02em] text-neutral-0">
                        {t("pro.badge")}
                      </span>
                    ) : null}
                    {!collapsed && item.badge === "tasks" && badgeCount ? (
                      <span className="flex h-[22px] items-center rounded-full bg-brand-50 px-2 text-caption text-brand-800">
                        {badgeCount}
                      </span>
                    ) : null}
                  </>
                );

                if (item.disabled) {
                  return (
                    <li key={item.key}>
                      <span
                        role="link"
                        aria-disabled="true"
                        title={t("nav.proSoon")}
                        className={cn(
                          "relative flex h-12 cursor-not-allowed items-center gap-3 rounded-md text-base whitespace-nowrap text-text-secondary opacity-70",
                          collapsed ? "justify-center px-0" : "px-3",
                        )}
                      >
                        {content}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? label : undefined}
                      className={cn(
                        "relative flex h-12 items-center gap-3 rounded-md text-base whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none",
                        collapsed ? "justify-center px-0" : "px-3",
                        active
                          ? "bg-brand-50 font-semibold text-brand-600"
                          : "text-text-secondary hover:bg-brand-50 hover:text-brand-600",
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-[3px] bg-brand-500"
                        />
                      ) : null}
                      {content}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed ? <ProCard tier={shell.tier} /> : null}

      <div className="mt-1 shrink-0 border-t border-border pt-2.5">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          {profile.avatarUrl ? (
            <Avatar className="size-9 shrink-0 border-2 border-neutral-0 shadow-sm">
              <AvatarImage src={profile.avatarUrl} alt="" className="object-cover" />
              <AvatarFallback className="bg-brand-100 text-small font-semibold text-brand-800">
                {letter}
              </AvatarFallback>
            </Avatar>
          ) : (
            <LetterAvatar
              letter={letter}
              className="size-9 shrink-0 border-2 border-neutral-0 shadow-sm"
            />
          )}
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-semibold text-text-primary">
                {nameLabel}
                {personaLabel ? ` · ${personaLabel}` : ""}
              </p>
              {profile.email ? (
                <p className="truncate text-[11px] text-text-secondary">{profile.email}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
