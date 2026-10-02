-- User-owned working windows and breaks used by the shared availability engine.
-- Defaults are conservative BKK office hours; users may edit or leave the
-- integration disconnected without affecting manual planning.

create table public.planning_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Asia/Bangkok',
  working_windows jsonb not null default '[{"start":"09:00","end":"17:00"}]'::jsonb,
  break_windows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_planning_preferences_updated_at
  before update on public.planning_preferences
  for each row execute function public.set_updated_at();

alter table public.planning_preferences enable row level security;
create policy "planning_preferences: select own" on public.planning_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "planning_preferences: insert own" on public.planning_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "planning_preferences: update own" on public.planning_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planning_preferences: delete own" on public.planning_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.planning_preferences from anon;
