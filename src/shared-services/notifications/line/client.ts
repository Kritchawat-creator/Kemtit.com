/**
 * LINE Messaging API แบบเบา (fetch) — push/reply ข้อความตัวอักษร
 * quota: push นับโควตาแผน OA (R1) · reply ฟรี — ใช้ reply ทุกครั้งที่ตอบ webhook
 */
const LINE_API = "https://api.line.me/v2/bot/message";

export type LineTextMessage = { type: "text"; text: string };
export type LineApiResult = { ok: true } | { ok: false; status: number; error: string };

export class LineClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async post(path: string, body: unknown): Promise<LineApiResult> {
    const res = await this.fetchImpl(`${LINE_API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.accessToken}` },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  }

  push(to: string, text: string): Promise<LineApiResult> {
    return this.post("push", { to, messages: [{ type: "text", text } satisfies LineTextMessage] });
  }

  reply(replyToken: string, text: string): Promise<LineApiResult> {
    return this.post("reply", {
      replyToken,
      messages: [{ type: "text", text } satisfies LineTextMessage],
    });
  }
}
