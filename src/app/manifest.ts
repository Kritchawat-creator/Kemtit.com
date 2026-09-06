import type { MetadataRoute } from "next";

import { brandThemeColor, pageBackgroundColor } from "@/styles/theme";

/** Web App Manifest (Scope §9 PWA) — ติดตั้งได้บน Android/Chrome; iOS ใช้ apple-touch-icon จาก metadata ของ layout */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "เข็มทิศ (Kemtit)",
    short_name: "เข็มทิศ",
    description: "เปลี่ยนเป้าใหญ่ทั้งปี ให้เป็นสิ่งที่ต้องทำวันนี้",
    lang: "th",
    dir: "ltr",
    start_url: "/dashboard",
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
