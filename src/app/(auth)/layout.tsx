import { getTranslations } from "next-intl/server";
import type * as React from "react";

/** โครงหน้าฝั่ง auth/onboarding (Claude Design 3a): ชิดบน กว้างสุด md · ชื่อ "Kemtit" สี brand-500 + tagline · ไม่มี nav */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="min-h-dvh bg-bg-page">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-10 pb-8">
        <div className="mb-6">
          <p className="text-h1 tracking-wide text-brand-500">{t("nameLatin")}</p>
          <p className="text-small text-text-secondary">
            {t("name")} — {t("tagline")}
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
