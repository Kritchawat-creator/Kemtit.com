import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl แบบไม่มี i18n routing — request config อยู่ที่ src/i18n/request.ts
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// PWA (Scope §9 Serwist): service worker สร้างตอน build เท่านั้น — precache static shell, ไม่ cache การเขียน (Q5 ไม่มี offline queue)
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default withSerwist(withNextIntl(nextConfig));
