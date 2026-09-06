import "server-only";

import { UPLOADS_ENABLED } from "@/lib/flags";
import type { ServerSupabase } from "@/lib/supabase/server";
import { isOwnPhotoPath, PHOTO_BUCKET, signedUrlWindow } from "@/lib/supabase/storage";

import type { Photo } from "./schema";

/**
 * Signed URL ของรูป (Design §6A.2: bucket private · อายุ ≥1 ชม.)
 * - ลงชื่อด้วย client ของ user เอง → RLS "photos: select own folder" คือตัวตัดสิน ไม่ใช้ service_role
 * - token ของ Supabase มี iat จึงต่างกันทุกวินาที → cache ต่อ instance คีย์ (user, ชั่วโมงเต็ม, path)
 *   ให้ทุก render ในชั่วโมงเดียวกันได้ URL เดิม (browser cache รูปทำงาน ไม่โหลดซ้ำ) · exp ปัดเป็นชั่วโมงเต็ม
 * - lookup ผ่าน key ที่มี user id เสมอ → user อื่นไม่มีทางได้ URL ของคนอื่นจาก cache แม้ query layer จะมี bug
 */
const cache = new Map<string, string>();
let cacheHour = -1;

function cacheKey(userId: string, hour: number, path: string) {
  return `${userId}|${hour}|${path}`;
}

/** ล้าง cache เมื่อข้ามชั่วโมง (entry เก่าหมดอายุพร้อมกันทั้งชุด) */
function sweep(hour: number) {
  if (hour === cacheHour) return;
  cache.clear();
  cacheHour = hour;
}

/** สำหรับ test เท่านั้น */
export function _resetSignedUrlCache() {
  cache.clear();
  cacheHour = -1;
}

/**
 * path → signed URL (null = ไม่ใช่ของ user / ลงชื่อไม่ได้ / flag ปิด)
 * paths ที่ไม่อยู่ในโฟลเดอร์ของ user ไม่ถูกส่งไปลงชื่อเลย
 */
export async function signPhotoUrls(
  supabase: ServerSupabase,
  userId: string,
  paths: readonly string[],
  nowMs: number = Date.now(),
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (paths.length === 0) return result;
  if (!UPLOADS_ENABLED) {
    for (const path of paths) result.set(path, null);
    return result;
  }

  const { hour, expiresIn } = signedUrlWindow(nowMs);
  sweep(hour);

  const missing: string[] = [];
  for (const path of new Set(paths)) {
    if (!isOwnPhotoPath(path, userId)) {
      result.set(path, null);
      continue;
    }
    const hit = cache.get(cacheKey(userId, hour, path));
    if (hit) result.set(path, hit);
    else missing.push(path);
  }
  if (missing.length === 0) return result;

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(missing, expiresIn);
  if (error || !data) {
    console.error("[photos] createSignedUrls failed", { message: error?.message });
    for (const path of missing) result.set(path, null);
    return result;
  }
  for (const item of data) {
    // Supabase ส่ง path กลับมาให้ (null เมื่อ error รายไฟล์)
    const path = item.path ?? missing[data.indexOf(item)];
    if (!path) continue;
    if (item.error || !item.signedUrl) {
      result.set(path, null);
      continue;
    }
    cache.set(cacheKey(userId, hour, path), item.signedUrl);
    result.set(path, item.signedUrl);
  }
  for (const path of missing) if (!result.has(path)) result.set(path, null);
  return result;
}

export type SignedPhoto = Photo & {
  /** null = ลงชื่อไม่ได้/ไม่ใช่ของ user/flag ปิด → UI แสดง tile เทา (Design §6A.4) */
  url: string | null;
};

/** ลงชื่อ URL ให้รูปทุกรูปของ task หลาย ๆ อันใน batch เดียว — ใช้ใน core/tasks/queries (ข้ามเมื่อไม่มีรูปหรือ flag ปิด) */
export async function withSignedPhotoUrls<T extends { photos?: Photo[] }>(
  supabase: ServerSupabase,
  tasks: T[],
): Promise<(Omit<T, "photos"> & { photos?: SignedPhoto[] })[]> {
  const paths = tasks.flatMap((task) => (task.photos ?? []).map((photo) => photo.path));
  let urls = new Map<string, string | null>();
  if (paths.length > 0 && UPLOADS_ENABLED) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) urls = await signPhotoUrls(supabase, user.id, paths);
  }
  return tasks.map((task) => ({
    ...task,
    photos: task.photos?.map((photo) => ({ ...photo, url: urls.get(photo.path) ?? null })),
  }));
}
