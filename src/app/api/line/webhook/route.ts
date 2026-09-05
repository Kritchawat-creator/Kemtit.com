import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { insertEventAsAdmin } from "@/core/events/admin";
import { findProfileByLinkCode, linkLineAccount, unlinkLineByLineUserId } from "@/core/profile/admin";
import { isLinkCodeExpired, normalizeLinkCode } from "@/core/profile/line";
import { getLineEnv } from "@/lib/env.server";
import { replyText } from "@/shared-services/notifications/line/notifier";
import { verifyLineSignature } from "@/shared-services/notifications/line/signature";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

const lineEventSchema = z.object({
  type: z.string(),
  replyToken: z.string().optional(),
  source: z.object({ type: z.string(), userId: z.string().optional() }).optional(),
  message: z.object({ type: z.string(), text: z.string().optional() }).optional(),
});
const bodySchema = z.object({ destination: z.string().optional(), events: z.array(lineEventSchema).default([]) });
type LineEvent = z.infer<typeof lineEventSchema>;
type LineT = Awaited<ReturnType<typeof getTranslations<"line">>>;

/**
 * LINE webhook (Decision 2.1): user พิมพ์รหัส 6 ตัว → ผูก line_user_id · follow → วิธีใช้ · unfollow → ตัดการเชื่อม
 * ตรวจ X-Line-Signature ก่อนอ่าน body (R7); ตอบ 200 เร็ว; reply ผ่าน replyToken (ฟรี ไม่กินโควตา push)
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const { channelSecret } = getLineEnv();
  if (!verifyLineSignature(raw, request.headers.get("x-line-signature"), channelSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const t = await getTranslations("line");
  let handled = 0;
  for (const event of parsed.data.events) {
    try {
      if (await handleEvent(event, t)) handled += 1;
    } catch (error) {
      console.error("[line webhook] event failed", { type: event.type, error });
    }
  }
  return NextResponse.json({ handled });
}

async function handleEvent(event: LineEvent, t: LineT): Promise<boolean> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return false;

  if (event.type === "follow") {
    if (event.replyToken) await replyText(event.replyToken, t("greeting"));
    return true;
  }

  if (event.type === "unfollow") {
    const userId = await unlinkLineByLineUserId(lineUserId);
    if (userId) await insertEventAsAdmin(userId, "line.unlinked", {});
    return true;
  }

  if (event.type === "message" && event.message?.type === "text") {
    const code = normalizeLinkCode(event.message.text ?? "");
    if (!code) {
      if (event.replyToken) await replyText(event.replyToken, t("notCode"));
      return true;
    }
    const profile = await findProfileByLinkCode(code);
    if (!profile || isLinkCodeExpired(profile.line_link_code_expires_at)) {
      if (event.replyToken) await replyText(event.replyToken, t("linkInvalid"));
      return true;
    }
    const linked = await linkLineAccount(profile.id, lineUserId);
    if (linked) await insertEventAsAdmin(profile.id, "line.linked", {});
    if (event.replyToken) await replyText(event.replyToken, linked ? t("linkSuccess") : t("linkInvalid"));
    return true;
  }

  return false;
}
