import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Supabase client ฝั่ง browser (anon key) — ใช้เฉพาะเมื่อจำเป็นจริง เช่น subscribe realtime (ยังไม่ใช้ใน POC) */
export function createBrowserSupabase() {
  const env = getClientEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
