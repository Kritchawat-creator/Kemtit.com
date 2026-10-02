import type { MetadataRoute } from "next";
import { cookies } from "next/headers";

import { isAppLocale, LOCALE_COOKIE } from "@/i18n/config";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import { brandThemeColor, pageBackgroundColor } from "@/styles/theme";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(requestedLocale) ? requestedLocale : "th";
  const app = locale === "en" ? en.app : th.app;

  return {
    name: locale === "th" ? `${app.name} (${app.nameLatin})` : app.name,
    short_name: app.name,
    description: app.tagline,
    lang: locale,
    dir: "ltr",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: pageBackgroundColor,
    theme_color: brandThemeColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
