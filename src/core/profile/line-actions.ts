"use server";

import { revalidatePath } from "next/cache";

import { emitEvent } from "@/core/events/emit";
import { fail, ok, type ActionResult } from "@/core/shared/result";
import { createServerSupabase } from "@/lib/supabase/server";

import { getLineStatus, setLinkCode, unlinkLineByUserId } from "./admin";
import { generateLinkCode, isLinkCodeExpired, linkCodeExpiry } from "./line";

async function currentUserId() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

export type LineLinkView = {
  linked: boolean;
  linkedAt: string | null;
  code: string | null;
  codeExpiresAt: string | null;
};

/** ขอรหัส 6 ตัวสำหรับพิมพ์ในแชท OA (Decision 2.1) — เขียนคอลัมน์ line_* ผ่าน service_role เท่านั้น */
export async function createLineLinkCode(): Promise<ActionResult<LineLinkView>> {
  const ctx = await currentUserId();
  if (!ctx) return fail("unauthorized");

  const code = generateLinkCode();
  const expiresAt = linkCodeExpiry();
  const saved = await setLinkCode(ctx.userId, code, expiresAt);
  if (!saved) return fail("generic");

  revalidatePath("/settings");
  return ok({ linked: false, linkedAt: null, code, codeExpiresAt: expiresAt });
}

/** สถานะปัจจุบัน — หน้าตั้งค่า poll ทุก 3 วิระหว่างรอรหัสจากแชท */
export async function getLineLinkStatus(): Promise<ActionResult<LineLinkView>> {
  const ctx = await currentUserId();
  if (!ctx) return fail("unauthorized");
  const status = await getLineStatus(ctx.userId);
  if (!status) return fail("notFound");
  const codeAlive = status.code && !isLinkCodeExpired(status.codeExpiresAt);
  return ok({
    linked: status.lineUserId !== null,
    linkedAt: status.linkedAt,
    code: codeAlive ? status.code : null,
    codeExpiresAt: codeAlive ? status.codeExpiresAt : null,
  });
}

export async function unlinkLine(): Promise<ActionResult> {
  const ctx = await currentUserId();
  if (!ctx) return fail("unauthorized");
  const done = await unlinkLineByUserId(ctx.userId);
  if (!done) return fail("generic");
  await emitEvent(ctx.supabase, ctx.userId, "line.unlinked", {});
  revalidatePath("/settings");
  return ok(null);
}
