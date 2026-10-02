-- Scheduling conflicts use the same active, accepted time blocks shown in the
-- Calendar and Today views. Cancelled and prepared rows remain available as
-- history but must not reserve time until accepted.

create or replace function public.create_time_block_atomic(
  p_title text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_task_id uuid default null,
  p_task_occurrence_id uuid default null,
  p_source text default 'manual'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_end_at <= p_start_at then
    raise exception 'time block end must be after start' using errcode = '22007';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if exists (
    select 1
    from public.time_blocks b
    where b.user_id = v_user_id
      and b.status = 'active'
      and b.data_origin in ('USER', 'IMPORT')
      and b.start_at < p_end_at
      and b.end_at > p_start_at
  ) then
    return null;
  end if;

  insert into public.time_blocks (
    user_id,
    task_id,
    task_occurrence_id,
    title,
    start_at,
    end_at,
    source
  )
  values (
    v_user_id,
    p_task_id,
    p_task_occurrence_id,
    p_title,
    p_start_at,
    p_end_at,
    p_source
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.create_time_block_atomic(text, timestamptz, timestamptz, uuid, uuid, text) from public;
revoke all on function public.create_time_block_atomic(text, timestamptz, timestamptz, uuid, uuid, text) from anon;
grant execute on function public.create_time_block_atomic(text, timestamptz, timestamptz, uuid, uuid, text) to authenticated;

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
      and b.data_origin in ('USER', 'IMPORT')
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
      and b.data_origin in ('USER', 'IMPORT')
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

create or replace function public.apply_rescue_operation(
  p_operation_id uuid,
  p_target_date date,
  p_plan jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.rescue_operations;
  v_item jsonb;
  v_entry jsonb;
  v_task_id uuid;
  v_block_id uuid;
  v_expected_task_updated_at timestamptz;
  v_expected_block_version integer;
  v_target_date date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_task_recurrence_rule text;
  v_task_planned_date date;
  v_task_due_date date;
  v_task_deadline date;
  v_task_updated_at timestamptz;
  v_block_start_at timestamptz;
  v_block_end_at timestamptz;
  v_block_status text;
  v_block_version integer;
  v_block_is_locked boolean;
  v_before_tasks jsonb := '[]'::jsonb;
  v_before_blocks jsonb := '[]'::jsonb;
  v_after_tasks jsonb := '[]'::jsonb;
  v_after_blocks jsonb := '[]'::jsonb;
  v_touched_task_ids jsonb := '[]'::jsonb;
  v_touched_block_ids jsonb := '[]'::jsonb;
  v_new_block_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_plan) <> 'object' or jsonb_typeof(p_plan->'items') <> 'array' then
    raise exception 'invalid rescue plan' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_existing
  from public.rescue_operations
  where id = p_operation_id and user_id = v_user_id
  for update;
  if found then
    if v_existing.status = 'applied' and v_existing.plan = p_plan then
      return p_operation_id;
    end if;
    raise exception 'rescue operation already finalized' using errcode = '40001';
  end if;

  for v_item in select value from jsonb_array_elements(p_plan->'items') loop
    if coalesce(v_item->>'action', '') not in ('move', 'at_risk') then
      continue;
    end if;

    v_task_id := nullif(v_item->>'taskId', '')::uuid;
    v_target_date := nullif(v_item->>'targetDate', '')::date;
    v_start_at := nullif(v_item->>'startAt', '')::timestamptz;
    v_end_at := nullif(v_item->>'endAt', '')::timestamptz;
    v_expected_task_updated_at := nullif(v_item->>'expectedTaskUpdatedAt', '')::timestamptz;
    v_block_id := nullif(v_item->>'blockId', '')::uuid;
    v_expected_block_version := nullif(v_item->>'expectedBlockVersion', '')::integer;

    if v_task_id is null or v_target_date is null then
      raise exception 'invalid rescue item' using errcode = '22023';
    end if;

    select t.recurrence_rule, t.planned_date, t.due_date, t.deadline, t.updated_at
      into v_task_recurrence_rule, v_task_planned_date, v_task_due_date, v_task_deadline, v_task_updated_at
    from public.tasks t
    where t.id = v_task_id
      and t.user_id = v_user_id
      and t.archived_at is null
      and t.deleted_at is null
    for update;
    if not found then
      raise exception 'rescue task no longer exists' using errcode = '40001';
    end if;

    if v_expected_task_updated_at is not null and v_task_updated_at <> v_expected_task_updated_at then
      raise exception 'rescue task changed after preview' using errcode = '40001';
    end if;

    if not exists (
      select 1 from jsonb_array_elements(v_touched_task_ids) e where e #>> '{}' = v_task_id::text
    ) then
      v_touched_task_ids := v_touched_task_ids || jsonb_build_array(v_task_id::text);
      v_before_tasks := v_before_tasks || jsonb_build_array(jsonb_build_object(
        'id', v_task_id,
        'planned_date', v_task_planned_date,
        'due_date', v_task_due_date,
        'deadline', v_task_deadline,
        'updated_at', v_task_updated_at
      ));
    end if;

    -- A recurring series keeps its source date; its concrete block may still move.
    if v_task_recurrence_rule is null then
      update public.tasks
      set planned_date = v_target_date,
          due_date = v_target_date
      where id = v_task_id and user_id = v_user_id;
    end if;

    if v_block_id is not null then
      select b.start_at, b.end_at, b.status, b.version, b.is_locked
        into v_block_start_at, v_block_end_at, v_block_status, v_block_version, v_block_is_locked
      from public.time_blocks b
      where b.id = v_block_id and b.user_id = v_user_id
      for update;
      if not found or v_block_status <> 'active' then
        raise exception 'rescue block no longer exists' using errcode = '40001';
      end if;
      if v_expected_block_version is not null and v_block_version <> v_expected_block_version then
        raise exception 'rescue block changed after preview' using errcode = '40001';
      end if;
      if v_block_is_locked then
        raise exception 'rescue block is locked' using errcode = '40001';
      end if;

      if not exists (
        select 1 from jsonb_array_elements(v_touched_block_ids) e where e #>> '{}' = v_block_id::text
      ) then
        v_touched_block_ids := v_touched_block_ids || jsonb_build_array(v_block_id::text);
        v_before_blocks := v_before_blocks || jsonb_build_array(jsonb_build_object(
          'id', v_block_id,
          'start_at', v_block_start_at,
          'end_at', v_block_end_at,
          'status', v_block_status,
          'version', v_block_version,
          'is_locked', v_block_is_locked
        ));
      end if;

      if v_start_at is not null and v_end_at is not null
         and (v_end_at <= v_start_at) then
        raise exception 'invalid rescue block interval' using errcode = '22007';
      end if;
      if v_start_at is not null and v_end_at is not null
         and (v_start_at <> v_block_start_at or v_end_at <> v_block_end_at)
         and exists (
           select 1 from public.time_blocks b
           where b.user_id = v_user_id
             and b.id <> v_block_id
             and b.status = 'active'
             and b.data_origin in ('USER', 'IMPORT')
             and b.start_at < v_end_at
             and b.end_at > v_start_at
         ) then
        raise exception 'rescue block overlaps another block' using errcode = '40001';
      end if;

      if v_start_at is not null and v_end_at is not null then
        update public.time_blocks
        set start_at = v_start_at,
            end_at = v_end_at,
            version = version + 1
        where id = v_block_id and user_id = v_user_id;
      end if;
    elsif v_start_at is not null and v_end_at is not null then
      if v_task_recurrence_rule is not null then
        raise exception 'recurring rescue requires an occurrence block' using errcode = '40001';
      end if;
      if exists (
        select 1 from public.time_blocks b
        where b.user_id = v_user_id
          and b.status = 'active'
          and b.data_origin in ('USER', 'IMPORT')
          and b.start_at < v_end_at
          and b.end_at > v_start_at
      ) then
        raise exception 'rescue block overlaps another block' using errcode = '40001';
      end if;
      insert into public.time_blocks (user_id, task_id, title, start_at, end_at, source)
      values (v_user_id, v_task_id, coalesce(v_item->>'title', 'Rescue block'), v_start_at, v_end_at, 'kemtit')
      returning id into v_new_block_id;
      v_touched_block_ids := v_touched_block_ids || jsonb_build_array(v_new_block_id::text);
    end if;
  end loop;

  for v_entry in select value from jsonb_array_elements(v_touched_task_ids) loop
    select jsonb_build_object(
      'id', t.id,
      'planned_date', t.planned_date,
      'due_date', t.due_date,
      'deadline', t.deadline,
      'updated_at', t.updated_at
    ) into v_entry
    from public.tasks t
    where t.id = (v_entry #>> '{}')::uuid and t.user_id = v_user_id;
    v_after_tasks := v_after_tasks || jsonb_build_array(v_entry);
  end loop;

  for v_entry in select value from jsonb_array_elements(v_touched_block_ids) loop
    select jsonb_build_object(
      'id', b.id,
      'start_at', b.start_at,
      'end_at', b.end_at,
      'status', b.status,
      'version', b.version,
      'is_locked', b.is_locked
    ) into v_entry
    from public.time_blocks b
    where b.id = (v_entry #>> '{}')::uuid and b.user_id = v_user_id;
    v_after_blocks := v_after_blocks || jsonb_build_array(v_entry);
  end loop;

  insert into public.rescue_operations (
    id, user_id, target_date, status, plan,
    before_state, after_state
  ) values (
    p_operation_id, v_user_id, p_target_date, 'applied', p_plan,
    jsonb_build_object('tasks', v_before_tasks, 'time_blocks', v_before_blocks),
    jsonb_build_object('tasks', v_after_tasks, 'time_blocks', v_after_blocks)
  );
  return p_operation_id;
end
$$;

revoke all on function public.apply_rescue_operation(uuid, date, jsonb) from public;
revoke all on function public.apply_rescue_operation(uuid, date, jsonb) from anon;
grant execute on function public.apply_rescue_operation(uuid, date, jsonb) to authenticated;

create or replace function public._shift_linked_task_blocks_atomic(
  p_user_id uuid,
  p_task_id uuid,
  p_task_occurrence_id uuid,
  p_from_date date,
  p_to_date date
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_day_delta integer;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.user_id = p_user_id
      and t.data_origin in ('USER', 'IMPORT')
  ) then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  if p_task_occurrence_id is not null and not exists (
    select 1
    from public.task_occurrences o
    where o.id = p_task_occurrence_id
      and o.task_id = p_task_id
      and o.user_id = p_user_id
      and o.data_origin in ('USER', 'IMPORT')
  ) then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  -- Same-day content edits must not reject locked blocks or bump their versions.
  if p_from_date is not null and p_from_date = p_to_date then
    return;
  end if;

  perform 1
  from public.time_blocks b
  where b.user_id = p_user_id
    and b.task_id = p_task_id
    and b.task_occurrence_id is not distinct from p_task_occurrence_id
    and b.data_origin in ('USER', 'IMPORT')
    and b.status = 'active'
  order by b.id
  for update;

  if not exists (
    select 1
    from public.time_blocks b
    where b.user_id = p_user_id
      and b.task_id = p_task_id
      and b.task_occurrence_id is not distinct from p_task_occurrence_id
      and b.data_origin in ('USER', 'IMPORT')
      and b.status = 'active'
  ) then
    return;
  end if;

  -- A task entering the plan without a prior planned date has no safe delta.
  -- Accept already-aligned blocks; reject any move that would guess their origin.
  if p_from_date is null then
    if p_to_date is null or exists (
      select 1
      from public.time_blocks b
      where b.user_id = p_user_id
        and b.task_id = p_task_id
        and b.task_occurrence_id is not distinct from p_task_occurrence_id
        and b.data_origin in ('USER', 'IMPORT')
        and b.status = 'active'
        and timezone('Asia/Bangkok', b.start_at)::date <> p_to_date
    ) then
      raise exception 'time_block_anchor_missing' using errcode = 'P0001';
    end if;
    return;
  end if;

  if p_to_date is null then
    raise exception 'time_block_anchor_missing' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.time_blocks b
    where b.user_id = p_user_id
      and b.task_id = p_task_id
      and b.task_occurrence_id is not distinct from p_task_occurrence_id
      and b.data_origin in ('USER', 'IMPORT')
      and b.status = 'active'
      and timezone('Asia/Bangkok', b.start_at)::date <> p_from_date
  ) then
    raise exception 'time_block_anchor_mismatch' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.time_blocks b
    where b.user_id = p_user_id
      and b.task_id = p_task_id
      and b.task_occurrence_id is not distinct from p_task_occurrence_id
      and b.data_origin in ('USER', 'IMPORT')
      and b.status = 'active'
      and b.is_locked
  ) then
    raise exception 'time_block_locked' using errcode = 'P0001';
  end if;

  v_day_delta := p_to_date - p_from_date;

  if exists (
    with moving as (
      select
        b.id,
        (timezone('Asia/Bangkok', b.start_at) + make_interval(days => v_day_delta))
          at time zone 'Asia/Bangkok' as next_start_at,
        (timezone('Asia/Bangkok', b.end_at) + make_interval(days => v_day_delta))
          at time zone 'Asia/Bangkok' as next_end_at
      from public.time_blocks b
      where b.user_id = p_user_id
        and b.task_id = p_task_id
        and b.task_occurrence_id is not distinct from p_task_occurrence_id
        and b.data_origin in ('USER', 'IMPORT')
        and b.status = 'active'
    )
    select 1
    from moving m
    join public.time_blocks other
      on other.user_id = p_user_id
      and other.id <> m.id
      and other.status = 'active'
      and other.data_origin in ('USER', 'IMPORT')
      and other.start_at < m.next_end_at
      and other.end_at > m.next_start_at
    where not (
      other.task_id is not distinct from p_task_id
      and other.data_origin in ('USER', 'IMPORT')
      and other.status = 'active'
      and other.task_occurrence_id is not distinct from p_task_occurrence_id
    )
  ) then
    raise exception 'time_block_overlap' using errcode = 'P0001';
  end if;

  update public.time_blocks b
  set start_at = (timezone('Asia/Bangkok', b.start_at) + make_interval(days => v_day_delta))
        at time zone 'Asia/Bangkok',
      end_at = (timezone('Asia/Bangkok', b.end_at) + make_interval(days => v_day_delta))
        at time zone 'Asia/Bangkok',
      version = b.version + 1
  where b.user_id = p_user_id
    and b.task_id = p_task_id
    and b.task_occurrence_id is not distinct from p_task_occurrence_id
    and b.data_origin in ('USER', 'IMPORT')
    and b.status = 'active';
end
$$;

revoke all on function public._shift_linked_task_blocks_atomic(uuid, uuid, uuid, date, date)
  from public, anon, authenticated;
