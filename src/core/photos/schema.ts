import { z } from "zod";

import type { PhotoKind } from "@/lib/supabase/storage";
import type { Database } from "@/types/database";

export type TaskPhotoRow = Database["public"]["Tables"]["task_photos"]["Row"];

/** รูปที่ UI ใช้: id แถว (สำหรับ avatar = user id) + path ใน bucket · URL ลงชื่อฝั่ง server (core/photos/queries) */
export type Photo = { id: string; path: string };

/** รูปผูกได้กับ task และโปรไฟล์เท่านั้น — goalCover/goalPhoto ถูกถอดถาวรตาม Design §6A.1 */
export const PHOTO_KINDS = ["taskPhoto", "avatar"] as const satisfies readonly PhotoKind[];

/** ผูกไฟล์ที่อัปโหลดแล้ว (client อัปโหลดตรงเข้า Storage ผ่าน RLS) เข้ากับ task/profile */
export const attachPhotoSchema = z
  .object({
    kind: z.enum(PHOTO_KINDS),
    /** taskPhoto = task id · avatar = ไม่ต้องส่ง */
    targetId: z.uuid().optional(),
    path: z.string().min(1).max(300),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "taskPhoto" && !value.targetId) {
      ctx.addIssue({ code: "custom", path: ["targetId"], message: "required" });
    }
  });
export type AttachPhotoInput = z.infer<typeof attachPhotoSchema>;

export const removePhotoSchema = z.object({
  kind: z.enum(PHOTO_KINDS),
  /** taskPhoto = id แถวรูป · avatar = ไม่ต้องส่ง */
  id: z.uuid().optional(),
});
export type RemovePhotoInput = z.infer<typeof removePhotoSchema>;
