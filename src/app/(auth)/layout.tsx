import { getTranslations } from "next-intl/server";
import type * as React from "react";

import styles from "./layout.module.css";

/** โครงหน้าฝั่ง auth/onboarding: หน้าทั่วไปใช้กรอบแคบ ส่วน login ปรับกรอบผ่านตัวเลือกที่จำกัดไว้เฉพาะ route */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="min-h-dvh bg-bg-page">
      <main
        className={[
          styles.main,
          "mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-10 pb-8",
        ].join(" ")}
      >
        <div className={[styles.brandHeader, "mb-6"].join(" ")}>
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
