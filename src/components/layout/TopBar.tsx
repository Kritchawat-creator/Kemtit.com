import { useTranslations } from "next-intl";

import type { PersonaId } from "@/core/profile/personas";
import { photoPublicUrl } from "@/lib/supabase/storage";

import { UserMenu } from "./UserMenu";

type Props = {
  persona: PersonaId | null;
  displayName: string | null;
  email: string | null;
  avatarPath?: string | null;
};

/**
 * แถวบน: persona pill สีพีช (accent-50/900) + avatar พีช บนพื้นหน้า ไม่มีเส้นขอบ (Claude Design 2a)
 * desktop (turn 4): ลอยอยู่มุมขวาบนของ header 72px — ปุ่มหลักของหน้าย้ายไป toolbar ของแต่ละหน้า
 */
export function TopBar({ persona, displayName, email, avatarPath }: Props) {
  const t = useTranslations();

  return (
    <header className="flex h-14 items-center justify-between gap-3 px-5 pt-2 lg:absolute lg:top-0 lg:right-8 lg:z-30 lg:h-[72px] lg:justify-end lg:px-0 lg:pt-0">
      {persona ? (
        <span
          aria-label={t("a11y.currentPersona")}
          className="inline-flex h-9 max-w-[60%] items-center truncate rounded-full bg-accent-50 px-3.5 text-small font-medium text-accent-900 shadow-sm lg:max-w-none"
        >
          {t(`personas.${persona}.name`)}
        </span>
      ) : (
        <span />
      )}
      <UserMenu
        displayName={displayName}
        email={email}
        avatarUrl={avatarPath ? photoPublicUrl(avatarPath) : null}
      />
    </header>
  );
}
