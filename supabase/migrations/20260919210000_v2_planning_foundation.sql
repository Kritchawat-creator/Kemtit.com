-- Kemtit V2 planning foundation.
-- This migration is additive and keeps active_persona/legacy task fields during the transition.

-- ---------- profile context ----------
alter table public.user_profiles
  add column if not exists work_mode text,
  add column if not exists default_scope text not null default 'all';

update public.user_profiles
set work_mode = case
  when active_persona = 'seller' then 'seller'
  when active_persona = 'office' then 'professional'
  else work_mode
end
where work_mode is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_work_mode_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_work_mode_check
      check (work_mode is null or work_mode in ('seller', 'professional'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_default_scope_check'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_default_scope_check
      check (default_scope in ('all', 'work', 'life'));
  end if;
end
$$;

comment on column public.user_profiles.work_mode is
  'V2 work context, independent from life areas. seller or professional; null is a legacy migration state.';
comment on column public.user_profiles.default_scope is
  'Default Today/Inbox scope: all, work, or life.';

grant update (work_mode, default_scope) on public.user_profiles to authenticated;

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  domain text not null default 'work'
    check (domain in ('work', 'health', 'family', 'finance', 'growth', 'relationships')),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'archived')),
  start_date date,
  target_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_date is null or start_date is null or target_date >= start_date)
);

comment on table public.projects is
  'V2 shared project layer. Seller and Professional use the same project model.';

create index projects_user_status_idx on public.projects (user_id, status, updated_at desc);
create index projects_goal_idx on public.projects (goal_id) where goal_id is not null;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create function public.projects_check_goal_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.goal_id is not null
     and not exists (select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id) then
    raise exception 'project goal must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger projects_goal_owner
  before insert or update of goal_id on public.projects
  for each row execute function public.projects_check_goal_owner();

alter table public.projects enable row level security;
create policy "projects: select own" on public.projects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "projects: insert own" on public.projects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "projects: update own" on public.projects for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects: delete own" on public.projects for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.projects from anon;

-- ---------- task extensions ----------
alter table public.tasks
  alter column due_date drop not null,
  add column if not exists project_id uuid references public.projects (id) on delete set null,
  add column if not exists notes text,
  add column if not exists status text not null default 'planned',
  add column if not exists priority text not null default 'normal',
  add column if not exists estimated_minutes integer,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_status_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks add constraint tasks_status_check
      check (status in ('inbox', 'planned', 'completed', 'archived'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_priority_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks add constraint tasks_priority_check
      check (priority in ('high', 'normal', 'low'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_estimated_minutes_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks add constraint tasks_estimated_minutes_check
      check (estimated_minutes is null or estimated_minutes between 1 and 1440);
  end if;
end
$$;

update public.tasks
set status = case
  when archived_at is not null then 'archived'
  when completed_at is not null then 'completed'
  else 'planned'
end
where status = 'planned';

comment on column public.tasks.status is
  'Canonical task state: inbox, planned, completed, or archived. Recurring series stays planned; occurrence state is separate.';
comment on column public.tasks.deleted_at is
  'Reserved for a later hard-delete retention workflow; archived_at is the user-facing soft delete.';

create index tasks_user_status_priority_idx on public.tasks (user_id, status, priority, due_date);
create index tasks_project_idx on public.tasks (project_id) where project_id is not null;

create function public.tasks_check_project_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_id is not null
     and not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'task project must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger tasks_project_owner
  before insert or update of project_id on public.tasks
  for each row execute function public.tasks_check_project_owner();

-- ---------- recurring occurrences ----------
create table public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurrence_date date not null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'skipped', 'archived')),
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, occurrence_date),
  check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start)
);

create index task_occurrences_user_date_idx on public.task_occurrences (user_id, occurrence_date, status);
create index task_occurrences_task_date_idx on public.task_occurrences (task_id, occurrence_date);
create trigger set_task_occurrences_updated_at
  before update on public.task_occurrences
  for each row execute function public.set_updated_at();

create function public.task_occurrences_check_task_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.tasks t where t.id = new.task_id and t.user_id = new.user_id) then
    raise exception 'task occurrence must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger task_occurrences_task_owner
  before insert or update on public.task_occurrences
  for each row execute function public.task_occurrences_check_task_owner();

