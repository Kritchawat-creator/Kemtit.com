import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PersonaId } from "@/core/profile/personas";

import { NotificationsMenu } from "./NotificationsMenu";
import { UserMenu } from "./UserMenu";

type Props = {
  persona: PersonaId | null;
  displayName: string | null;
  email: string | null;
  /** signed URL จาก getMe() — null เมื่อไม่มีรูปหรือ flag uploads ปิด */
  avatarUrl?: string | null;
  /** จำนวนงานค้าง (จาก getDayPlan) — ใช้กับ NotificationsMenu บน desktop เท่านั้น */
  overdue: number;
  /** เชื่อม LINE แล้วหรือยัง — ใช้กับ NotificationsMenu บน desktop เท่านั้น */
  lineLinked: boolean;
};

/**
 * แถวบน: มือถือ = persona pill สีพีช (accent-50/900) + avatar พีช บนพื้นหน้า ไม่มีเส้นขอบ (Claude Design 2a)
 * desktop (turn 7): ลอยอยู่มุมขวาบนของ header 72px — ช่องค้นหา + กระดิ่งแจ้งเตือน + user chip (ชื่อ+persona)
 * ทั้งสองชุดอยู่ใน DOM พร้อมกันเสมอ สลับด้วย CSS `lg:hidden`/`hidden lg:flex` เท่านั้น (getByRole กรอง
 * display:none ออกจาก accessibility tree อยู่แล้ว — ต่างจากกรณี getByText ตรงๆ ที่เคยพังใน tracking-log รอบ 14)
 */
export function TopBar({ persona, displayName, email, avatarUrl, overdue, lineLinked }: Props) {
  const t = useTranslations();

  return (
    <header className="flex h-14 items-center justify-between gap-3 px-5 pt-2 lg:absolute lg:top-0 lg:right-8 lg:z-30 lg:h-[72px] lg:justify-end lg:px-0 lg:pt-0">
      {persona ? (
        <span
          aria-label={t("a11y.currentPersona")}
          className="inline-flex h-9 max-w-[60%] items-center truncate rounded-full bg-accent-50 px-3.5 text-small font-medium text-accent-900 shadow-sm lg:hidden"
        >
          {t(`personas.${persona}.name`)}
        </span>
      ) : (
        <span className="lg:hidden" />
      )}
      <span className="lg:hidden">
        <UserMenu displayName={displayName} email={email} avatarUrl={avatarUrl ?? null} />
      </span>

      <div className="hidden items-center gap-3 lg:flex">
        <form
          role="search"
          action="/search"
          method="get"
          className="flex h-11 w-56 items-center gap-2.5 rounded-full bg-bg-surface px-3.5 shadow-sm xl:w-[300px]"
        >
          <Search
            className="size-[18px] shrink-0 text-text-secondary"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <input
            type="text"
            name="q"
            aria-label={t("nav.search")}
            placeholder={t("nav.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-small text-text-primary outline-none placeholder:text-text-muted"
          />
        </form>
        <NotificationsMenu overdue={overdue} lineLinked={lineLinked} />
        <UserMenu
          variant="chip"
          persona={persona}
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl ?? null}
        />
      </div>
    </header>
  );
}
