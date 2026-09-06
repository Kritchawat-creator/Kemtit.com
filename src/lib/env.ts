import { z } from "zod";

/**
 * Environment variables — ฝั่งที่ client import ได้ (เฉพาะ NEXT_PUBLIC_*)
 * ฝั่ง server ดู env.server.ts
 *
 * หลักการ (POC Decisions M0 ข้อ 3):
 * - validate แบบ lazy ตอนเรียกใช้ ไม่ใช่ตอน import → `next build` ไม่ล้มเพราะไม่มี env
 * - ข้าม validation เฉพาะเมื่อ SKIP_ENV_VALIDATION=1 (ตั้งใน ci.yml เท่านั้น — CI มีแค่ค่า placeholder)
 * - NEXT_PUBLIC_* ต้องอ้างแบบ static `process.env.NEXT_PUBLIC_X` เพื่อให้ Next ฝังลง client bundle
 */

export function shouldSkipEnvValidation(): boolean {
  // ตั้งใจไม่ดู CI=true: Netlify ตั้งค่านี้ตอน build และอาจหลุดไป runtime → secret ที่ขาดจะ crash แบบอ่านไม่ออกแทน error ที่ชัด
  return process.env.SKIP_ENV_VALIDATION === "1";
}

/** parse env กลุ่มหนึ่ง — throw พร้อมชื่อตัวแปรที่ผิด (ไม่ log ค่า) */
export function parseEnv<T extends z.ZodRawShape>(
  group: string,
  schema: z.ZodObject<T>,
  raw: Record<keyof z.infer<z.ZodObject<T>>, string | undefined>,
): z.infer<z.ZodObject<T>> {
  if (shouldSkipEnvValidation()) {
    return raw as z.infer<z.ZodObject<T>>;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(
      `[env] กลุ่ม "${group}" ไม่ครบหรือไม่ถูกต้อง: ${keys.join(", ")} — ดูรายการใน .env.example`,
    );
  }
  return result.data;
}

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type ClientEnv = z.infer<typeof clientSchema>;

export function getClientEnv(): ClientEnv {
  return parseEnv("client", clientSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}
