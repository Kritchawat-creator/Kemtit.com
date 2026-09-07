"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { isActivePath, MOBILE_NAV_ITEMS } from "./nav-items";

/**
 * Bottom nav 4 แท็บ บนมือถือ (Design §7.2 + Claude Design 2a): พื้นขาวมุมบน 28px เงาม่วงขึ้นบน ไม่มีเส้นขอบ
 * ไอคอนอยู่ใน pill 48×28 — แท็บ active พื้น brand-50 ตัวหนังสือ brand-600 · แตะได้ ≥44px · ซ่อนบน desktop
 */
export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const ta = useTranslations("a11y");

  return (
    <nav
      aria-label={ta("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-bg-surface pb-[env(safe-area-inset-bottom)] shadow-nav lg:hidden"
    >
      <ul className="grid grid-cols-4 px-2 py-1">
        {MOBILE_NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-caption font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none focus-visible:ring-inset",
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
