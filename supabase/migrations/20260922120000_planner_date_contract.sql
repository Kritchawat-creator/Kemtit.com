-- Planner date contract.
-- Keep legacy due_date untouched: it has mixed historical meaning. New fields
-- are additive and remain null for existing rows until the user confirms their
-- interpretation through an edit or an explicit migration tool.

alter table public.tasks
  add column if not exists planned_date date,
  add column if not exists deadline date;

comment on column public.tasks.planned_date is
  'Date the user intends to work on the task. Null means the legacy due_date has not been interpreted yet.';
comment on column public.tasks.deadline is
  'Date the task must be finished by. Replanning must not change it unless the user explicitly edits it.';

create index if not exists tasks_user_planned_deadline_idx
  on public.tasks (user_id, planned_date, deadline)
  where archived_at is null and deleted_at is null;

alter table public.time_blocks
  add column if not exists status text not null default 'active',
  add column if not exists version integer not null default 1,
  add column if not exists is_locked boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'time_blocks_status_check'
      and conrelid = 'public.time_blocks'::regclass
  ) then
    alter table public.time_blocks add constraint time_blocks_status_check
      check (status in ('active', 'cancelled'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'time_blocks_version_check'
      and conrelid = 'public.time_blocks'::regclass
  ) then
    alter table public.time_blocks add constraint time_blocks_version_check
      check (version > 0);
  end if;
end
$$;

comment on column public.time_blocks.status is
  'Lifecycle state. Cancelled blocks remain as history and do not consume availability.';
comment on column public.time_blocks.version is
  'Optimistic concurrency version used by edit, cancel, and undo operations.';
comment on column public.time_blocks.is_locked is
  'User locked commitment; deterministic rescue must not move it.';

create or replace function public.update_time_block_atomic(
  p_id uuid,
  p_title text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_expected_version integer
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_version integer;
  v_status text;
  v_locked boolean;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_end_at <= p_start_at then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select version, status, is_locked
    into v_version, v_status, v_locked
  from public.time_blocks
  where id = p_id and user_id = v_user_id
  for update;

  if v_version is null or v_status <> 'active' or v_version <> p_expected_version or v_locked then
    return null;
  end if;

  if exists (
    select 1
    from public.time_blocks b
    where b.user_id = v_user_id
      and b.id <> p_id
      and b.status = 'active'
      and b.start_at < p_end_at
      and b.end_at > p_start_at
  ) then
    return null;
  end if;

  update public.time_blocks
  set title = p_title,
      start_at = p_start_at,
      end_at = p_end_at,
      version = version + 1
  where id = p_id and user_id = v_user_id;

  return p_id;
end
$$;

create or replace function public.set_time_block_status_atomic(
  p_id uuid,
  p_expected_version integer,
  p_status text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_version integer;
  v_current_status text;
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_status not in ('active', 'cancelled') then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select version, status, start_at, end_at
    into v_version, v_current_status, v_start_at, v_end_at
  from public.time_blocks
  where id = p_id and user_id = v_user_id
  for update;

  if v_version is null or v_version <> p_expected_version or v_current_status = p_status then
    return null;
  end if;

  if p_status = 'active' and exists (
    select 1
    from public.time_blocks b
    where b.user_id = v_user_id
      and b.id <> p_id
      and b.status = 'active'
      and b.start_at < v_end_at
      and b.end_at > v_start_at
  ) then
    return null;
  end if;

  update public.time_blocks
  set status = p_status,
      version = version + 1
  where id = p_id and user_id = v_user_id;

  return p_id;
end
$$;

revoke all on function public.update_time_block_atomic(uuid, text, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.update_time_block_atomic(uuid, text, timestamptz, timestamptz, integer) to authenticated;
revoke all on function public.set_time_block_status_atomic(uuid, integer, text) from public, anon;
grant execute on function public.set_time_block_status_atomic(uuid, integer, text) to authenticated;
