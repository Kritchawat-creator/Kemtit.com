-- Serialize accepted time-block and blocking-event mutations on the same user key.
create or replace function public.lock_time_block_schedule_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    if old.user_id < new.user_id then
      perform pg_advisory_xact_lock(hashtextextended(old.user_id::text, 0));
      perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    else
      perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
      perform pg_advisory_xact_lock(hashtextextended(old.user_id::text, 0));
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  end if;
  return new;
end
$$;

create or replace function public.lock_calendar_event_schedule_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := new.user_id;
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    if old.user_id < new.user_id then
      perform pg_advisory_xact_lock(hashtextextended(old.user_id::text, 0));
      perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    else
      perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
      perform pg_advisory_xact_lock(hashtextextended(old.user_id::text, 0));
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create or replace function public.enforce_time_block_schedule_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block public.time_blocks;
begin
  select * into v_block
  from public.time_blocks block
  where block.id = new.id;
  if not found or v_block.status <> 'active'
     or v_block.data_origin not in ('USER', 'IMPORT') then
    return null;
  end if;

  if exists (
    select 1
    from public.time_blocks other
    where other.user_id = v_block.user_id
      and other.id <> v_block.id
      and other.status = 'active'
      and other.data_origin in ('USER', 'IMPORT')
      and other.start_at < v_block.end_at
      and other.end_at > v_block.start_at
  ) then
    raise exception 'time_block_conflict' using errcode = '23P01';
  end if;

  if exists (
    select 1
    from public.calendar_events event
    where event.user_id = v_block.user_id
      and event.data_origin in ('USER', 'IMPORT')
      and event.blocks_time
      and (
        (
          event.all_day
          and (event.event_date::timestamp at time zone 'Asia/Bangkok') < v_block.end_at
          and ((event.event_date + 1)::timestamp at time zone 'Asia/Bangkok') > v_block.start_at
        )
        or (
          not event.all_day
          and ((event.event_date + event.start_time) at time zone 'Asia/Bangkok') < v_block.end_at
          and ((event.event_date + event.end_time) at time zone 'Asia/Bangkok') > v_block.start_at
        )
      )
  ) then
    raise exception 'calendar_event_conflict' using errcode = '23P01';
  end if;

  return null;
end
$$;

create or replace function public.enforce_calendar_event_schedule_conflicts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.calendar_events;
begin
  if tg_op = 'DELETE' then
    return null;
  end if;

  select * into v_event
  from public.calendar_events event
  where event.id = new.id;
  if not found or not v_event.blocks_time
     or v_event.data_origin not in ('USER', 'IMPORT') then
    return null;
  end if;

  if exists (
    select 1
    from public.time_blocks block
    where block.user_id = v_event.user_id
      and block.status = 'active'
      and block.data_origin in ('USER', 'IMPORT')
      and (
        (
          v_event.all_day
          and (v_event.event_date::timestamp at time zone 'Asia/Bangkok') < block.end_at
          and ((v_event.event_date + 1)::timestamp at time zone 'Asia/Bangkok') > block.start_at
        )
        or (
          not v_event.all_day
          and ((v_event.event_date + v_event.start_time) at time zone 'Asia/Bangkok') < block.end_at
          and ((v_event.event_date + v_event.end_time) at time zone 'Asia/Bangkok') > block.start_at
        )
      )
  ) then
    raise exception 'calendar_event_conflict' using errcode = '23P01';
  end if;

  return null;
end
$$;

drop trigger if exists time_blocks_schedule_user_lock on public.time_blocks;
create trigger time_blocks_schedule_user_lock
  before insert or update on public.time_blocks
  for each row execute function public.lock_time_block_schedule_user();

drop trigger if exists calendar_events_schedule_user_lock on public.calendar_events;
create trigger calendar_events_schedule_user_lock
  before insert or update or delete on public.calendar_events
  for each row execute function public.lock_calendar_event_schedule_user();

drop trigger if exists time_blocks_schedule_conflict on public.time_blocks;
create constraint trigger time_blocks_schedule_conflict
  after insert or update on public.time_blocks
  deferrable initially deferred
  for each row execute function public.enforce_time_block_schedule_conflicts();

drop trigger if exists calendar_events_schedule_conflict on public.calendar_events;
create constraint trigger calendar_events_schedule_conflict
  after insert or update or delete on public.calendar_events
  deferrable initially deferred
  for each row execute function public.enforce_calendar_event_schedule_conflicts();

