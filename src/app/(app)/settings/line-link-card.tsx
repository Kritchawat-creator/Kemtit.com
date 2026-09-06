"use client";

import { ExternalLink, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createLineLinkCode,
  getLineLinkStatus,
  unlinkLine,
  type LineLinkView,
} from "@/core/profile/line-actions";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = { initial: LineLinkView; addFriendUrl: string | null; dryRun: boolean };

const POLL_MS = 3000;

/** การ์ดเชื่อม LINE (Decision 2.1): ขอรหัส → เพิ่มเพื่อน → พิมพ์รหัสในแชท → หน้านี้ poll สถานะจนเชื่อมสำเร็จ */
export function LineLinkCard({ initial, addFriendUrl, dryRun }: Props) {
  const t = useTranslations("settings.line");
  const te = useTranslations("errors");
  const router = useRouter();
  const [view, setView] = useState<LineLinkView>(initial);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  const waitingForCode = !view.linked && view.code !== null;
  const expired = view.codeExpiresAt ? new Date(view.codeExpiresAt).getTime() <= now : false;

  // poll ระหว่างรอรหัสจากแชท (async ใน callback ไม่ใช่ setState ตรงใน effect)
  useEffect(() => {
    if (!waitingForCode || expired) return;
    const id = setInterval(() => {
      setNow(Date.now());
      void getLineLinkStatus().then((result) => {
        if (!result.ok) return;
        setView(result.data);
        if (result.data.linked) {
          toast.success(t("linkedToast"));
          router.refresh();
        }
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waitingForCode, expired, router, t]);

  function requestCode() {
    startTransition(async () => {
      const result = await createLineLinkCode();
      if (!result.ok) {
        toast.error(te("generic"));
        return;
      }
      setNow(Date.now());
      setView(result.data);
    });
  }

  function disconnect() {
    startTransition(async () => {
      const result = await unlinkLine();
      if (!result.ok) {
        toast.error(te("generic"));
        return;
      }
      setView({ linked: false, linkedAt: null, code: null, codeExpiresAt: null });
      toast.success(t("unlinkedToast"));
      router.refresh();
    });
  }

  const minutesLeft = view.codeExpiresAt
    ? Math.max(0, Math.ceil((new Date(view.codeExpiresAt).getTime() - now) / 60_000))
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={view.linked ? "default" : "outline"} className="rounded-full">
          {view.linked ? t("linked") : t("notLinked")}
        </Badge>
        {view.linked && view.linkedAt ? (
          <span className="text-small text-text-secondary">
            {t("linkedSince", { date: formatDateTime(view.linkedAt) })}
          </span>
        ) : null}
      </div>

      {view.linked ? (
        <Button variant="outline" onClick={disconnect} disabled={pending}>
          {t("disconnect")}
        </Button>
      ) : waitingForCode && !expired ? (
        <div className="space-y-4 rounded-lg border border-border bg-bg-subtle p-4">
          <p className="text-caption text-text-secondary">{t("codeTitle")}</p>
          <p data-testid="line-link-code" className="text-display tracking-[0.3em] text-brand-800">
            {view.code}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-small text-text-secondary">
            <li>{t("step1")}</li>
            <li>{t("step2")}</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            {addFriendUrl ? (
              <Button asChild variant="outline">
                <a href={addFriendUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" />
                  {t("addFriend")}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </Button>
            ) : (
              <p className="text-caption text-warning-800">{t("noBasicId")}</p>
            )}
            <span className="text-caption text-text-muted" aria-live="polite">
              {t("waiting")} · {t("expiresIn", { minutes: minutesLeft })}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={requestCode} disabled={pending}>
            <MessageCircle aria-hidden="true" />
            {pending ? t("requesting") : expired ? t("newCode") : t("connect")}
          </Button>
          {expired ? <span className="text-small text-warning-800">{t("expired")}</span> : null}
        </div>
      )}

      {dryRun ? <p className="text-caption text-text-muted">{t("dryRunHint")}</p> : null}
    </div>
  );
}
