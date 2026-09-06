import { z } from "zod";

import type { PhotoKind } from "@/lib/supabase/storage";
import type { Database } from "@/types/database";

export type GoalPhotoRow = Database["public"]["Tables"]["goal_photos"]["Row"];
export type TaskPhotoRow = Database["public"]["Tables"]["task_photos"]["Row"];

/** รูปที่ UI ใช้: id แถว (null สำหรับ cover/avatar ที่เก็บเป็นคอลัมน์) + path ใน bucket */
export type Photo = { id: string; path: string };

export const PHOTO_KINDS = [
  "goalCover",
  "goalPhoto",
  "taskPhoto",
  "avatar",
] as const satisfies readonly PhotoKind[];

/** ผูกไฟล์ที่อัปโหลดแล้ว (client อัปโหลดตรงเข้า Storage ผ่าน RLS) เข้ากับ goal/task/profile */
export const attachPhotoSchema = z
  .object({
    kind: z.enum(PHOTO_KINDS),
    targetId: z.uuid().optional(),
    path: z.string().min(1).max(300),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== "avatar" && !value.targetId) {
      ctx.addIssue({ code: "custom", path: ["targetId"], message: "required" });
    }
  });
export type AttachPhotoInput = z.infer<typeof attachPhotoSchema>;

export const removePhotoSchema = z.object({
  kind: z.enum(PHOTO_KINDS),
  /** goalPhoto/taskPhoto = id แถวรูป · goalCover = goal id · avatar = ไม่ต้องส่ง */
  id: z.uuid().optional(),
});
export type RemovePhotoInput = z.infer<typeof removePhotoSchema>;
