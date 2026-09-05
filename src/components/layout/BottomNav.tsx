"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { isActivePath, NAV_ITEMS } from "./nav-items";

/** Bottom nav 4 แท็บ บนมือถือ (Design §7.2) — แตะได้ ≥44px, ซ่อนบน desktop */
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const ta = useTranslations("a11y");

  return (
    <nav
      aria-label={ta("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-caption transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                  active ? "text-brand-700" : "text-text-secondary hover:text-text-primary",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
