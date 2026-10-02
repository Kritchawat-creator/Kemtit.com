import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import en from "../messages/en.json";
import th from "../messages/th.json";
import {
  APP_TIME_ZONE,
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = isAppLocale(cookieLocale)
    ? cookieLocale
    : DEFAULT_LOCALE;

  return {
    locale,
    timeZone: APP_TIME_ZONE,
    // Do not fall back to Thai keys while English is selected. Missing
    // translations should be caught by catalog parity tests instead of
    // silently producing a mixed-language UI.
    messages: locale === "en" ? en : th,
  };
});
