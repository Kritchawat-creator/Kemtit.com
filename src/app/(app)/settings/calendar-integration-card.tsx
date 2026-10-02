"use client";

import { RefreshCw, Unplug } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  disconnectExternalCalendarConnection,
  syncExternalCalendarConnection,
} from "@/core/calendar-integrations/actions";
import type { ExternalCalendarConnection } from "@/core/calendar-integrations/schema";
import type { CalendarProviderName } from "@/core/calendar-integrations/provider";
import type { AppLocale } from "@/i18n/config";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

const PROVIDERS: CalendarProviderName[] = ["google", "outlook"];

export type CalendarIntegrationNotice =
  | "connected"
  | "sync-error"
  | "connect-error"
  | "cancelled"
  | "invalid-state"
  | "not-configured";

export function CalendarIntegrationCard({
  configured,
  connections,
  notice,
}: {
  configured: Record<CalendarProviderName, boolean>;
  connections: ExternalCalendarConnection[];
  notice: CalendarIntegrationNotice | null;
}) {
  const t = useTranslations("settings.calendar");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function sync(connection: ExternalCalendarConnection) {
    if (!configured[connection.provider] || connection.status !== "active") return;
    startTransition(async () => {
      try {
        const result = await syncExternalCalendarConnection({ connectionId: connection.id });
        if (!result.ok) {
          toast.error(t("syncFailed"));
          router.refresh();
          return;
        }
        toast.success(t("syncSuccess", { count: result.data.imported }));
        router.refresh();
      } catch {
        toast.error(t("syncFailed"));
      }
    });
  }

  function disconnect(connection: ExternalCalendarConnection) {
    startTransition(async () => {
      try {
        const result = await disconnectExternalCalendarConnection({ connectionId: connection.id });
        if (!result.ok) {
          toast.error(t("disconnectFailed"));
          return;
        }
        toast.success(t("disconnected"));
        router.refresh();
      } catch {
        toast.error(t("disconnectFailed"));
      }
    });
  }

  const noticeText = notice ? t(`notices.${notice}`) : null;

  return (
    <div className="space-y-4">
      {noticeText ? (
        <p role="status" className="rounded-lg bg-brand-50 p-3 text-small text-brand-800">
          {noticeText}
        </p>
      ) : null}

      <p className="text-small text-text-secondary">{t("optionalHint")}</p>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const providerConnections = connections.filter((connection) => connection.provider === provider);
          const providerLabel = provider === "google" ? t("providers.google") : t("providers.outlook");

          return (
            <section
              key={provider}
              aria-label={providerLabel}
              className="space-y-3 rounded-lg border border-border p-3"
            >
              <h3 className="text-body font-semibold text-text-primary">{providerLabel}</h3>

              {providerConnections.map((connection) => {
                const statusKey = `statuses.${connection.syncStatus}` as
                  | "statuses.idle"
                  | "statuses.syncing"
                  | "statuses.ok"
                  | "statuses.error";
                const statusLabel =
                  !configured[provider]
                    ? t("connectionStatuses.error")
                    : connection.status === "active"
                    ? t(statusKey)
                    : connection.status === "revoked"
                      ? t("connectionStatuses.revoked")
                      : t("connectionStatuses.error");
                const canSync =
                  configured[provider] && connection.status === "active" && connection.syncStatus !== "syncing";

                return (
                  <div key={connection.id} className="rounded-md bg-brand-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-body font-medium text-brand-800">
                          {connection.accountLabel || providerLabel}
                        </p>
                        <p className="mt-1 text-caption text-text-secondary">
                          {connection.lastSyncedAt
                            ? t("lastSynced", { date: formatDateTime(connection.lastSyncedAt, locale) })
                            : t("notSyncedYet")}
                        </p>
                      </div>
                      <span className="rounded-full bg-bg-surface px-2.5 py-1 text-caption font-medium text-brand-700">
                        {statusLabel}
                      </span>
                    </div>

                    {connection.status !== "active" ? (
                      <p className="mt-3 text-small text-danger-800">{t("connectionUnavailable")}</p>
                    ) : connection.syncStatus === "error" ? (
                      <p className="mt-3 text-small text-danger-800">{t("syncErrorHint")}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => sync(connection)}
                        disabled={pending || !canSync}
                      >
                        <RefreshCw aria-hidden="true" />
                        {pending ? t("working") : t("syncNow")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => disconnect(connection)}
                        disabled={pending}
                      >
                        <Unplug aria-hidden="true" />
                        {t("disconnect")}
                      </Button>
                      {configured[provider] && (connection.status !== "active" || !connection.canWrite) ? (
                        <Button variant="outline" asChild>
                          <Link href={`/api/calendar/${provider}/connect`}>
                            {connection.canWrite ? t("reconnect") : t("reconnectForEditing")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>

                    {configured[provider] && connection.canWrite && connection.status === "active" ? (
                      <p className="mt-3 text-caption text-text-secondary">{t("writeEnabled")}</p>
                    ) : configured[provider] && connection.status === "active" ? (
                      <p className="mt-3 text-caption text-text-secondary">{t("readOnlyHint")}</p>
                    ) : null}
                  </div>
                );
              })}

              {configured[provider] ? (
                <Button variant={providerConnections.length === 0 ? "default" : "outline"} asChild>
                  <Link href={`/api/calendar/${provider}/connect`}>
                    {provider === "google" ? t("connectGoogle") : t("connectOutlook")}
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant={providerConnections.length === 0 ? "default" : "outline"}
                    disabled
                    aria-describedby={`calendar-provider-${provider}-unavailable`}
                  >
                    {provider === "google" ? t("connectGoogle") : t("connectOutlook")}
                  </Button>
                  <span id={`calendar-provider-${provider}-unavailable`} className="sr-only">
                    {t("providerUnavailable", { provider: providerLabel })}
                  </span>
                </>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-caption text-text-secondary">{t("windowHint")}</p>
    </div>
  );
}
