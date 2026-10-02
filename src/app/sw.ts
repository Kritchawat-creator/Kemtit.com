import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

/**
 * Service worker (Serwist):
 * - precache build/static assets
 * - never runtime-cache authenticated/dynamic same-origin responses
 * - keep Serwist's asset caching for safe static resources
 * ไม่มี offline write queue (POC Decisions 3)
 */
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const SAFE_CACHEABLE_CROSS_ORIGIN =
  /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\//i;

const dynamicSameOriginNetworkOnly: RuntimeCaching = {
  matcher: ({ sameOrigin, url: { pathname } }) =>
    sameOrigin && !pathname.startsWith("/_next/static/"),
  method: "GET",
  handler: new NetworkOnly(),
};

const crossOriginNetworkOnly: RuntimeCaching = {
  matcher: ({ sameOrigin, url }) =>
    !sameOrigin && !SAFE_CACHEABLE_CROSS_ORIGIN.test(url.href),
  method: "GET",
  handler: new NetworkOnly(),
};

const SENSITIVE_RUNTIME_CACHES = [
  "apis",
  "next-data",
  "pages-rsc-prefetch",
  "pages-rsc",
  "pages",
  "static-data-assets",
  "others",
  "cross-origin",
];

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all(SENSITIVE_RUNTIME_CACHES.map((cacheName) => caches.delete(cacheName))).then(
      () => undefined,
    ),
  );
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [dynamicSameOriginNetworkOnly, crossOriginNetworkOnly, ...defaultCache],
});

serwist.addEventListeners();
