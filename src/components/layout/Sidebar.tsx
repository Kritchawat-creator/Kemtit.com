"use client";

import { ChevronsLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { isActivePath, NAV_ITEMS } from "./nav-items";

type Props = { collapsed: boolean; onToggle: () => void };

/**
 * Sidebar ซ้ายบน desktop (Claude Design turn 4): พื้นขาว เงาม่วงด้านขวา · "Kemtit" brand-500 + ปุ่มพับ
 * รายการ nav สูง 48 มุม 14 — active พื้น brand-50 ตัวหนังสือ brand-600 · พับแล้วเหลือไอคอน (label เป็น sr-only)
 */
export function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col gap-1.5 overflow-hidden bg-bg-surface p-3 pb-6 shadow-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "mb-3 flex h-12 items-center",
          collapsed ? "justify-center" : "justify-between pl-3",
        )}
      >
        {!collapsed ? (
          <Link
            href="/dashboard"
            aria-label={t("a11y.brandHome")}
            className="truncate rounded-md text-h2 text-brand-500 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
          >
            {t("app.nameLatin")}
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
      <nav aria-label={t("a11y.mainNav")} className="flex-1">
        <ul className="space-y-1.5">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? t(`nav.${key}`) : undefined}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-md text-base font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none",
                    collapsed ? "justify-center px-0" : "px-3",
                    active
                      ? "bg-brand-50 text-brand-600"
                      : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
                  )}
                >
                  <Icon className="size-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  <span className={cn(collapsed && "sr-only")}>{t(`nav.${key}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
