import {
  CalendarDays,
  ClipboardCheck,
  FolderKanban,
  HeartPulse,
  Inbox,
  Settings,
  ShoppingBag,
  Target,
  WalletCards,
} from "@/components/icons/ui-icons";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { workModeFromProfile } from "@/core/profile/work-modes";
import { PageHeader } from "@/components/layout/PageHeader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("more") };
}

export default async function MorePage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);
  const t = await getTranslations();
  const workMode = workModeFromProfile(me.profile.work_mode, me.profile.active_persona);

  const items = [
    { key: "inbox", href: "/inbox", icon: Inbox },
    { key: "calendar", href: "/calendar", icon: CalendarDays },
    { key: "goals", href: "/goals", icon: Target },
    { key: "reviews", href: "/reviews", icon: ClipboardCheck },
    { key: "life", href: "/life", icon: HeartPulse },
    { key: "finance", href: "/finance", icon: WalletCards },
    ...(workMode === "professional"
      ? [{ key: "projects" as const, href: "/work/projects", icon: FolderKanban }]
      : workMode === "seller"
        ? [{ key: "workSales" as const, href: "/work/sales", icon: ShoppingBag }]
        : []),
    { key: "settings", href: "/settings", icon: Settings },
  ] as const;

  return (
    <>
      <PageHeader title={t("nav.more")} description={t("more.description")} />
      <nav aria-label={t("nav.more")}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ key, href, icon: Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex min-h-24 items-center gap-4 rounded-xl border border-border bg-bg-surface p-4 shadow-xs transition-transform hover:-translate-y-0.5"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-body font-semibold text-text-primary">
                    {t(`nav.${key}`)}
                  </span>
                  <span className="mt-1 block text-caption text-text-secondary">
                    {t(`more.items.${key}`)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
