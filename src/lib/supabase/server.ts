import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getClientEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client สำหรับ Server Component / Server Action / Route Handler
 * ใช้ session ของ user (anon key + cookie) → ทุก query ผ่าน RLS (Scope §8)
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const env = getClientEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // เรียกจาก Server Component ซึ่งเซ็ต cookie ไม่ได้ — proxy.ts เป็นคน refresh session แทน
          }
        },
      },
    },
  );
}

export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
