/**
 * Storage bucket "photos" (migration 20260906120000_photos): ไฟล์อยู่ที่ <user_id>/<kind>/<uuid>.jpg
 * ไฟล์นี้ import ได้ทั้ง client/server (ไม่มี server-only) — URL สาธารณะสร้างจากตัวแปร public
 */
export const PHOTO_BUCKET = "photos";
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB ต่อรูป (Claude Design 5b)
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** ย่อรูปฝั่ง client ก่อนอัปโหลด — ด้านยาวสุด 1600px พอสำหรับ cover/gallery และประหยัดโควตา */
export const PHOTO_MAX_EDGE = 1600;
export const GOAL_PHOTO_LIMIT = 12;
export const TASK_PHOTO_LIMIT = 5;

export type PhotoKind = "goalCover" | "goalPhoto" | "taskPhoto" | "avatar";

export function isAllowedPhotoType(type: string): boolean {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(type);
}

/** path ใน bucket → URL สาธารณะ (bucket photos เป็น public read) */
export function photoPublicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/** path ต้องอยู่ในโฟลเดอร์ของ user (ตรงกับ RLS ของ storage.objects) */
export function isOwnPhotoPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes("..");
}
