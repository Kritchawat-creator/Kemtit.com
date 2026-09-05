import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/**
 * หน้า placeholder ของ Milestone 0 — พิสูจน์ว่าฟอนต์, token, i18n และ shadcn primitive ทำงานร่วมกัน
 * จะถูกแทนด้วย route จริง (login / dashboard) ใน M1
 */
export default async function HomePage() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <p className="text-caption text-text-secondary">{t("home.status")}</p>
      <h1 className="text-display text-brand-800">{t("app.name")}</h1>
      <p className="text-body text-text-secondary">{t("app.tagline")}</p>
      <p className="text-small text-text-muted">{t("home.description")}</p>
      <div>
        <Button size="lg">{t("home.cta")}</Button>
      </div>
    </main>
  );
}
