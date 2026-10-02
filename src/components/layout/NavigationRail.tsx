"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "cn";

import { isActivePath, TABLET_NAV_ITEMS } from "./nav-items";

const primaryItems = TABLET_NAV_ITEMS.filter((item) => item.key !== "more");
const moreItem = TABLET_NAV_ITEMS.find((item) => item.key === "more");

export function NavigationRail() {
  const pathname = usePathname();
  const t = useTranslations();
  const primaryRouteActive = primaryItems.some((item) => isActivePath(pathname, item.href));

  function renderItem(item: (typeof TABLET_NAV_ITEMS)[number], active: boolean) {
    const Icon = item.icon;
    const label = t(`nav.${item.key}`);

    return (
      <li key={item.key}>
        <Link
          href={item.href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          title={label}
          className={cn(
            "flex size-12 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none",
            active
              ? "bg-brand-50 text-brand-700"
              : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
          )}
        >
          <Icon className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </li>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-border bg-bg-surface px-2 py-3 md:flex lg:hidden">
      <Link
        href="/today"
        aria-label={t("a11y.brandHome")}
        className="mx-auto mb-3 flex size-11 items-center justify-center rounded-md bg-brand-500 focus-visible:ring-[3px] focus-visible:ring-brand-500/30 focus-visible:outline-none"
      >
        <svg viewBox="0 0 10 10" aria-hidden="true" className="size-5">
          <polygon points="5,0 7,5 5,10 3,5" className="fill-neutral-0" />
          <polygon points="5,0 7,5 5,5" className="fill-brand-200" />
        </svg>
      </Link>

      <nav aria-label={t("a11y.mainNav")} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ul className="space-y-1">
          {primaryItems.map((item) => renderItem(item, isActivePath(pathname, item.href)))}
        </ul>
        {moreItem ? (
          <ul className="mt-auto border-t border-border pt-2">
            {renderItem(moreItem, !primaryRouteActive)}
          </ul>
        ) : null}
      </nav>
    </aside>
  );
}
