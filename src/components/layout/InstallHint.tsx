"use client";

import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "kemtit.installHintDismissed";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * คำแนะนำติดตั้ง PWA (R11): Android → ปุ่ม prompt จริง · iOS Safari → บอกขั้นตอน “เพิ่มลงหน้าจอโฮม”
 * ซ่อนเมื่ออยู่ในโหมด standalone แล้ว หรือ user กด “ไว้ทีหลัง”
 */
export function InstallHint() {
  const t = useTranslations("pwa.install");
  const isClient = useSyncExternalStore(() => () => {}, () => true, () => false);
  const canPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false);
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!isClient || dismissed) return null;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
  if (standalone) return null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIOS && !canPrompt) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // private mode — แค่ซ่อนใน session นี้
    }
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") dismiss();
  }

  return (
    <aside aria-label={t("title")} className="mt-6 flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50 p-4">
      <Download className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-brand-800">{t("title")}</p>
        <p className="text-small text-text-secondary">{isIOS ? t("iosSteps") : t("description")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isIOS && canPrompt ? (
            <Button size="sm" onClick={install}>
              {t("android")}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t("dismiss")}
          </Button>
        </div>
      </div>
      <Button size="icon-sm" variant="ghost" aria-label={t("dismiss")} onClick={dismiss}>
        <X aria-hidden="true" />
      </Button>
    </aside>
  );
}
