import "server-only";

import type { ISODate } from "@/lib/date";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** task เดี่ยวที่เลยกำหนดและยังไม่เสร็จของ user (service_role — ใช้ใน job สแกนรายวัน) */
export async function listOverdueTaskIds(
  userId: string,
  today: ISODate,
  limit = 20,
): Promise<string[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", userId)
    .is("recurrence_rule", null)
    .is("completed_at", null)
    .lt("due_date", today)
    .order("due_date")
    .limit(limit);
  return (data ?? []).map((t) => t.id);
}

export async function getTaskTitles(userId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("tasks")
    .select("id, title")
    .eq("user_id", userId)
    .in("id", ids);
  const byId = new Map((data ?? []).map((t) => [t.id, t.title]));
  return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}
