import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { PersonaId } from "@/core/profile/personas";
import { Badge } from "@/components/ui/badge";

import { QuickAddMenu } from "./QuickAddMenu";
import { UserMenu } from "./UserMenu";

type Props = { persona: PersonaId | null; displayName: string | null; email: string | null };

/** Top bar: brand (มือถือ) + persona pill + ปุ่มเพิ่ม (desktop) + เมนูผู้ใช้ (Design §7.2) */
export function TopBar({ persona, displayName, email }: Props) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg-surface px-4 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          aria-label={t("a11y.brandHome")}
          className="flex items-center gap-2 rounded-md text-h3 text-brand-800 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
        >
          <Compass className="size-5 text-brand-500" aria-hidden="true" />
          {t("app.name")}
        </Link>
        {persona ? (
          <Badge variant="secondary" className="rounded-full" aria-label={t("a11y.currentPersona")}>
            {t(`personas.${persona}.name`)}
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <QuickAddMenu className="hidden lg:inline-flex" />
        <UserMenu displayName={displayName} email={email} />
      </div>
    </header>
  );
}
