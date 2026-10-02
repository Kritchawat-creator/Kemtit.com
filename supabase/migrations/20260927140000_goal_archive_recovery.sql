-- Preserve a goal's pre-archive status and make archive recovery available from
-- the user's archive list. Legacy archived rows have no known prior status;
-- restore will use the established active fallback for those rows.

alter table public.goals
  add column if not exists archived_at timestamptz,
  add column if not exists archived_from_status text;

update public.goals
set archived_at = coalesce(archived_at, updated_at)
where status = 'archived';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'goals_archived_from_status_check'
      and conrelid = 'public.goals'::regclass
  ) then
    alter table public.goals add constraint goals_archived_from_status_check
      check (archived_from_status is null or archived_from_status in ('active', 'completed'));
  end if;
end
$$;

create index if not exists goals_user_archived_idx
  on public.goals (user_id, archived_at desc, id)
  where status = 'archived' and archived_at is not null;

create or replace function public.archive_goal_atomic(p_goal_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_goal_id is null then
    raise exception 'goal_not_found' using errcode = 'P0001';
  end if;

  select status
    into v_status
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
    and data_origin in ('USER', 'IMPORT')
  for update;

  if not found then
    raise exception 'goal_not_found' using errcode = 'P0001';
  end if;

  if v_status = 'archived' then
    return p_goal_id;
  end if;

  update public.goals
  set archived_from_status = v_status,
      status = 'archived',
      archived_at = now()
  where id = p_goal_id
    and user_id = v_user_id
    and data_origin in ('USER', 'IMPORT');

  return p_goal_id;
end
$$;

create or replace function public.restore_goal_atomic(p_goal_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_archived_from_status text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_goal_id is null then
    raise exception 'goal_not_found' using errcode = 'P0001';
  end if;

  select archived_from_status
    into v_archived_from_status
  from public.goals
  where id = p_goal_id
    and user_id = v_user_id
    and data_origin in ('USER', 'IMPORT')
    and status = 'archived'
  for update;

  if not found then
    raise exception 'goal_not_found' using errcode = 'P0001';
  end if;

  update public.goals
  set status = coalesce(v_archived_from_status, 'active'),
      archived_from_status = null,
      archived_at = null
  where id = p_goal_id
    and user_id = v_user_id
    and data_origin in ('USER', 'IMPORT')
    and status = 'archived';

  return p_goal_id;
end
$$;

revoke all on function public.archive_goal_atomic(uuid) from public, anon;
grant execute on function public.archive_goal_atomic(uuid) to authenticated;
revoke all on function public.restore_goal_atomic(uuid) from public, anon;
grant execute on function public.restore_goal_atomic(uuid) to authenticated;
