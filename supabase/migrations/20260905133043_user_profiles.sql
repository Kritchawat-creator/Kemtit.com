-- user_profiles: 1 แถวต่อ auth.users — สร้างอัตโนมัติด้วย trigger (POC Decisions M0 ข้อ 2)
-- Schema ตาม Scope §6 + คอลัมน์ที่ implementation-plan §2.2 E ระบุ

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  active_persona text
    check (active_persona in ('seller', 'creator', 'student', 'office')),
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro')),
  -- LINE (M5): ผูกบัญชีด้วยรหัส 6 ตัวผ่าน webhook — เขียนคอลัมน์กลุ่มนี้ผ่าน service_role เท่านั้น
  line_user_id text unique,
  line_linked_at timestamptz,
  line_link_code text unique,
  line_link_code_expires_at timestamptz,
  -- แจ้งเตือน (M5): push "งานเลยกำหนด" ไม่เกิน 1 ข้อความ/วัน
  notify_overdue boolean not null default true,
  last_overdue_notified_on date,
  -- onboarding
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_profiles is 'โปรไฟล์ผู้ใช้ 1:1 กับ auth.users — สร้างอัตโนมัติโดย trigger on_auth_user_created';
comment on column public.user_profiles.line_link_code is 'รหัส 6 ตัวสำหรับผูก LINE หมดอายุตาม line_link_code_expires_at — ล้างเมื่อผูกสำเร็จ';
comment on column public.user_profiles.last_overdue_notified_on is 'วัน (Asia/Bangkok) ที่ส่งแจ้งเตือนงานเลยกำหนดครั้งล่าสุด — กันส่งซ้ำในวันเดียว';

-- updated_at อัตโนมัติ — ฟังก์ชันกลาง ใช้ซ้ำกับทุกตารางถัดไป
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- สร้าง profile ทันทีที่มี user ใหม่ใน auth.users (security definer: รันในสิทธิ์เจ้าของฟังก์ชัน ข้าม RLS)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id) values (new.id);
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: auth.uid() = id คือ security perimeter (Scope §6, §8)
alter table public.user_profiles enable row level security;

create policy "user_profiles: select own"
  on public.user_profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "user_profiles: update own"
  on public.user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ไม่มี policy insert/delete สำหรับ client — insert ผ่าน trigger, delete ตาม cascade ของ auth.users

-- Column-level privileges: client (authenticated) แก้ได้เฉพาะคอลัมน์ที่ปลอดภัย
-- subscription_tier / line_* / last_overdue_notified_on เขียนได้เฉพาะ service_role (server เท่านั้น)
revoke all on public.user_profiles from anon;
revoke update on public.user_profiles from authenticated;
grant update (display_name, active_persona, notify_overdue, onboarding_completed_at)
  on public.user_profiles to authenticated;
