-- ---------- รูปภาพ (Claude Design turn 5): ภาพเป้าหมาย · gallery ความคืบหน้า · รูปแนบงาน · รูปโปรไฟล์ ----------
-- เก็บไฟล์ใน Storage bucket "photos" (อ่านสาธารณะ, เขียนได้เฉพาะโฟลเดอร์ของตัวเอง = <user_id>/...)
-- ตารางเก็บแค่ path; URL สร้างจาก NEXT_PUBLIC_SUPABASE_URL ฝั่งแอป

alter table public.user_profiles add column avatar_path text check (avatar_path is null or char_length(avatar_path) between 1 and 300);
alter table public.goals add column cover_path text check (cover_path is null or char_length(cover_path) between 1 and 300);

comment on column public.user_profiles.avatar_path is 'path ใน bucket photos ของรูปโปรไฟล์ (null = ใช้ตัวอักษรย่อ)';
-- user_profiles ให้สิทธิ์ update เป็นรายคอลัมน์ (migration user_profiles) → เปิดคอลัมน์รูปโปรไฟล์ให้ client
grant update (avatar_path) on public.user_profiles to authenticated;
comment on column public.goals.cover_path is 'path ใน bucket photos ของภาพเป้าหมาย (cover บนหน้า detail)';

create table public.goal_photos (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (char_length(path) between 1 and 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.goal_photos is 'รูปความคืบหน้าของเป้าหมาย (gallery) — สูงสุด 12 รูป/เป้า (บังคับที่ action)';
create index goal_photos_goal_idx on public.goal_photos (goal_id, sort_order, created_at);

create table public.task_photos (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null check (char_length(path) between 1 and 300),
  created_at timestamptz not null default now()
);
comment on table public.task_photos is 'รูปแนบงาน — สูงสุด 5 รูป/งาน (บังคับที่ action)';
create index task_photos_task_idx on public.task_photos (task_id, created_at);

-- แถวรูปต้องชี้ไป goal/task ของ user เดียวกัน (แบบเดียวกับ task_completions)
create function public.goal_photos_check_goal_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id) then
    raise exception 'goal must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger goal_photos_goal_owner
  before insert or update on public.goal_photos
  for each row execute function public.goal_photos_check_goal_owner();

create function public.task_photos_check_task_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.tasks t where t.id = new.task_id and t.user_id = new.user_id) then
    raise exception 'task must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger task_photos_task_owner
  before insert or update on public.task_photos
  for each row execute function public.task_photos_check_task_owner();

-- ---------- RLS ----------
alter table public.goal_photos enable row level security;
alter table public.task_photos enable row level security;

create policy "goal_photos: select own" on public.goal_photos for select to authenticated using ((select auth.uid()) = user_id);
create policy "goal_photos: insert own" on public.goal_photos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goal_photos: update own" on public.goal_photos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goal_photos: delete own" on public.goal_photos for delete to authenticated using ((select auth.uid()) = user_id);

create policy "task_photos: select own" on public.task_photos for select to authenticated using ((select auth.uid()) = user_id);
create policy "task_photos: insert own" on public.task_photos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "task_photos: delete own" on public.task_photos for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.goal_photos, public.task_photos from anon;

-- ---------- Storage bucket: photos (สาธารณะสำหรับอ่าน · เขียน/ลบได้เฉพาะโฟลเดอร์ <auth.uid()>/) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "photos: public read" on storage.objects for select using (bucket_id = 'photos');
create policy "photos: insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
