import { useTranslations } from "next-intl";

import type { PersonaId } from "@/core/profile/personas";

import { QuickAddMenu } from "./QuickAddMenu";
import { UserMenu } from "./UserMenu";

type Props = { persona: PersonaId | null; displayName: string | null; email: string | null };

/**
 * แถวบน (Claude Design 2a): persona pill สีพีช (accent-50/900) ซ้าย + avatar พีชขวา บนพื้นหน้า ไม่มีเส้นขอบ
 * desktop: sticky บนพื้นขาว + ปุ่ม "เพิ่ม" (มือถือใช้ FAB แทน)
 */
export function TopBar({ persona, displayName, email }: Props) {
  const t = useTranslations();

  return (
    <header className="flex h-14 items-center justify-between gap-3 px-5 pt-2 lg:sticky lg:top-0 lg:z-30 lg:h-16 lg:border-b lg:border-border lg:bg-bg-surface lg:px-8 lg:pt-0">
      <div className="flex min-w-0 items-center gap-3">
        {persona ? (
          <span
            aria-label={t("a11y.currentPersona")}
            className="inline-flex h-9 max-w-full items-center truncate rounded-full bg-accent-50 px-3.5 text-small font-medium text-accent-900 shadow-sm"
          >
            {t(`personas.${persona}.name`)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <QuickAddMenu className="hidden lg:inline-flex" />
        <UserMenu displayName={displayName} email={email} />
      </div>
    </header>
  );
}
