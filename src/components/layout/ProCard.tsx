"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

type Props = { tier: string };

/**
 * การ์ด Pro ท้าย sidebar เมื่อขยาย (Claude Design turn 7) — ไม่มีระบบ billing ใน POC (Decision §1.6)
 * tier "pro": โชว์แค่แถวป้าย + pill PRO · tier อื่น (free): โชว์ pitch + ปุ่มอัปเกรดที่แค่ toast comingSoon
 */
export function ProCard({ tier }: Props) {
  const t = useTranslations();
  const isPro = tier === "pro";

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded-lg bg-brand-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-small font-semibold text-brand-800">
          {isPro ? t("pro.tierPro") : t("pro.tierFree")}
        </span>
        {isPro ? (
          <span className="rounded-full bg-brand-800 px-2 text-[11px] font-semibold tracking-[.02em] text-neutral-0">
            {t("pro.badge")}
          </span>
        ) : null}
      </div>
      {!isPro ? (
        <>
          <p className="text-caption text-text-secondary">{t("pro.pitch")}</p>
          <button
            type="button"
            onClick={() => toast(t("pro.comingSoon"))}
            className="h-10 w-full rounded-full bg-brand-500 text-small font-medium text-neutral-0 transition-colors hover:bg-brand-600"
          >
            {t("pro.upgrade")}
          </button>
        </>
      ) : null}
    </div>
  );
}
