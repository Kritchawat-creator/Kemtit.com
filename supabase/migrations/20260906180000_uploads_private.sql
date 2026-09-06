-- ---------- Uploads ตาม Design §6A (2026-09-06): bucket photos เป็น private + รูปผูก task เท่านั้น ----------
-- 1) bucket photos: public → private — อ่านได้เฉพาะโฟลเดอร์ของตัวเอง (<auth.uid()>/…) ผ่าน signed URL ที่ลงชื่อด้วย client ของ user
--    (policy select นี้คือตัวตัดสินว่า createSignedUrl สำเร็จไหม — ไม่ใช้ service_role ลงชื่อ)
-- 2) ทิ้ง schema รูปของ goal (goal_photos, goals.cover_path) — spec ใหม่ไม่มีรูปที่ goal และยังไม่มีข้อมูล production
--    user_profiles.avatar_path คงไว้ (avatar เปิดพร้อม attachments ใน MVP ใต้ flag เดียวกัน)
-- path ใหม่ของรูปแนบงาน = <user_id>/<task_id>/<uuid>.<ext> (RLS ดูแค่โฟลเดอร์แรก · listener task.deleted ใน MVP ลบทั้งโฟลเดอร์ task)

update storage.buckets set public = false where id = 'photos';

drop policy if exists "photos: public read" on storage.objects;
create policy "photos: select own folder" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- update เดิมมีแค่ using → เพิ่ม with check กันย้ายไฟล์ออกนอกโฟลเดอร์ตัวเอง
drop policy if exists "photos: update own folder" on storage.objects;
create policy "photos: update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- รูปของ goal: ทิ้งทั้งตาราง trigger function และคอลัมน์ cover ----------
drop table if exists public.goal_photos;
drop function if exists public.goal_photos_check_goal_owner();
alter table public.goals drop column if exists cover_path;
