-- goals / tasks / task_completions / domain_events — implementation-plan M2 + POC Decisions 1.1, 1.3
-- domain_events ย้ายมาอยู่ที่นี่ (จาก M5) เพื่อให้ emit event ได้ตั้งแต่ M2
-- กฎ: ทุกตารางมี RLS auth.uid() = user_id · anon ไม่มีสิทธิ์ · service_role ข้าม RLS (ใช้เฉพาะ cron/webhook)

-- ---------- goals ----------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.goals (id) on delete cascade,
  period_type text not null
    check (period_type in ('year', 'quarter', 'month', 'week', 'day')),
  period_start date not null,
  domain text not null default 'work'
    check (domain in ('work', 'health', 'family', 'finance', 'growth', 'relationships')),
  -- POC Decisions 1.1: metric = current/target ที่ user กรอก · execution = task ลูกที่เสร็จ/ทั้งหมด (ห้ามผสม)
  goal_kind text not null default 'execution'
    check (goal_kind in ('metric', 'execution')),
  title text not null check (char_length(title) between 1 and 120),
  target_value numeric check (target_value is null or target_value > 0),
  current_value numeric not null default 0 check (current_value >= 0),
  persona_data jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_metric_needs_target check (goal_kind <> 'metric' or target_value is not null)
);

comment on table public.goals is 'Goal cascade ปี→ไตรมาส→เดือน→สัปดาห์→วัน (POC ใช้ ปี/เดือน/สัปดาห์) — progress คำนวณตอนอ่านใน core/domain/progress.ts';
comment on column public.goals.persona_data is 'ข้อมูลเฉพาะ persona เช่น {"unit":"THB"} สำหรับ metric goal';
comment on column public.goals.completed_at is 'เซ็ตครั้งแรกที่ progress ถึง 100 — ยิง domain_events goal.completed ครั้งเดียว';

create index goals_user_period_idx on public.goals (user_id, period_type, period_start);
create index goals_parent_idx on public.goals (parent_id);
create index goals_user_status_idx on public.goals (user_id, status);

create trigger set_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- parent ต้องเป็น goal ของ user เดียวกัน (รันในสิทธิ์ผู้เรียก → เห็นเฉพาะแถวที่ RLS อนุญาต)
create function public.goals_check_parent_owner()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'goal cannot be its own parent' using errcode = '23514';
    end if;
    if not exists (select 1 from public.goals g where g.id = new.parent_id and g.user_id = new.user_id) then
      raise exception 'parent goal must belong to the same user' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger goals_parent_owner
  before insert or update of parent_id on public.goals
  for each row execute function public.goals_check_parent_owner();

-- ---------- tasks ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  domain text not null default 'work'
    check (domain in ('work', 'health', 'family', 'finance', 'growth', 'relationships')),
  title text not null check (char_length(title) between 1 and 200),
  due_date date not null,
  -- RRULE subset ที่ POC รองรับ (Q4): FREQ=DAILY | FREQ=WEEKLY;BYDAY=SU,MO,...
  recurrence_rule text
    check (
      recurrence_rule is null
      or recurrence_rule ~ '^FREQ=(DAILY|WEEKLY)(;BYDAY=(SU|MO|TU|WE|TH|FR|SA)(,(SU|MO|TU|WE|TH|FR|SA))*)?$'
    ),
  -- task เดี่ยวใช้ completed_at · task ซ้ำใช้ task_completions (POC Decisions 1.3)
  completed_at timestamptz,
  persona_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is 'หน่วยปฏิบัติการเล็กสุด ผูก goal ได้หรือเป็น standalone; due_date เป็นวันแรกของ task ซ้ำ';

create index tasks_user_due_idx on public.tasks (user_id, due_date);
create index tasks_goal_idx on public.tasks (goal_id);
create index tasks_user_recurring_idx on public.tasks (user_id) where recurrence_rule is not null;

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create function public.tasks_check_goal_owner()
returns trigger
language plpgsql
as $$
begin
  if new.goal_id is not null
     and not exists (select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id) then
    raise exception 'goal must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger tasks_goal_owner
  before insert or update of goal_id on public.tasks
  for each row execute function public.tasks_check_goal_owner();

-- ---------- task_completions (POC Decisions 1.3 ตรงตัว) ----------
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  completed_on date not null,
  created_at timestamptz default now(),
  unique (task_id, completed_on)
);

comment on table public.task_completions is 'ประวัติการติ๊ก task ซ้ำ 1 แถวต่อวัน (Asia/Bangkok) — ใช้คำนวณ streak 7 วัน';

create index task_completions_user_date_idx on public.task_completions (user_id, completed_on);

create function public.task_completions_check_task_owner()
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

create trigger task_completions_task_owner
  before insert or update on public.task_completions
  for each row execute function public.task_completions_check_task_owner();

-- ---------- domain_events (Scope §5.3 + attempts/last_error สำหรับ retry) ----------
create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(event_type) between 1 and 64),
  payload jsonb not null default '{}'::jsonb,
  user_id uuid not null references auth.users (id) on delete cascade,
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

comment on table public.domain_events is 'Event log + คิว side effect (LINE) — cron ดึงแถวที่ processed_at is null เป็น batch เล็ก';

create index domain_events_unprocessed_idx on public.domain_events (created_at) where processed_at is null;
create index domain_events_user_type_idx on public.domain_events (user_id, event_type, created_at);

-- ---------- RLS ----------
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.domain_events enable row level security;

create policy "goals: select own" on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals: insert own" on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals: update own" on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals: delete own" on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

create policy "tasks: select own" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "tasks: insert own" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tasks: update own" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tasks: delete own" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "task_completions: select own" on public.task_completions for select to authenticated using ((select auth.uid()) = user_id);
create policy "task_completions: insert own" on public.task_completions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "task_completions: delete own" on public.task_completions for delete to authenticated using ((select auth.uid()) = user_id);

-- client เขียน event ของตัวเองได้อย่างเดียว; อ่าน/ประมวลผลเป็นงานของ service_role (cron)
create policy "domain_events: insert own" on public.domain_events for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.goals, public.tasks, public.task_completions, public.domain_events from anon;
revoke all on public.domain_events from authenticated;
grant insert on public.domain_events to authenticated;
