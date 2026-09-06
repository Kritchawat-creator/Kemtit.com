/**
 * Feature flags — อ่านแบบ static `process.env.NEXT_PUBLIC_*` เพื่อให้ Next ฝังลง client bundle (กฎเดียวกับ env.ts)
 * ค่า "1" = เปิด · อย่างอื่น/ไม่ตั้ง = ปิด · ตั้งค่าใน .env.local (dev) / netlify.toml (deploy) / ci.yml
 */

/**
 * user-uploaded content ทุกชนิด (รูปแนบงาน + รูปโปรไฟล์) — Design §6A.6: ปิดตลอด POC/CP1
 * ปิด = ซ่อน UI ทั้งหมด และ server action `attachPhoto`/`removePhoto` ปฏิเสธด้วย `featureDisabled`
 */
export const UPLOADS_ENABLED = process.env.NEXT_PUBLIC_FLAG_UPLOADS === "1";
