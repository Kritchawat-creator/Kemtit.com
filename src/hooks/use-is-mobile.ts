"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639px)"; // Design §7.1: mobile < 640px

function subscribe(callback: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** true บนมือถือ (< 640px) — SSR ถือว่าเป็นมือถือก่อน (mobile-first) */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
