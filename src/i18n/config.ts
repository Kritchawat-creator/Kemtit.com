export const APP_LOCALES = ["th", "en"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "th";
export const LOCALE_COOKIE = "KEMTIT_LOCALE";
export const APP_TIME_ZONE = "Asia/Bangkok";

export const LOCALE_CONFIG: Record<
  AppLocale,
  {
    intlLocale: string;
    dateFnsLocale: "th" | "en-GB";
    calendar: "buddhist" | "gregory";
    weekStartsOn: 0;
  }
> = {
  th: {
    intlLocale: "th-TH-u-ca-buddhist",
    dateFnsLocale: "th",
    calendar: "buddhist",
    weekStartsOn: 0,
  },
  en: {
    intlLocale: "en-GB-u-ca-gregory",
    dateFnsLocale: "en-GB",
    calendar: "gregory",
    weekStartsOn: 0,
  },
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (APP_LOCALES as readonly string[]).includes(value);
}

export function intlLocale(locale: AppLocale) {
  return LOCALE_CONFIG[locale].intlLocale;
}
