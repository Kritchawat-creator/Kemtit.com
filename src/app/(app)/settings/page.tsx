import { Bell, CalendarDays, LogOut, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { signOut } from "@/core/auth/actions";
import { listExternalCalendarConnections } from "@/core/calendar-integrations/queries";
import { getPlanningPreferences } from "@/core/planning/queries";
import { getLineStatus } from "@/core/profile/admin";
import { isLinkCodeExpired } from "@/core/profile/line";
import { ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { UPLOADS_ENABLED } from "@/lib/flags";
import {
  getLineEnv,
  isGoogleCalendarConfigured,
  isOutlookCalendarConfigured,
} from "@/lib/env.server";
import { avatarLetter } from "@/lib/format";
import { AvatarSlot } from "@/components/domain/AvatarSlot";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

import {
  CalendarIntegrationCard,
  type CalendarIntegrationNotice,
} from "./calendar-integration-card";
import { ArchiveSettingsLink } from "./ArchiveSettingsLink";
import { DisplayNameForm } from "./display-name-form";
import { LineLinkCard } from "./line-link-card";
import { NotifySwitch } from "./notify-switch";
import { ContextSettings } from "@/components/profile/ContextSettings";
import { PlanningPreferencesForm } from "@/components/planning/PlanningPreferencesForm";
import { LanguageRegionSettings } from "@/components/i18n/LanguageRegionSettings";
import styles from "./settings.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

function lineConfig() {
  try {
    const env = getLineEnv();
    return {
      configured: true,
      dryRun: !env.accessToken,
      addFriendUrl: env.basicId ? `https://line.me/R/ti/p/${env.basicId}` : null,
    };
  } catch {
    return { configured: false, dryRun: true, addFriendUrl: null };
  }
}

const CALENDAR_NOTICES: CalendarIntegrationNotice[] = [
  "connected",
  "sync-error",
  "connect-error",
  "cancelled",
  "invalid-state",
  "not-configured",
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const params = await searchParams;
  const calendarNotice =
    typeof params.calendar === "string" && CALENDAR_NOTICES.includes(params.calendar as CalendarIntegrationNotice)
      ? (params.calendar as CalendarIntegrationNotice)
      : null;
  const [t, tp, lineStatus, calendarConnections, planningPreferences] = await Promise.all([
    getTranslations("settings"),
    getTranslations("photos"),
    getLineStatus(me.userId),
    listExternalCalendarConnections(),
    getPlanningPreferences(),
  ]);
  const line = lineConfig();
  const calendarProvidersConfigured = {
    google: isGoogleCalendarConfigured(),
    outlook: isOutlookCalendarConfigured(),
  };
  const codeAlive = lineStatus?.code && !isLinkCodeExpired(lineStatus.codeExpiresAt);
  const displayName = me.profile.display_name?.trim() || "";
  const letter = avatarLetter(displayName, me.email);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className={styles.workspace} data-testid="settings-workspace">
        <div className={styles.grid} data-testid="settings-grid">
          <div className={styles.column}>
            <Section title={t("profile.title")}>
              <div className="mb-4 flex items-center gap-3.5">
                <AvatarSlot src={me.avatarUrl} letter={letter} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-h3 text-text-primary">{displayName || me.email}</p>
                  <p className="truncate text-small text-text-secondary">{me.email}</p>
                  {UPLOADS_ENABLED ? (
                    <p className="text-caption text-text-muted">{tp("avatarHint")}</p>
                  ) : null}
                </div>
              </div>
              <DisplayNameForm initial={me.profile.display_name ?? ""} />
            </Section>

            <Section
              title={t("language.title")}
              description={t("language.description")}
            >
              <LanguageRegionSettings />
            </Section>

            <Section title={t("context.title")} description={t("context.description")}>
              <ContextSettings
                role={me.profile.role_code}
                focusAreas={me.profile.focus_areas}
                scope={me.profile.default_scope}
              />
            </Section>

            <Section title={t("planning.title")} description={t("planning.description")}>
              <PlanningPreferencesForm initial={planningPreferences} />
            </Section>
          </div>

          <div className={styles.column}>
            <Section
              title={t("calendar.title")}
              description={t("calendar.description")}
              icon={
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <CalendarDays className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />
                </span>
              }
            >
              <CalendarIntegrationCard
                configured={calendarProvidersConfigured}
                connections={calendarConnections}
                notice={calendarNotice}
              />
            </Section>

            <Section
              title={t("line.title")}
              description={t("line.description")}
              icon={
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-success-50 text-success-500">
                  <MessageCircle className="size-[22px]" strokeWidth={1.5} aria-hidden="true" />
                </span>
              }
            >
              {line.configured ? (
                <LineLinkCard
                  initial={{
                    linked: Boolean(lineStatus?.lineUserId),
                    linkedAt: lineStatus?.linkedAt ?? null,
                    code: codeAlive ? (lineStatus?.code ?? null) : null,
                    codeExpiresAt: codeAlive ? (lineStatus?.codeExpiresAt ?? null) : null,
                  }}
                  addFriendUrl={line.addFriendUrl}
                  dryRun={line.dryRun}
                />
              ) : (
                <p className="text-small text-warning-800">{t("line.noBasicId")}</p>
              )}
            </Section>

            <Section
              title={t("notifications.title")}
              icon={
                <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-600">
                  <Bell className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                </span>
              }
            >
              <NotifySwitch
                initial={{
                  overdue: me.profile.notify_overdue,
                  dailyBrief: me.profile.notify_daily_brief,
                  weeklyReview: me.profile.notify_weekly_review,
                  habits: me.profile.notify_habits,
                  investment: me.profile.notify_investment,
                }}
              />
            </Section>

            <Section title={t("account.title")}>
              <div className="mb-3">
                <ArchiveSettingsLink />
              </div>
              <form action={signOut}>
                <Button type="submit" variant="outline">
                  <LogOut aria-hidden="true" />
                  {t("account.signOut")}
                </Button>
              </form>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-border bg-bg-surface p-4 shadow-xs">
      <div className="mb-3 flex items-start gap-3">
        {icon}
        <div className="min-w-0">
          <h2 className="text-h3 text-text-primary">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-small text-text-secondary">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
