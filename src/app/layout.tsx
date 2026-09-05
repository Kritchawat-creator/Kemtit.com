import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { brandThemeColor, plexThai } from "@/styles/theme";

import "@/styles/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: {
      default: `${t("name")} · ${t("nameLatin")}`,
      template: `%s · ${t("name")}`,
    },
    description: t("tagline"),
    applicationName: t("nameLatin"),
  };
}

export const viewport: Viewport = {
  themeColor: brandThemeColor,
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={plexThai.variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
