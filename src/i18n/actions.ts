"use server";

import { cookies } from "next/headers";

import { isAppLocale, LOCALE_COOKIE } from "./config";

export async function setAppLocale(locale: string) {
  if (!isAppLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
}
