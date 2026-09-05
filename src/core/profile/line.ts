/**
 * รหัสเชื่อมบัญชี LINE (POC Decisions 2.1): 6 ตัว หมดอายุ 10 นาที เก็บใน user_profiles.line_link_code
 * pure — ไม่แตะ DB
 */
export const LINK_CODE_LENGTH = 6;
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
/** ตัด I, O, 0, 1 ออก กันอ่านสับสนตอนพิมพ์ในแชท */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLinkCode(random: (bytes: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(LINK_CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** ข้อความจากแชท → รหัสมาตรฐาน (ตัดช่องว่าง/ตัวพิมพ์เล็ก) หรือ null ถ้าไม่ใช่รูปแบบรหัส */
export function normalizeLinkCode(text: string): string | null {
  const cleaned = text.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6}$/.test(cleaned) ? cleaned : null;
}

export function linkCodeExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString();
}

export function isLinkCodeExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** แสดง LINE userId แบบปิดบัง (U1234…89ab) */
export function maskLineUserId(lineUserId: string): string {
  if (lineUserId.length <= 8) return "••••";
  return `${lineUserId.slice(0, 5)}…${lineUserId.slice(-4)}`;
}
