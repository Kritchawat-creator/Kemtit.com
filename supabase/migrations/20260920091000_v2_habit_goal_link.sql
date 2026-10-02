-- Kemtit V2 habit-to-goal completion.
-- Additive extension: habits can contribute to a goal and participate in capacity planning.

alter table public.habits
  add column if not exists goal_id uuid references public.goals (id) on delete set null,
  add column if not exists estimated_minutes integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'habits_estimated_minutes_check'
      and conrelid = 'public.habits'::regclass
  ) then
    alter table public.habits
      add constraint habits_estimated_minutes_check
      check (estimated_minutes is null or estimated_minutes between 1 and 1440);
  end if;
end
$$;

create index if not exists habits_goal_idx
  on public.habits (goal_id)
  where goal_id is not null;

create or replace function public.habits_check_goal_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.goal_id is not null
     and not exists (
       select 1
       from public.goals g
       where g.id = new.goal_id
         and g.user_id = new.user_id
     ) then
    raise exception 'habit goal must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

drop trigger if exists habits_goal_owner on public.habits;
create trigger habits_goal_owner
  before insert or update of goal_id on public.habits
  for each row execute function public.habits_check_goal_owner();
