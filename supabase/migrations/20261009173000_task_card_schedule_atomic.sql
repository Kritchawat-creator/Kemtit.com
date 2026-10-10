-- One atomic, idempotent task-card scheduling operation with version-checked Undo.
-- The per-user advisory lock matches create/update/rescue and legacy reschedule RPCs.
-- Timed blocks are limited to one Bangkok calendar day in this release; date-only
-- moves remain available when a task has no selected time block.

create table public.task_card_schedule_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  occurrence_date date,
  request jsonb not null,
  before_state jsonb not null,
  after_state jsonb not null,
  response jsonb not null,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.task_card_schedule_operations enable row level security;
create policy "task_card_schedule_operations: select own"
  on public.task_card_schedule_operations for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.task_card_schedule_operations from public, anon, authenticated;
grant select on public.task_card_schedule_operations to authenticated;

create or replace function public.schedule_task_card_atomic(
  p_operation_id uuid,
  p_task_id uuid,
  p_expected_task_updated_at timestamptz,
  p_occurrence_date date,
  p_expected_occurrence_updated_at timestamptz,
  p_target_date date,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_block_id uuid,
  p_expected_blocks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.task_card_schedule_operations;
  v_task public.tasks;
  v_occurrence public.task_occurrences;
  v_occurrence_exists boolean := false;
  v_expected_blocks jsonb;
  v_request jsonb;
  v_before jsonb;
  v_after jsonb;
  v_response jsonb;
  v_expected_count integer;
  v_expected_distinct_count integer;
  v_actual_count integer;
  v_block_ids uuid[] := '{}'::uuid[];
  v_day_delta integer := 0;
  v_old_date date;
  v_day_code text;
  v_allowed_days text[];
  v_new_block_id uuid;
  v_all_block_ids uuid[] := '{}'::uuid[];
  v_item jsonb;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_operation_id is null or p_task_id is null or p_expected_task_updated_at is null or p_target_date is null
     or (p_start_at is null) <> (p_end_at is null)
     or jsonb_typeof(coalesce(p_expected_blocks, '[]'::jsonb)) <> 'array'
     or (p_occurrence_date is null and p_expected_occurrence_updated_at is not null)
     or (p_start_at is null and p_block_id is not null)
     or (p_start_at is not null and p_end_at <= p_start_at)
     or (p_start_at is not null and (
       timezone('Asia/Bangkok', p_start_at)::date <> p_target_date
       or timezone('Asia/Bangkok', p_end_at)::date <> p_target_date
       or p_end_at - p_start_at > interval '24 hours'
     )) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(value order by value ->> 'id'), '[]'::jsonb)
    into v_expected_blocks
  from jsonb_array_elements(coalesce(p_expected_blocks, '[]'::jsonb));
  select count(*), count(distinct (value ->> 'id')::uuid)
    into v_expected_count, v_expected_distinct_count
  from jsonb_array_elements(v_expected_blocks);
  if v_expected_count > 100 or v_expected_count <> v_expected_distinct_count
     or exists (
       select 1 from jsonb_array_elements(v_expected_blocks) expected(value)
       where jsonb_typeof(expected.value) <> 'object'
          or coalesce(expected.value ->> 'version', '') !~ '^[1-9][0-9]*$'
          or expected.value ->> 'startAt' is null
          or expected.value ->> 'endAt' is null
     ) then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_start_at is not null and v_expected_count > 0 and (
    p_block_id is null or not exists (
      select 1 from jsonb_array_elements(v_expected_blocks) expected(value)
      where (expected.value ->> 'id')::uuid = p_block_id
    )
  ) then raise exception 'invalid_input' using errcode = '22023'; end if;
  if p_start_at is not null and v_expected_count = 0 and p_block_id is not null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'taskId', p_task_id,
    'taskUpdatedAt', p_expected_task_updated_at,
    'occurrenceDate', p_occurrence_date,
    'occurrenceUpdatedAt', p_expected_occurrence_updated_at,
    'targetDate', p_target_date,
    'startAt', p_start_at,
    'endAt', p_end_at,
    'blockId', p_block_id,
    'blocks', v_expected_blocks
  );

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select * into v_existing
  from public.task_card_schedule_operations operation
  where operation.user_id = v_user_id and operation.operation_id = p_operation_id
  for update;
  if found then
    if v_existing.request <> v_request then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    if v_existing.undone_at is not null then
      return v_existing.response || jsonb_build_object('canUndo', false, 'undone', true);
    end if;
    return v_existing.response;
  end if;

  select * into v_task
  from public.tasks task
  where task.id = p_task_id and task.user_id = v_user_id
    and task.data_origin in ('USER', 'IMPORT')
    and task.archived_at is null and task.deleted_at is null and task.status <> 'archived'
  for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0001'; end if;
  if v_task.updated_at <> p_expected_task_updated_at then
    raise exception 'task_version_conflict' using errcode = '40001';
  end if;
  if v_task.status not in ('inbox', 'planned') or v_task.completed_at is not null then
    raise exception 'task_not_schedulable' using errcode = 'P0001';
  end if;
  if v_task.deadline is not null and p_target_date > v_task.deadline then
    raise exception 'deadline_conflict' using errcode = 'P0001';
  end if;

  if p_occurrence_date is null then
    if v_task.recurrence_rule is not null then raise exception 'occurrence_required' using errcode = 'P0001'; end if;
    v_old_date := coalesce(v_task.planned_date, v_task.due_date);
  else
    if v_task.status <> 'planned' then raise exception 'task_not_schedulable' using errcode = 'P0001'; end if;
    if v_task.recurrence_rule is null or v_task.due_date is null or p_occurrence_date < v_task.due_date then
      raise exception 'occurrence_invalid' using errcode = 'P0001';
    end if;
    if v_task.recurrence_rule = 'FREQ=DAILY' then
      null;
    elsif v_task.recurrence_rule = 'FREQ=WEEKLY' then
      if extract(dow from p_occurrence_date) <> extract(dow from v_task.due_date) then
        raise exception 'occurrence_invalid' using errcode = 'P0001';
      end if;
    elsif v_task.recurrence_rule ~ '^FREQ=WEEKLY;BYDAY=(SU|MO|TU|WE|TH|FR|SA)(,(SU|MO|TU|WE|TH|FR|SA))*$' then
      v_day_code := case extract(dow from p_occurrence_date)::integer
        when 0 then 'SU' when 1 then 'MO' when 2 then 'TU' when 3 then 'WE'
        when 4 then 'TH' when 5 then 'FR' else 'SA' end;
      v_allowed_days := string_to_array(regexp_replace(v_task.recurrence_rule, '^FREQ=WEEKLY;BYDAY=', ''), ',');
      if not (v_day_code = any(v_allowed_days)) then raise exception 'occurrence_invalid' using errcode = 'P0001'; end if;
    else
      raise exception 'occurrence_invalid' using errcode = 'P0001';
    end if;

    select * into v_occurrence
    from public.task_occurrences occurrence
    where occurrence.task_id = p_task_id and occurrence.user_id = v_user_id
      and occurrence.data_origin in ('USER', 'IMPORT')
      and occurrence.occurrence_date = p_occurrence_date
    for update;
    v_occurrence_exists := found;
    if v_occurrence_exists then
      if p_expected_occurrence_updated_at is null
         or v_occurrence.updated_at <> p_expected_occurrence_updated_at then
        raise exception 'occurrence_version_conflict' using errcode = '40001';
      end if;
      if v_occurrence.status <> 'planned'
         or v_occurrence.completed_at is not null
         or v_occurrence.skipped_at is not null then
        raise exception 'occurrence_not_schedulable' using errcode = 'P0001';
      end if;
      v_old_date := coalesce(v_occurrence.scheduled_date, v_occurrence.occurrence_date);
    else
      if p_expected_occurrence_updated_at is not null then
        raise exception 'occurrence_version_conflict' using errcode = '40001';
      end if;
      v_old_date := p_occurrence_date;
    end if;
  end if;

  -- Read/lock the complete set of active linked blocks before verifying the snapshot.
  perform 1 from public.time_blocks block
  where block.user_id = v_user_id and block.task_id = p_task_id
    and block.task_occurrence_id is not distinct from v_occurrence.id
    and block.status = 'active' and block.data_origin in ('USER', 'IMPORT')
  order by block.id for update;
  select count(*) into v_actual_count from public.time_blocks block
  where block.user_id = v_user_id and block.task_id = p_task_id
    and block.task_occurrence_id is not distinct from v_occurrence.id
    and block.status = 'active' and block.data_origin in ('USER', 'IMPORT');
  if v_expected_count <> v_actual_count or exists (
    select 1 from public.time_blocks block
    where block.user_id = v_user_id and block.task_id = p_task_id
      and block.task_occurrence_id is not distinct from v_occurrence.id
      and block.status = 'active' and block.data_origin in ('USER', 'IMPORT')
      and not exists (
        select 1 from jsonb_array_elements(v_expected_blocks) expected(value)
        where (expected.value ->> 'id')::uuid = block.id
          and (expected.value ->> 'version')::integer = block.version
          and (expected.value ->> 'startAt')::timestamptz = block.start_at
          and (expected.value ->> 'endAt')::timestamptz = block.end_at
      )
  ) then raise exception 'time_block_version_conflict' using errcode = '40001'; end if;

  select coalesce(array_agg(block.id order by block.id), '{}'::uuid[])
    into v_block_ids
  from public.time_blocks block
  where block.user_id = v_user_id and block.task_id = p_task_id
    and block.task_occurrence_id is not distinct from v_occurrence.id
    and block.status = 'active' and block.data_origin in ('USER', 'IMPORT');
  if v_old_date is null then
    if exists (
      select 1 from public.time_blocks block
      where block.id = any(v_block_ids)
        and timezone('Asia/Bangkok', block.start_at)::date <> p_target_date
    ) then raise exception 'time_block_anchor_missing' using errcode = 'P0001'; end if;
  else
    if exists (
      select 1 from public.time_blocks block
      where block.id = any(v_block_ids)
        and timezone('Asia/Bangkok', block.start_at)::date <> v_old_date
    ) then raise exception 'time_block_anchor_mismatch' using errcode = 'P0001'; end if;
    v_day_delta := p_target_date - v_old_date;
  end if;

  if v_day_delta <> 0 and exists (
    select 1 from public.time_blocks block where block.id = any(v_block_ids) and block.is_locked
  ) then raise exception 'time_block_locked' using errcode = 'P0001'; end if;
  if p_block_id is not null and exists (
    select 1 from public.time_blocks block where block.id = p_block_id and block.is_locked
  ) then raise exception 'time_block_locked' using errcode = 'P0001'; end if;

  if cardinality(v_block_ids) > 0 and (v_day_delta <> 0 or p_block_id is not null) then
    if exists (
      with moving as (
        select block.id,
          case when block.id = p_block_id then p_start_at
            else (timezone('Asia/Bangkok', block.start_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok'
          end as next_start_at,
          case when block.id = p_block_id then p_end_at
            else (timezone('Asia/Bangkok', block.end_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok'
          end as next_end_at
        from public.time_blocks block where block.id = any(v_block_ids)
      )
      select 1 from moving item
      join public.time_blocks other on other.user_id = v_user_id and other.id <> item.id
        and other.status = 'active' and other.data_origin in ('USER', 'IMPORT')
        and other.start_at < item.next_end_at and other.end_at > item.next_start_at
      where not (other.id = any(v_block_ids))
      union all
      select 1 from (
        select first_block.id as first_id, second_block.id as second_id
        from public.time_blocks first_block
        join public.time_blocks second_block on second_block.id = any(v_block_ids)
          and first_block.id < second_block.id
        where first_block.id = any(v_block_ids)
      ) pair
      join public.time_blocks first_block on first_block.id = pair.first_id
      join public.time_blocks second_block on second_block.id = pair.second_id
      where
        (case when pair.first_id = p_block_id then p_start_at
          else (timezone('Asia/Bangkok', first_block.start_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok' end)
          < (case when pair.second_id = p_block_id then p_end_at
          else (timezone('Asia/Bangkok', second_block.end_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok' end)
        and
        (case when pair.first_id = p_block_id then p_end_at
          else (timezone('Asia/Bangkok', first_block.end_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok' end)
          > (case when pair.second_id = p_block_id then p_start_at
          else (timezone('Asia/Bangkok', second_block.start_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok' end)
    ) then raise exception 'time_block_overlap' using errcode = 'P0001'; end if;
  elsif cardinality(v_block_ids) = 0 and p_start_at is not null and exists (
    select 1 from public.time_blocks other
    where other.user_id = v_user_id
      and other.status = 'active'
      and other.data_origin in ('USER', 'IMPORT')
      and other.start_at < p_end_at
      and other.end_at > p_start_at
  ) then
    raise exception 'time_block_overlap' using errcode = 'P0001';
  end if;

  if exists (
    with moving as (
      select block.id,
        case when block.id = p_block_id then p_start_at
          else (timezone('Asia/Bangkok', block.start_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok'
        end as next_start_at,
        case when block.id = p_block_id then p_end_at
          else (timezone('Asia/Bangkok', block.end_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok'
        end as next_end_at
      from public.time_blocks block
      where block.id = any(v_block_ids)
        and (v_day_delta <> 0 or block.id = p_block_id)
      union all
      select null::uuid, p_start_at, p_end_at
      where cardinality(v_block_ids) = 0 and p_start_at is not null
    )
    select 1
    from moving item
    join public.calendar_events calendar_event on calendar_event.user_id = v_user_id
      and calendar_event.data_origin in ('USER', 'IMPORT')
      and calendar_event.blocks_time
    where (
        calendar_event.all_day
        and (calendar_event.event_date::timestamp at time zone 'Asia/Bangkok') < item.next_end_at
        and ((calendar_event.event_date + 1)::timestamp at time zone 'Asia/Bangkok') > item.next_start_at
      ) or (
        not calendar_event.all_day
        and (calendar_event.event_date + calendar_event.start_time) at time zone 'Asia/Bangkok' < item.next_end_at
        and (calendar_event.event_date + calendar_event.end_time) at time zone 'Asia/Bangkok' > item.next_start_at
      )
  ) then raise exception 'calendar_event_conflict' using errcode = 'P0001'; end if;

  v_before := jsonb_build_object(
    'task', jsonb_build_object(
      'id', v_task.id, 'planned_date', v_task.planned_date, 'due_date', v_task.due_date,
      'status', v_task.status, 'updated_at', v_task.updated_at
    ),
    'occurrence', case when v_occurrence_exists then jsonb_build_object(
      'id', v_occurrence.id, 'occurrence_date', v_occurrence.occurrence_date,
      'scheduled_date', v_occurrence.scheduled_date, 'status', v_occurrence.status,
      'completed_at', v_occurrence.completed_at, 'skipped_at', v_occurrence.skipped_at,
      'scheduled_start', v_occurrence.scheduled_start, 'scheduled_end', v_occurrence.scheduled_end,
      'updated_at', v_occurrence.updated_at
    ) else null end,
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', block.id, 'start_at', block.start_at, 'end_at', block.end_at,
        'version', block.version, 'updated_at', block.updated_at,
        'status', block.status, 'is_locked', block.is_locked
      ) order by block.id)
      from public.time_blocks block where block.id = any(v_block_ids)
    ), '[]'::jsonb)
  );

  if p_occurrence_date is null then
    update public.tasks set due_date = p_target_date, planned_date = p_target_date, status = 'planned'
    where id = p_task_id and user_id = v_user_id;
  else
    insert into public.task_occurrences(
      task_id, user_id, occurrence_date, scheduled_date, status, completed_at, skipped_at
    ) values (
      p_task_id, v_user_id, p_occurrence_date, p_target_date, 'planned', null, null
    ) on conflict (task_id, occurrence_date) do update
      set scheduled_date = excluded.scheduled_date,
          status = 'planned', completed_at = null, skipped_at = null
    returning * into v_occurrence;
  end if;

  if cardinality(v_block_ids) > 0 and (v_day_delta <> 0 or p_block_id is not null) then
    update public.time_blocks block
    set start_at = case when block.id = p_block_id then p_start_at
          else (timezone('Asia/Bangkok', block.start_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok' end,
        end_at = case when block.id = p_block_id then p_end_at
          else (timezone('Asia/Bangkok', block.end_at) + make_interval(days => v_day_delta)) at time zone 'Asia/Bangkok' end,
        version = block.version + 1
    where block.id = any(v_block_ids);
  elsif cardinality(v_block_ids) = 0 and p_start_at is not null then
    insert into public.time_blocks(
      user_id, task_id, task_occurrence_id, title, start_at, end_at, source, status, version
    ) values (
      v_user_id, p_task_id, v_occurrence.id, v_task.title, p_start_at, p_end_at, 'kemtit', 'active', 1
    ) returning id into v_new_block_id;
    v_block_ids := array[v_new_block_id];
  end if;

  if p_occurrence_date is not null then
    select * into v_occurrence from public.task_occurrences occurrence
    where occurrence.task_id = p_task_id and occurrence.user_id = v_user_id
      and occurrence.occurrence_date = p_occurrence_date;
  end if;

  select coalesce(array_agg(block.id order by block.id), '{}'::uuid[])
    into v_all_block_ids
  from public.time_blocks block
  where block.user_id = v_user_id and block.task_id = p_task_id
    and block.task_occurrence_id is not distinct from v_occurrence.id
    and block.status = 'active' and block.data_origin in ('USER', 'IMPORT');

  v_after := jsonb_build_object(
    'task', (select jsonb_build_object(
      'id', task.id, 'planned_date', task.planned_date, 'due_date', task.due_date,
      'status', task.status, 'updated_at', task.updated_at
    ) from public.tasks task where task.id = p_task_id and task.user_id = v_user_id),
    'occurrence', case when p_occurrence_date is not null then jsonb_build_object(
      'id', v_occurrence.id, 'occurrence_date', v_occurrence.occurrence_date,
      'scheduled_date', v_occurrence.scheduled_date, 'status', v_occurrence.status,
      'completed_at', v_occurrence.completed_at, 'skipped_at', v_occurrence.skipped_at,
      'scheduled_start', v_occurrence.scheduled_start, 'scheduled_end', v_occurrence.scheduled_end,
      'updated_at', v_occurrence.updated_at
    ) else null end,
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', block.id, 'start_at', block.start_at, 'end_at', block.end_at,
        'version', block.version, 'updated_at', block.updated_at,
        'status', block.status, 'is_locked', block.is_locked
      ) order by block.id)
      from public.time_blocks block where block.id = any(v_all_block_ids)
    ), '[]'::jsonb)
  );
  v_response := jsonb_build_object(
    'operationId', p_operation_id,
    'taskId', p_task_id,
    'targetDate', p_target_date,
    'blockIds', to_jsonb(v_all_block_ids),
    'canUndo', true
  );
  insert into public.task_card_schedule_operations(
    user_id, operation_id, task_id, occurrence_date, request, before_state, after_state, response
  ) values (
    v_user_id, p_operation_id, p_task_id, p_occurrence_date, v_request, v_before, v_after, v_response
  );
  return v_response;
end
$$;

create or replace function public.undo_task_card_schedule_atomic(p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation public.task_card_schedule_operations;
  v_task_id uuid;
  v_occurrence_date date;
  v_task_before jsonb;
  v_task_after jsonb;
  v_occurrence_before jsonb;
  v_occurrence_after jsonb;
  v_block_after jsonb;
  v_block_id uuid;
  v_expected_count integer;
  v_actual_count integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_operation_id is null then raise exception 'invalid_input' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select * into v_operation from public.task_card_schedule_operations operation
  where operation.user_id = v_user_id and operation.operation_id = p_operation_id
  for update;
  if not found then raise exception 'operation_not_found' using errcode = 'P0001'; end if;
  if v_operation.undone_at is not null then
    return jsonb_build_object('operationId', p_operation_id, 'undone', true, 'canUndo', false);
  end if;
  v_task_id := v_operation.task_id;
  v_occurrence_date := v_operation.occurrence_date;
  v_task_before := v_operation.before_state -> 'task';
  v_task_after := v_operation.after_state -> 'task';
  v_occurrence_before := nullif(v_operation.before_state -> 'occurrence', 'null'::jsonb);
  v_occurrence_after := nullif(v_operation.after_state -> 'occurrence', 'null'::jsonb);

  perform 1 from public.tasks task where task.id = v_task_id and task.user_id = v_user_id for update;
  if not found then raise exception 'undo_conflict' using errcode = '40001'; end if;
  if (select task.updated_at from public.tasks task where task.id = v_task_id and task.user_id = v_user_id)
     <> (v_task_after ->> 'updated_at')::timestamptz
     or (select task.planned_date from public.tasks task where task.id = v_task_id and task.user_id = v_user_id)
       is distinct from nullif(v_task_after ->> 'planned_date', '')::date
     or (select task.due_date from public.tasks task where task.id = v_task_id and task.user_id = v_user_id)
       is distinct from nullif(v_task_after ->> 'due_date', '')::date
     or (select task.status from public.tasks task where task.id = v_task_id and task.user_id = v_user_id)
       is distinct from v_task_after ->> 'status' then
    raise exception 'undo_conflict' using errcode = '40001';
  end if;

  if v_occurrence_after is not null then
    perform 1 from public.task_occurrences occurrence
    where occurrence.task_id = v_task_id and occurrence.user_id = v_user_id
      and occurrence.occurrence_date = v_occurrence_date
    for update;
    if not found or not exists (
      select 1 from public.task_occurrences occurrence
      where occurrence.task_id = v_task_id and occurrence.user_id = v_user_id
        and occurrence.occurrence_date = v_occurrence_date
        and occurrence.id = (v_occurrence_after ->> 'id')::uuid
        and occurrence.updated_at = (v_occurrence_after ->> 'updated_at')::timestamptz
        and occurrence.scheduled_date = (v_occurrence_after ->> 'scheduled_date')::date
        and occurrence.status = v_occurrence_after ->> 'status'
        and occurrence.completed_at is not distinct from nullif(v_occurrence_after ->> 'completed_at', '')::timestamptz
        and occurrence.skipped_at is not distinct from nullif(v_occurrence_after ->> 'skipped_at', '')::timestamptz
        and occurrence.scheduled_start is not distinct from nullif(v_occurrence_after ->> 'scheduled_start', '')::timestamptz
        and occurrence.scheduled_end is not distinct from nullif(v_occurrence_after ->> 'scheduled_end', '')::timestamptz
    ) then raise exception 'undo_conflict' using errcode = '40001'; end if;
  end if;

  perform 1 from public.time_blocks block
  where block.user_id = v_user_id and block.task_id = v_task_id
    and block.task_occurrence_id is not distinct from case when v_occurrence_after is null then null
      else (v_occurrence_after ->> 'id')::uuid end
    and block.status = 'active' and block.data_origin in ('USER', 'IMPORT')
  order by block.id for update;
  select count(*) into v_expected_count from jsonb_array_elements(v_operation.after_state -> 'blocks');
  select count(*) into v_actual_count from public.time_blocks block
  where block.user_id = v_user_id and block.task_id = v_task_id
    and block.task_occurrence_id is not distinct from case when v_occurrence_after is null then null
      else (v_occurrence_after ->> 'id')::uuid end
    and block.status = 'active' and block.data_origin in ('USER', 'IMPORT');
  if v_actual_count <> v_expected_count or exists (
    select 1 from jsonb_array_elements(v_operation.after_state -> 'blocks') expected(value)
    where not exists (
      select 1 from public.time_blocks block
      where block.id = (expected.value ->> 'id')::uuid
        and block.user_id = v_user_id and block.task_id = v_task_id
        and block.task_occurrence_id is not distinct from case when v_occurrence_after is null then null
          else (v_occurrence_after ->> 'id')::uuid end
        and block.start_at = (expected.value ->> 'start_at')::timestamptz
        and block.end_at = (expected.value ->> 'end_at')::timestamptz
        and block.version = (expected.value ->> 'version')::integer
        and block.updated_at = (expected.value ->> 'updated_at')::timestamptz
        and block.status = expected.value ->> 'status'
        and block.is_locked = (expected.value ->> 'is_locked')::boolean
    )
  ) then raise exception 'undo_conflict' using errcode = '40001'; end if;

  -- Undo restores earlier intervals, so recheck them against blocks created
  -- since the original move. Operation-owned blocks will be restored or
  -- removed below and must not conflict with their own prior state.
  if exists (
    with restoring as (
      select (value ->> 'id')::uuid as id,
        (value ->> 'start_at')::timestamptz as start_at,
        (value ->> 'end_at')::timestamptz as end_at
      from jsonb_array_elements(v_operation.before_state -> 'blocks')
    ), operation_blocks as (
      select (value ->> 'id')::uuid as id
      from jsonb_array_elements(v_operation.after_state -> 'blocks')
    )
    select 1
    from restoring item
    join public.time_blocks other on other.user_id = v_user_id
      and other.status = 'active' and other.data_origin in ('USER', 'IMPORT')
      and other.id <> item.id
      and not exists (select 1 from operation_blocks operation_block where operation_block.id = other.id)
      and other.start_at < item.end_at and other.end_at > item.start_at
    union all
    select 1
    from restoring item
    join public.calendar_events calendar_event on calendar_event.user_id = v_user_id
      and calendar_event.data_origin in ('USER', 'IMPORT')
      and calendar_event.blocks_time
    where (
        calendar_event.all_day
        and (calendar_event.event_date::timestamp at time zone 'Asia/Bangkok') < item.end_at
        and ((calendar_event.event_date + 1)::timestamp at time zone 'Asia/Bangkok') > item.start_at
      ) or (
        not calendar_event.all_day
        and (calendar_event.event_date + calendar_event.start_time) at time zone 'Asia/Bangkok' < item.end_at
        and (calendar_event.event_date + calendar_event.end_time) at time zone 'Asia/Bangkok' > item.start_at
      )
    union all
    select 1
    from restoring first_block
    join restoring second_block on first_block.id < second_block.id
      and first_block.start_at < second_block.end_at
      and first_block.end_at > second_block.start_at
  ) then raise exception 'undo_conflict' using errcode = '40001'; end if;

  for v_block_after in select value from jsonb_array_elements(v_operation.after_state -> 'blocks') loop
    v_block_id := (v_block_after ->> 'id')::uuid;
    if not exists (
      select 1 from jsonb_array_elements(v_operation.before_state -> 'blocks') before_block(value)
      where (before_block.value ->> 'id')::uuid = v_block_id
    ) then
      delete from public.time_blocks block where block.id = v_block_id and block.user_id = v_user_id;
    else
      update public.time_blocks block
      set start_at = (
            select (before_block.value ->> 'start_at')::timestamptz
            from jsonb_array_elements(v_operation.before_state -> 'blocks') before_block(value)
            where (before_block.value ->> 'id')::uuid = v_block_id
          ),
          end_at = (
            select (before_block.value ->> 'end_at')::timestamptz
            from jsonb_array_elements(v_operation.before_state -> 'blocks') before_block(value)
            where (before_block.value ->> 'id')::uuid = v_block_id
          ),
          version = block.version + 1
      where block.id = v_block_id and block.user_id = v_user_id;
    end if;
  end loop;

  if v_occurrence_after is not null then
    if v_occurrence_before is null then
      delete from public.task_occurrences occurrence
      where occurrence.id = (v_occurrence_after ->> 'id')::uuid and occurrence.user_id = v_user_id;
    else
      update public.task_occurrences occurrence
      set scheduled_date = (v_occurrence_before ->> 'scheduled_date')::date,
          status = v_occurrence_before ->> 'status',
          completed_at = nullif(v_occurrence_before ->> 'completed_at', '')::timestamptz,
          skipped_at = nullif(v_occurrence_before ->> 'skipped_at', '')::timestamptz,
          scheduled_start = nullif(v_occurrence_before ->> 'scheduled_start', '')::timestamptz,
          scheduled_end = nullif(v_occurrence_before ->> 'scheduled_end', '')::timestamptz
      where occurrence.id = (v_occurrence_before ->> 'id')::uuid and occurrence.user_id = v_user_id;
    end if;
  else
    update public.tasks task
    set planned_date = nullif(v_task_before ->> 'planned_date', '')::date,
        due_date = nullif(v_task_before ->> 'due_date', '')::date,
        status = v_task_before ->> 'status'
    where task.id = v_task_id and task.user_id = v_user_id;
  end if;

  update public.task_card_schedule_operations operation
  set undone_at = now()
  where operation.user_id = v_user_id and operation.operation_id = p_operation_id;
  return jsonb_build_object('operationId', p_operation_id, 'undone', true, 'canUndo', false);
end
$$;

revoke all on function public.schedule_task_card_atomic(uuid, uuid, timestamptz, date, timestamptz, date, timestamptz, timestamptz, uuid, jsonb)
  from public, anon, authenticated;
alter function public.schedule_task_card_atomic(uuid, uuid, timestamptz, date, timestamptz, date, timestamptz, timestamptz, uuid, jsonb)
  owner to postgres;
grant execute on function public.schedule_task_card_atomic(uuid, uuid, timestamptz, date, timestamptz, date, timestamptz, timestamptz, uuid, jsonb)
  to authenticated;
revoke all on function public.undo_task_card_schedule_atomic(uuid) from public, anon, authenticated;
alter function public.undo_task_card_schedule_atomic(uuid) owner to postgres;
grant execute on function public.undo_task_card_schedule_atomic(uuid) to authenticated;
