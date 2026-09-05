"use client";

import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { isActivePath, NAV_ITEMS } from "./nav-items";

/** Sidebar ซ้ายบน desktop (Design §7.2) */
export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-bg-surface lg:flex">
      <div className="px-6 py-6">
        <Link
          href="/dashboard"
          aria-label={t("a11y.brandHome")}
          className="flex items-center gap-2 rounded-md text-h2 text-brand-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Compass className="size-6 text-brand-500" aria-hidden="true" />
          {t("app.name")}
        </Link>
      </div>
      <nav aria-label={t("a11y.mainNav")} className="flex-1 px-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 text-body transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                      ? "bg-brand-50 font-medium text-brand-800"
                      : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {t(`nav.${key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
