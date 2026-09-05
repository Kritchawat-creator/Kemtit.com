import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl แบบไม่มี i18n routing — request config อยู่ที่ src/i18n/request.ts
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
