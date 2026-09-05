import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getClientEnv } from "@/lib/env";
import { getSupabaseServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * service_role client — ข้าม RLS ทั้งหมด
 * ใช้เฉพาะ cron (/api/cron/*), LINE webhook และงานที่ต้องเขียนคอลัมน์ที่ client แก้ไม่ได้ (line_*)
 * ทุกที่ที่ใช้ต้องกรอง user_id เองเสมอ (Scope §8)
 */
export function createAdminSupabase() {
  const env = getClientEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getSupabaseServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
