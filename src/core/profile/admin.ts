import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import type { ISODate } from "@/lib/date";

/**
 * งานฝั่ง service_role เกี่ยวกับ profile — คอลัมน์ line_* / last_overdue_notified_on ที่ client แก้ไม่ได้
 * ทุกฟังก์ชันกรอง user id เองเสมอ (Scope §8)
 */
export type LineStatus = {
  lineUserId: string | null;
  linkedAt: string | null;
  code: string | null;
  codeExpiresAt: string | null;
};

export async function getLineStatus(userId: string): Promise<LineStatus | null> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("user_profiles")
    .select("line_user_id, line_linked_at, line_link_code, line_link_code_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    lineUserId: data.line_user_id,
    linkedAt: data.line_linked_at,
    code: data.line_link_code,
    codeExpiresAt: data.line_link_code_expires_at,
  };
}

export async function setLinkCode(
  userId: string,
  code: string,
  expiresAt: string,
): Promise<boolean> {
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("user_profiles")
    .update({ line_link_code: code, line_link_code_expires_at: expiresAt })
    .eq("id", userId);
  if (error) console.error("[line] setLinkCode failed", { code: error.code });
  return !error;
}

export async function findProfileByLinkCode(code: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("user_profiles")
    .select("id, line_link_code_expires_at")
    .eq("line_link_code", code)
    .maybeSingle();
  return data;
}

/** ผูก LINE userId กับ user — false ถ้า userId นี้ผูกกับบัญชีอื่นอยู่แล้ว (unique) */
export async function linkLineAccount(userId: string, lineUserId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("user_profiles")
    .update({
      line_user_id: lineUserId,
      line_linked_at: new Date().toISOString(),
      line_link_code: null,
      line_link_code_expires_at: null,
    })
    .eq("id", userId);
  if (error) console.error("[line] link failed", { code: error.code });
  return !error;
}

export async function unlinkLineByUserId(userId: string): Promise<boolean> {
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("user_profiles")
    .update({
      line_user_id: null,
      line_linked_at: null,
      line_link_code: null,
      line_link_code_expires_at: null,
    })
    .eq("id", userId);
  return !error;
}

/** unfollow OA → ตัดการเชื่อม (ส่ง push ไม่ได้อยู่แล้ว) */
export async function unlinkLineByLineUserId(lineUserId: string): Promise<string | null> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("user_profiles")
    .update({ line_user_id: null, line_linked_at: null })
    .eq("line_user_id", lineUserId)
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

export async function getProfileForNotification(userId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("user_profiles")
    .select("line_user_id, notify_overdue")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

/** user ที่เชื่อม LINE, เปิดแจ้งเตือน และยังไม่ได้รับแจ้งวันนี้ (idempotent ต่อวัน — R16) */
export async function listOverdueScanCandidates(today: ISODate, limit: number) {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("user_profiles")
    .select("id, line_user_id")
    .not("line_user_id", "is", null)
    .eq("notify_overdue", true)
    .or(`last_overdue_notified_on.is.null,last_overdue_notified_on.lt.${today}`)
    .limit(limit);
  if (error) console.error("[overdue] list candidates failed", { code: error.code });
  return (data ?? []) as { id: string; line_user_id: string }[];
}

export async function setOverdueNotified(userId: string, today: ISODate): Promise<void> {
  const admin = createAdminSupabase();
  await admin.from("user_profiles").update({ last_overdue_notified_on: today }).eq("id", userId);
}
