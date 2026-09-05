import type { Notifier, NotifyResult } from "@/core/ports/notifier";
import { getLineEnv } from "@/lib/env.server";

import { LineClient } from "./client";

/** ส่งจริงผ่าน Messaging API */
export class LineNotifier implements Notifier {
  readonly channel = "line" as const;
  readonly dryRun = false;
  constructor(private readonly client: LineClient) {}

  async push(recipientId: string, text: string): Promise<NotifyResult> {
    const result = await this.client.push(recipientId, text);
    return result.ok ? { ok: true, dryRun: false } : { ok: false, error: `LINE ${result.status}: ${result.error}` };
  }
}

/** dev/E2E: ไม่มี token → log แทนส่ง (ข้อความยังถูกบันทึกเป็น notification.sent dryRun=true) */
export class DryRunNotifier implements Notifier {
  readonly channel = "line" as const;
  readonly dryRun = true;
  async push(recipientId: string, text: string): Promise<NotifyResult> {
    console.info("[line dry-run] push", { to: recipientId, text });
    return { ok: true, dryRun: true };
  }
}

export function getNotifier(): Notifier {
  const { accessToken } = getLineEnv();
  return accessToken ? new LineNotifier(new LineClient(accessToken)) : new DryRunNotifier();
}

/** reply ผ่าน webhook (ฟรี) — dry-run เมื่อไม่มี token */
export async function replyText(replyToken: string, text: string): Promise<void> {
  const { accessToken } = getLineEnv();
  if (!accessToken) {
    console.info("[line dry-run] reply", { replyToken, text });
    return;
  }
  const result = await new LineClient(accessToken).reply(replyToken, text);
  if (!result.ok) console.error("[line] reply failed", { status: result.status });
}
