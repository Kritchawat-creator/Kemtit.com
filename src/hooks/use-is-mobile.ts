"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)"; // V2 compact contract: mobile < 768px

function subscribe(callback: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** true บน compact/mobile (< 768px) — SSR ถือว่าเป็น compact ก่อน */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}

const DESKTOP_QUERY = "(min-width: 1024px)"; // ตรงกับ Tailwind lg — Claude Design turn 7 shell (§1.10)

function subscribeDesktop(callback: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** true บน desktop (≥ 1024px) — SSR ถือว่าไม่ใช่ desktop ก่อน (mobile-first เหมือน useIsMobile, §1.10) */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