alter table public.task_occurrences enable row level security;
create policy "task_occurrences: select own" on public.task_occurrences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "task_occurrences: insert own" on public.task_occurrences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "task_occurrences: update own" on public.task_occurrences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "task_occurrences: delete own" on public.task_occurrences for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.task_occurrences from anon;

-- ---------- habits ----------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  domain text not null default 'health'
    check (domain in ('work', 'health', 'family', 'finance', 'growth', 'relationships')),
  title text not null check (char_length(title) between 1 and 160),
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  target_per_week integer not null default 7 check (target_per_week between 1 and 7),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index habits_user_active_idx on public.habits (user_id, archived_at, domain);
create trigger set_habits_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

alter table public.habits enable row level security;
create policy "habits: select own" on public.habits for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "habits: insert own" on public.habits for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "habits: update own" on public.habits for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habits: delete own" on public.habits for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.habits from anon;

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);

create index habit_completions_user_date_idx on public.habit_completions (user_id, completed_on desc);

create function public.habit_completions_check_habit_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.habits h where h.id = new.habit_id and h.user_id = new.user_id) then
    raise exception 'habit completion must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger habit_completions_habit_owner
  before insert or update on public.habit_completions
  for each row execute function public.habit_completions_check_habit_owner();

alter table public.habit_completions enable row level security;
create policy "habit_completions: select own" on public.habit_completions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "habit_completions: insert own" on public.habit_completions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "habit_completions: update own" on public.habit_completions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habit_completions: delete own" on public.habit_completions for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.habit_completions from anon;

-- ---------- daily plan and time blocks ----------
create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_date date not null,
  available_minutes integer not null default 480 check (available_minutes between 0 and 1440),
  top_priorities text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

create index daily_plans_user_date_idx on public.daily_plans (user_id, plan_date desc);
create trigger set_daily_plans_updated_at
  before update on public.daily_plans
  for each row execute function public.set_updated_at();

alter table public.daily_plans enable row level security;
create policy "daily_plans: select own" on public.daily_plans for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "daily_plans: insert own" on public.daily_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "daily_plans: update own" on public.daily_plans for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_plans: delete own" on public.daily_plans for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.daily_plans from anon;

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  task_occurrence_id uuid references public.task_occurrences (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  start_at timestamptz not null,
  end_at timestamptz not null,
  source text not null default 'manual'
    check (source in ('manual', 'kemtit', 'google', 'outlook')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index time_blocks_user_start_idx on public.time_blocks (user_id, start_at, end_at);
create index time_blocks_task_idx on public.time_blocks (task_id) where task_id is not null;
create trigger set_time_blocks_updated_at
  before update on public.time_blocks
  for each row execute function public.set_updated_at();

create function public.time_blocks_check_task_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.task_id is not null
     and not exists (select 1 from public.tasks t where t.id = new.task_id and t.user_id = new.user_id) then
    raise exception 'time block task must belong to the same user' using errcode = '23514';
  end if;
  if new.task_occurrence_id is not null
     and not exists (select 1 from public.task_occurrences o where o.id = new.task_occurrence_id and o.user_id = new.user_id) then
    raise exception 'time block occurrence must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger time_blocks_owner
  before insert or update on public.time_blocks
  for each row execute function public.time_blocks_check_task_owner();

alter table public.time_blocks enable row level security;
create policy "time_blocks: select own" on public.time_blocks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "time_blocks: insert own" on public.time_blocks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "time_blocks: update own" on public.time_blocks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "time_blocks: delete own" on public.time_blocks for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.time_blocks from anon;

-- ---------- weekly review ----------
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  wins text,
  blockers text,
  next_focus text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index weekly_reviews_user_week_idx on public.weekly_reviews (user_id, week_start desc);
create trigger set_weekly_reviews_updated_at
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

alter table public.weekly_reviews enable row level security;
create policy "weekly_reviews: select own" on public.weekly_reviews for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "weekly_reviews: insert own" on public.weekly_reviews for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "weekly_reviews: update own" on public.weekly_reviews for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weekly_reviews: delete own" on public.weekly_reviews for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.weekly_reviews from anon;
