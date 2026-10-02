import "server-only";

import { z } from "zod";

import { parseEnv } from "./env";

/**
 * Environment variables ฝั่ง server — import ในไฟล์ client จะพังตอน build (server-only)
 * แยกกลุ่มตาม milestone เพื่อให้ integration ที่ยังไม่ configure ไม่บล็อก core app.
 */

const supabaseServerSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const cronSchema = z.object({
  CRON_SECRET: z.string().min(16),
});

const lineSchema = z.object({
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_LINE_OA_BASIC_ID: z.string().optional(),
});

const googleCalendarSchema = z.object({
  GOOGLE_CALENDAR_CLIENT_ID: z.string().min(1),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALENDAR_REDIRECT_URI: z.url(),
  CALENDAR_TOKEN_ENCRYPTION_KEY: z.string().min(32),
});

const outlookCalendarSchema = z.object({
  OUTLOOK_CALENDAR_CLIENT_ID: z.string().min(1),
  OUTLOOK_CALENDAR_CLIENT_SECRET: z.string().min(1),
  OUTLOOK_CALENDAR_REDIRECT_URI: z.url(),
  CALENDAR_TOKEN_ENCRYPTION_KEY: z.string().min(32),
});

export function getSupabaseServerEnv() {
  return parseEnv("supabase-server", supabaseServerSchema, {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function getCronEnv() {
  return parseEnv("cron", cronSchema, {
    CRON_SECRET: process.env.CRON_SECRET,
  });
}

export function getLineEnv() {
  const env = parseEnv("line", lineSchema, {
    LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET,
    LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    NEXT_PUBLIC_LINE_OA_BASIC_ID: process.env.NEXT_PUBLIC_LINE_OA_BASIC_ID,
  });
  return {
    channelSecret: env.LINE_CHANNEL_SECRET,
    accessToken: env.LINE_CHANNEL_ACCESS_TOKEN || undefined,
    basicId: env.NEXT_PUBLIC_LINE_OA_BASIC_ID || undefined,
  };
}

/**
 * Optional Google Calendar adapter configuration.
 * Call only from provider-boundary code; the rest of Kemtit must not depend on it.
 */
export function getGoogleCalendarEnv() {
  const env = parseEnv("google-calendar", googleCalendarSchema, {
    GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REDIRECT_URI: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    CALENDAR_TOKEN_ENCRYPTION_KEY: process.env.CALENDAR_TOKEN_ENCRYPTION_KEY,
  });

  return {
    clientId: env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALENDAR_REDIRECT_URI,
    tokenEncryptionKey: env.CALENDAR_TOKEN_ENCRYPTION_KEY,
  };
}

export function isGoogleCalendarConfigured(): boolean {
  try {
    getGoogleCalendarEnv();
    return true;
  } catch {
    return false;
  }
}

/** Optional Outlook Calendar adapter configuration, independent from Google setup. */
export function getOutlookCalendarEnv() {
  const env = parseEnv("outlook-calendar", outlookCalendarSchema, {
    OUTLOOK_CALENDAR_CLIENT_ID: process.env.OUTLOOK_CALENDAR_CLIENT_ID,
    OUTLOOK_CALENDAR_CLIENT_SECRET: process.env.OUTLOOK_CALENDAR_CLIENT_SECRET,
    OUTLOOK_CALENDAR_REDIRECT_URI: process.env.OUTLOOK_CALENDAR_REDIRECT_URI,
    CALENDAR_TOKEN_ENCRYPTION_KEY: process.env.CALENDAR_TOKEN_ENCRYPTION_KEY,
  });

  return {
    clientId: env.OUTLOOK_CALENDAR_CLIENT_ID,
    clientSecret: env.OUTLOOK_CALENDAR_CLIENT_SECRET,
    redirectUri: env.OUTLOOK_CALENDAR_REDIRECT_URI,
    tokenEncryptionKey: env.CALENDAR_TOKEN_ENCRYPTION_KEY,
  };
}

export function isOutlookCalendarConfigured(): boolean {
  try {
    getOutlookCalendarEnv();
    return true;
  } catch {
    return false;
  }
}
