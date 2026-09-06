/**
 * Storage bucket "photos" (migrations 20260906120000_photos + 20260906180000_uploads_private)
 * bucket เป็น private: อ่านผ่าน signed URL ที่ลงชื่อด้วย client ของ user เอง (RLS select = โฟลเดอร์ <user_id>/ เท่านั้น)
 * path: รูปแนบงาน <user_id>/<task_id>/<uuid>.<ext> · รูปโปรไฟล์ <user_id>/avatar/<uuid>.<ext> (Design §6A.2)
 * ไฟล์นี้ import ได้ทั้ง client/server (ไม่มี server-only) — การลงชื่อ URL อยู่ที่ core/photos/queries.ts (server)
 */
export const PHOTO_BUCKET = "photos";
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB ต่อรูปก่อนย่อ (MVP: ย่อเป็น WebP ≤2MB ฝั่ง client)
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** ย่อรูปฝั่ง client ก่อนอัปโหลด — ด้านยาวสุด 1600px */
export const PHOTO_MAX_EDGE = 1600;
/** เพดานต่อ task ใน POC (MVP: Free 1 / Pro 5 ตรวจจาก subscription_tier ฝั่ง server) */
export const TASK_PHOTO_LIMIT = 5;
/** โฟลเดอร์ที่สองของรูปโปรไฟล์ (task ใช้ task_id) */
export const AVATAR_FOLDER = "avatar";
/** signed URL อายุอย่างน้อย 1 ชม. — ปัด exp เป็นชั่วโมงเต็มเพื่อให้ URL ใน 1 ชั่วโมงเดียวกันคงที่ (browser cache ทำงาน) */
export const SIGNED_URL_HOUR_SECONDS = 3600;

/** รูปผูกได้กับ task และโปรไฟล์เท่านั้น (Design §6A.1: ไม่มีรูปที่ goal) */
export type PhotoKind = "taskPhoto" | "avatar";

export function isAllowedPhotoType(type: string): boolean {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(type);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** path ใน bucket สำหรับไฟล์ใหม่ — taskPhoto ต้องมี taskId */
export function photoPathFor(
  kind: PhotoKind,
  userId: string,
  fileName: string,
  taskId?: string,
): string {
  const folder = kind === "avatar" ? AVATAR_FOLDER : taskId;
  if (!folder) throw new Error("taskId required for taskPhoto path");
  return `${userId}/${folder}/${fileName}`;
}

/** path ต้องอยู่ในโฟลเดอร์ของ user (ตรงกับ RLS ของ storage.objects) */
export function isOwnPhotoPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes("..");
}

/** path ของรูปแนบงานต้องเป็น <user_id>/<task_id>/<file> — ให้ listener task.deleted (MVP) ลบทั้งโฟลเดอร์ได้ */
export function isTaskPhotoPath(path: string, userId: string, taskId: string): boolean {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === userId &&
    parts[1] === taskId &&
    UUID_RE.test(taskId) &&
    parts[2].length > 0
  );
}

export function isAvatarPath(path: string, userId: string): boolean {
  const parts = path.split("/");
  return (
    parts.length === 3 && parts[0] === userId && parts[1] === AVATAR_FOLDER && parts[2].length > 0
  );
}

/**
 * ช่วงเวลาของ signed URL: bucket = ชั่วโมงเต็มปัจจุบัน · exp = ต้นชั่วโมงถัดไป + 1 ชม. → อายุจริง 1–2 ชม.
 * (ไม่ปัดลงเป็น "ชั่วโมงถัดไป" ตรง ๆ เพราะ URL ที่ออกตอน 14:59 จะตายใน 1 นาที)
 * ใช้ hour เป็น key ของ cache ฝั่ง server — token ของ Supabase มี iat จึงต้องลงชื่อครั้งเดียวต่อชั่วโมงแล้ว cache ไม่ใช่หวังให้ token เท่ากันเอง
 */
export function signedUrlWindow(nowMs: number = Date.now()) {
  const nowSec = Math.floor(nowMs / 1000);
  const hour = Math.floor(nowSec / SIGNED_URL_HOUR_SECONDS);
  const expiresAt = (hour + 2) * SIGNED_URL_HOUR_SECONDS;
  return { hour, expiresAt, expiresIn: expiresAt - nowSec };
}
