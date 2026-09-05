import "server-only";

import { z } from "zod";

import { parseEnv } from "./env";

/**
 * Environment variables ฝั่ง server — import ในไฟล์ client จะพังตอน build (server-only)
 * แยกกลุ่มตาม milestone ที่ใช้ เพื่อให้ dev ที่ยังไม่ตั้งค่า LINE (M5) รัน M1-M4 ได้
 */

const supabaseServerSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const cronSchema = z.object({
  CRON_SECRET: z.string().min(16),
});

const lineSchema = z.object({
  LINE_CHANNEL_SECRET: z.string().min(1),
  // ว่าง = dry-run: log แทนส่งจริง (dev/E2E) — ใส่ token เมื่อมี LINE OA จริง
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_LINE_OA_BASIC_ID: z.string().optional(),
});

/** service_role — ใช้เฉพาะ cron/webhook ผ่าน lib/supabase/admin.ts (Scope §8) */
export function getSupabaseServerEnv() {
  return parseEnv("supabase-server", supabaseServerSchema, {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

/** bearer token ของ /api/cron/* (M5) */
export function getCronEnv() {
  return parseEnv("cron", cronSchema, {
    CRON_SECRET: process.env.CRON_SECRET,
  });
}

/** LINE Messaging API (M5) — accessToken ว่าง = dry-run */
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
