-- Kemtit V2 flat task subtasks.
-- This is deliberately one level deep: subtasks are execution details, not a hierarchy.

create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  position integer not null default 0 check (position >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_subtasks_task_order_idx
  on public.task_subtasks (task_id, position, created_at);
create index task_subtasks_user_idx
  on public.task_subtasks (user_id, task_id);

create trigger set_task_subtasks_updated_at
  before update on public.task_subtasks
  for each row execute function public.set_updated_at();

create function public.task_subtasks_check_task_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.tasks t
    where t.id = new.task_id and t.user_id = new.user_id
  ) then
    raise exception 'task subtask must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger task_subtasks_task_owner
  before insert or update of task_id, user_id on public.task_subtasks
  for each row execute function public.task_subtasks_check_task_owner();

alter table public.task_subtasks enable row level security;
create policy "task_subtasks: select own" on public.task_subtasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "task_subtasks: insert own" on public.task_subtasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "task_subtasks: update own" on public.task_subtasks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "task_subtasks: delete own" on public.task_subtasks for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.task_subtasks from anon;
