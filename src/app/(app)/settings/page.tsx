import { Bell, LogOut, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { signOut } from "@/core/auth/actions";
import { getLineStatus } from "@/core/profile/admin";
import { isLinkCodeExpired } from "@/core/profile/line";
import { ROUTES } from "@/core/profile/onboarding";
import { getMe } from "@/core/profile/queries";
import { getLineEnv } from "@/lib/env.server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";

import { DisplayNameForm } from "./display-name-form";
import { LineLinkCard } from "./line-link-card";
import { NotifySwitch } from "./notify-switch";

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

/** ตั้งค่า (Design §8.2 + Claude Design 3n): โปรไฟล์ (avatar พีช) → LINE (icon tile เขียว) → แจ้งเตือน (icon tile ม่วง) → บัญชี */
export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const [t, lineStatus] = await Promise.all([
    getTranslations("settings"),
    getLineStatus(me.userId),
  ]);
  const line = lineConfig();
  const codeAlive = lineStatus?.code && !isLinkCodeExpired(lineStatus.codeExpiresAt);
  const displayName = me.profile.display_name?.trim() || "";
  const initial = (displayName[0] ?? me.email?.[0] ?? "?").toUpperCase();

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="space-y-4">
        <Section title={t("profile.title")}>
          <div className="mb-4 flex items-center gap-3.5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-100 text-h2 text-accent-900">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-h3 text-text-primary">{displayName || me.email}</p>
              <p className="truncate text-small text-text-secondary">{me.email}</p>
            </div>
          </div>
          <DisplayNameForm initial={me.profile.display_name ?? ""} />
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
          <NotifySwitch initial={me.profile.notify_overdue} />
        </Section>

        <Section title={t("account.title")}>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              <LogOut aria-hidden="true" />
              {t("account.signOut")}
            </Button>
          </form>
        </Section>
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
    <section aria-label={title} className="rounded-xl bg-bg-surface p-5 shadow-md">
      <div className="mb-4 flex items-start gap-3.5">
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
