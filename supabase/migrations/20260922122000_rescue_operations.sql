-- Deterministic rescue apply/undo. The proposal is client-visible, but all writes
-- and stale checks happen again under one per-user transaction lock.

create table if not exists public.rescue_operations (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_date date not null,
  status text not null default 'applied' check (status in ('applied', 'undone')),
  plan jsonb not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rescue_operations_user_created_idx
  on public.rescue_operations (user_id, created_at desc);

drop trigger if exists set_rescue_operations_updated_at on public.rescue_operations;
create trigger set_rescue_operations_updated_at
  before update on public.rescue_operations
  for each row execute function public.set_updated_at();

alter table public.rescue_operations enable row level security;
drop policy if exists "rescue_operations: select own" on public.rescue_operations;
create policy "rescue_operations: select own" on public.rescue_operations for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "rescue_operations: insert own" on public.rescue_operations;
create policy "rescue_operations: insert own" on public.rescue_operations for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "rescue_operations: update own" on public.rescue_operations;
create policy "rescue_operations: update own" on public.rescue_operations for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.rescue_operations from anon;

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

create or replace function public.undo_rescue_operation(p_operation_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation public.rescue_operations;
  v_before jsonb;
  v_after jsonb;
  v_current_updated_at timestamptz;
  v_current_version integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_operation
  from public.rescue_operations
  where id = p_operation_id and user_id = v_user_id
  for update;
  if not found then
    raise exception 'rescue operation not found' using errcode = 'P0002';
  end if;
  if v_operation.status = 'undone' then return p_operation_id; end if;

  for v_after in select value from jsonb_array_elements(v_operation.after_state->'tasks') loop
    select t.updated_at into v_current_updated_at
    from public.tasks t
    where t.id = (v_after->>'id')::uuid and t.user_id = v_user_id
    for update;
    if not found or v_current_updated_at <> (v_after->>'updated_at')::timestamptz then
      raise exception 'task changed after rescue; undo is unsafe' using errcode = '40001';
    end if;
  end loop;

  for v_after in select value from jsonb_array_elements(v_operation.after_state->'time_blocks') loop
    select b.version into v_current_version
    from public.time_blocks b
    where b.id = (v_after->>'id')::uuid and b.user_id = v_user_id
    for update;
    if not found or v_current_version <> (v_after->>'version')::integer then
      raise exception 'block changed after rescue; undo is unsafe' using errcode = '40001';
    end if;
  end loop;

  for v_before in select value from jsonb_array_elements(v_operation.before_state->'tasks') loop
    update public.tasks
    set planned_date = nullif(v_before->>'planned_date', '')::date,
        due_date = nullif(v_before->>'due_date', '')::date,
        deadline = nullif(v_before->>'deadline', '')::date
    where id = (v_before->>'id')::uuid and user_id = v_user_id;
  end loop;

  for v_after in select value from jsonb_array_elements(v_operation.after_state->'time_blocks') loop
    select value into v_before
    from jsonb_array_elements(v_operation.before_state->'time_blocks')
    where value->>'id' = v_after->>'id';
    if v_before is null then
      delete from public.time_blocks
      where id = (v_after->>'id')::uuid
        and user_id = v_user_id
        and version = (v_after->>'version')::integer;
      if not found then
        raise exception 'created block changed after rescue; undo is unsafe' using errcode = '40001';
      end if;
    else
      update public.time_blocks
      set start_at = (v_before->>'start_at')::timestamptz,
          end_at = (v_before->>'end_at')::timestamptz,
          status = v_before->>'status',
          is_locked = (v_before->>'is_locked')::boolean,
          version = version + 1
      where id = (v_before->>'id')::uuid
        and user_id = v_user_id
        and version = (v_after->>'version')::integer;
      if not found then
        raise exception 'block changed after rescue; undo is unsafe' using errcode = '40001';
      end if;
    end if;
  end loop;

  update public.rescue_operations
  set status = 'undone'
  where id = p_operation_id and user_id = v_user_id;
  return p_operation_id;
end
$$;

revoke all on function public.apply_rescue_operation(uuid, date, jsonb) from public;
revoke all on function public.apply_rescue_operation(uuid, date, jsonb) from anon;
grant execute on function public.apply_rescue_operation(uuid, date, jsonb) to authenticated;
revoke all on function public.undo_rescue_operation(uuid) from public;
revoke all on function public.undo_rescue_operation(uuid) from anon;
grant execute on function public.undo_rescue_operation(uuid) to authenticated;
