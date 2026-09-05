import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type * as React from "react";

/** โครงหน้าฝั่ง auth/onboarding: การ์ดกลางจอ กว้างสุด md ไม่มี nav (Design §8.3) */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="min-h-dvh bg-bg-page">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center gap-2">
          <Compass className="size-7 text-brand-500" aria-hidden="true" />
          <span className="text-h2 text-brand-800">{t("name")}</span>
        </div>
        {children}
      </main>
    </div>
  );
}
