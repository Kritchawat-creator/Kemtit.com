"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type RouteErrorRecoveryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Shared localized recovery UI for route-level and app-layout failures. */
export function RouteErrorRecovery({ error, reset }: RouteErrorRecoveryProps) {
  const t = useTranslations();
  const router = useRouter();

  useEffect(() => {
    // The digest is safe to correlate with server logs; error messages may contain private data.
    console.error("[app] route error", { digest: error.digest });
  }, [error]);

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div role="alert" className="rounded-2xl bg-bg-surface p-6 text-center shadow-xs">
      <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-danger-50 text-danger-800">
        <AlertTriangle className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2 className="text-h2 text-danger-800">{t("errors.pageTitle")}</h2>
      <p className="mt-1 text-body text-text-secondary">{t("errors.pageDescription")}</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={retry}>{t("common.retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/today">{t("errors.backToDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
