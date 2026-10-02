"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import type { WorkMode } from "@/core/profile/work-modes";

import { MobileNavigationDrawer } from "./MobileNavigationDrawer";
import { isActivePath, MOBILE_NAV_ITEMS } from "./nav-items";
import { QuickAddMenu } from "./QuickAddMenu";

/**
 * Final mobile product loop: Today / Plan / Capture / Insights / More.
 * More stays active for secondary destinations reached from that hub.
 */
export function BottomNav({ workMode }: { workMode: WorkMode | null }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const ta = useTranslations("a11y");

  return (
    <nav
      aria-label={ta("mainNav")}
      className="fixed bottom-[max(10px,env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%_-_20px)] max-w-[520px] -translate-x-1/2 rounded-2xl border border-border bg-bg-surface/95 shadow-nav backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5 px-2 py-1.5">
        {MOBILE_NAV_ITEMS.map(({ key, href, icon: Icon, quick }) => {
          if (quick) {
            return (
              <li key={key} className="flex items-center justify-center">
                <QuickAddMenu variant="fab" className="-mt-4 size-12 rounded-xl" />
              </li>
            );
          }

          if (key === "more") {
            return (
              <li key={key}>
                <MobileNavigationDrawer workMode={workMode} triggerVariant="bottomNav" />
              </li>
            );
          }

          const active = isActivePath(pathname, href);

          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-caption font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/15 focus-visible:outline-none focus-visible:ring-inset",
                  active ? "text-brand-600" : "text-text-secondary hover:text-text-primary",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-brand-50",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
