import { LogOut } from "lucide-react";
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
    return { configured: true, dryRun: !env.accessToken, addFriendUrl: env.basicId ? `https://line.me/R/ti/p/${env.basicId}` : null };
  } catch {
    return { configured: false, dryRun: true, addFriendUrl: null };
  }
}

/** ตั้งค่า (Design §8.2): โปรไฟล์ → LINE → แจ้งเตือน → บัญชี (ซ่อน persona/subscription/ธีม ตาม POC) */
export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect(ROUTES.login);

  const [t, lineStatus] = await Promise.all([getTranslations("settings"), getLineStatus(me.userId)]);
  const line = lineConfig();
  const codeAlive = lineStatus?.code && !isLinkCodeExpired(lineStatus.codeExpiresAt);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="space-y-6">
        <Section title={t("profile.title")}>
          <p className="mb-3 text-small text-text-secondary">
            {t("profile.email")}: {me.email}
          </p>
          <DisplayNameForm initial={me.profile.display_name ?? ""} />
        </Section>

        <Section title={t("line.title")} description={t("line.description")}>
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

        <Section title={t("notifications.title")}>
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

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border border-border bg-bg-surface p-4 md:p-5">
      <h2 className="text-h2 text-text-primary">{title}</h2>
      {description ? <p className="mt-0.5 mb-4 text-small text-text-secondary">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}
