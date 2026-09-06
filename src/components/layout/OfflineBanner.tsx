"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** banner ออฟไลน์แบบอ่านอย่างเดียว (Design §8.6 + Claude Design 3g: แถบ warning-50 มุม 12px ลอยเหนือเนื้อหา) */
export function OfflineBanner() {
  const t = useTranslations("pwa");
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex min-h-10 items-center justify-center gap-2 rounded-md bg-warning-50 px-4 py-2 text-small font-medium text-warning-800"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      {t("offline")}
    </div>
  );
}
