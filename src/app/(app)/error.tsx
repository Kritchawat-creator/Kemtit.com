"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Error กู้ไม่ได้ (Design §8.6): full-width card บอกเกิดอะไร + ปุ่มลองอีกครั้ง */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    console.error("[app] route error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 size-8 text-danger-800" aria-hidden="true" />
      <h2 className="text-h2 text-danger-800">{t("errors.pageTitle")}</h2>
      <p className="mt-1 text-body text-text-secondary">{t("errors.pageDescription")}</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={reset}>{t("common.retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">{t("errors.backToDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
