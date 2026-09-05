import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <Compass className="mb-4 size-10 text-brand-500" aria-hidden="true" />
      <h1 className="text-h1 text-text-primary">{t("notFoundTitle")}</h1>
      <p className="mt-1 text-body text-text-secondary">{t("notFoundDescription")}</p>
      <Button className="mt-6" asChild>
        <Link href="/dashboard">{t("backToDashboard")}</Link>
      </Button>
    </main>
  );
}
