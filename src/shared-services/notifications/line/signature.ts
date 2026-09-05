import { createHmac, timingSafeEqual } from "node:crypto";

/** ตรวจ X-Line-Signature = base64(HMAC-SHA256(channelSecret, rawBody)) — R7 */
export function verifyLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signLineBody(rawBody: string, channelSecret: string): string {
  return createHmac("sha256", channelSecret).update(rawBody).digest("base64");
}