revoke all on function public.lock_time_block_schedule_user() from public, anon, authenticated;
revoke all on function public.lock_calendar_event_schedule_user() from public, anon, authenticated;
revoke all on function public.enforce_time_block_schedule_conflicts() from public, anon, authenticated;
revoke all on function public.enforce_calendar_event_schedule_conflicts() from public, anon, authenticated;
alter function public.lock_time_block_schedule_user() owner to postgres;
alter function public.lock_calendar_event_schedule_user() owner to postgres;
alter function public.enforce_time_block_schedule_conflicts() owner to postgres;
alter function public.enforce_calendar_event_schedule_conflicts() owner to postgres;

-- Structured readbacks preserve the legacy UUID/null RPC contract while allowing
-- current callers to distinguish conflicts from lock, stale, and inactive states.
create or replace function public.create_time_block_atomic_result(
  p_title text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_task_id uuid default null,
  p_task_occurrence_id uuid default null,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  begin
    v_id := public.create_time_block_atomic(
      p_title, p_start_at, p_end_at, p_task_id, p_task_occurrence_id, p_source
    );
  exception when sqlstate '23P01' then
    return jsonb_build_object('status', 'conflict');
  end;

  if v_id is null then
    return jsonb_build_object('status', 'conflict');
  end if;
  return jsonb_build_object('status', 'ok', 'id', v_id);
end
$$;

create or replace function public.update_time_block_atomic_result(
  p_id uuid,
  p_title text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_expected_version integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid := auth.uid();
  v_version integer;
  v_status text;
  v_locked boolean;
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  begin
    v_id := public.update_time_block_atomic(
      p_id, p_title, p_start_at, p_end_at, p_expected_version
    );
  exception when sqlstate '23P01' then
    return jsonb_build_object('status', 'conflict');
  end;

  if v_id is not null then
    return jsonb_build_object('status', 'ok', 'id', v_id);
  end if;

  select block.version, block.status, block.is_locked, block.start_at, block.end_at
    into v_version, v_status, v_locked, v_start_at, v_end_at
  from public.time_blocks block
  where block.id = p_id and block.user_id = v_user_id;

  if not found then return jsonb_build_object('status', 'notFound'); end if;
  if v_locked then return jsonb_build_object('status', 'locked'); end if;
  if v_status <> 'active' then return jsonb_build_object('status', 'inactive'); end if;
  if v_version <> p_expected_version then return jsonb_build_object('status', 'stale'); end if;
  if p_end_at <= p_start_at then return jsonb_build_object('status', 'invalid'); end if;
  if exists (
    select 1
    from public.time_blocks block
    where block.user_id = v_user_id
      and block.id <> p_id
      and block.status = 'active'
      and block.data_origin in ('USER', 'IMPORT')
      and block.start_at < p_end_at
      and block.end_at > p_start_at
  ) then
    return jsonb_build_object('status', 'conflict');
  end if;
  return jsonb_build_object('status', 'conflict');
end
$$;

create or replace function public.set_time_block_status_atomic_result(
  p_id uuid,
  p_expected_version integer,
  p_status text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid := auth.uid();
  v_version integer;
  v_current_status text;
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  begin
    v_id := public.set_time_block_status_atomic(p_id, p_expected_version, p_status);
  exception when sqlstate '23P01' then
    return jsonb_build_object('status', 'conflict');
  end;

  if v_id is not null then
    return jsonb_build_object('status', 'ok', 'id', v_id);
  end if;

  select block.version, block.status, block.start_at, block.end_at
    into v_version, v_current_status, v_start_at, v_end_at
  from public.time_blocks block
  where block.id = p_id and block.user_id = v_user_id;

  if not found then return jsonb_build_object('status', 'notFound'); end if;
  if v_version <> p_expected_version then return jsonb_build_object('status', 'stale'); end if;
  if v_current_status = p_status then return jsonb_build_object('status', 'inactive'); end if;
  if p_status = 'active' and exists (
    select 1
    from public.time_blocks block
    where block.user_id = v_user_id
      and block.id <> p_id
      and block.status = 'active'
      and block.data_origin in ('USER', 'IMPORT')
      and block.start_at < v_end_at
      and block.end_at > v_start_at
  ) then
    return jsonb_build_object('status', 'conflict');
  end if;
  return jsonb_build_object('status', 'conflict');
end
$$;

revoke all on function public.create_time_block_atomic_result(text, timestamptz, timestamptz, uuid, uuid, text)
  from public, anon;
revoke all on function public.update_time_block_atomic_result(uuid, text, timestamptz, timestamptz, integer)
  from public, anon;
revoke all on function public.set_time_block_status_atomic_result(uuid, integer, text)
  from public, anon;
grant execute on function public.create_time_block_atomic_result(text, timestamptz, timestamptz, uuid, uuid, text)
  to authenticated;
grant execute on function public.update_time_block_atomic_result(uuid, text, timestamptz, timestamptz, integer)
  to authenticated;
grant execute on function public.set_time_block_status_atomic_result(uuid, integer, text)
  to authenticated;
