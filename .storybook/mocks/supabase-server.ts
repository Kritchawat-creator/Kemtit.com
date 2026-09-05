/** mock ของ @/lib/supabase/server ใน Storybook — server action ที่ถูกเรียกจาก story จะ throw ให้เห็นชัด */
export async function createServerSupabase(): Promise<never> {
  throw new Error("Supabase server client ไม่พร้อมใช้ใน Storybook");
}
export type ServerSupabase = never;
