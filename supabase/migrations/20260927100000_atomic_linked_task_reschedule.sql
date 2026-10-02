-- Keep canonical task/occurrence dates and their active linked blocks in sync.
-- Every public mutation serializes by user before locking task/block rows, which
-- matches the existing time-block and rescue mutation lock order.

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

create or replace function public.reschedule_task_atomic(
  p_task_id uuid,
  p_new_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid;
  v_old_date date;
  v_recurrence_rule text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_task_id is null or p_new_date is null then
    raise exception 'invalid_task_input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select t.goal_id, coalesce(t.planned_date, t.due_date), t.recurrence_rule
    into v_goal_id, v_old_date, v_recurrence_rule
  from public.tasks t
  where t.id = p_task_id
    and t.user_id = v_user_id
    and t.data_origin in ('USER', 'IMPORT')
    and t.archived_at is null
    and t.deleted_at is null
  for update;

  if not found then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;
  if v_recurrence_rule is not null then
    raise exception 'recurring_occurrence_required' using errcode = 'P0001';
  end if;

  perform public._shift_linked_task_blocks_atomic(
    v_user_id, p_task_id, null, v_old_date, p_new_date
  );

  update public.tasks
  set due_date = p_new_date,
      planned_date = p_new_date
  where id = p_task_id and user_id = v_user_id;

  return v_goal_id;
end
$$;

revoke all on function public.reschedule_task_atomic(uuid, date) from public, anon;
grant execute on function public.reschedule_task_atomic(uuid, date) to authenticated;

create or replace function public.reschedule_task_occurrence_atomic(
  p_task_id uuid,
  p_occurrence_date date,
  p_new_occurrence_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_occurrence_id uuid;
  v_old_scheduled_date date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_task_id is null or p_occurrence_date is null or p_new_occurrence_date is null then
    raise exception 'invalid_task_input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  perform 1
  from public.tasks t
  where t.id = p_task_id
    and t.user_id = v_user_id
    and t.data_origin in ('USER', 'IMPORT')
    and t.recurrence_rule is not null
    and t.archived_at is null
    and t.deleted_at is null
  for update;
  if not found then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  select o.id, coalesce(o.scheduled_date, o.occurrence_date)
    into v_occurrence_id, v_old_scheduled_date
  from public.task_occurrences o
  where o.task_id = p_task_id
    and o.user_id = v_user_id
    and o.data_origin in ('USER', 'IMPORT')
    and o.occurrence_date = p_occurrence_date
  for update;

  if found then
    perform public._shift_linked_task_blocks_atomic(
      v_user_id,
      p_task_id,
      v_occurrence_id,
      v_old_scheduled_date,
      p_new_occurrence_date
    );
  end if;

  insert into public.task_occurrences (
    task_id, user_id, occurrence_date, scheduled_date, status, completed_at, skipped_at
  )
  values (
    p_task_id, v_user_id, p_occurrence_date, p_new_occurrence_date, 'planned', null, null
  )
  on conflict (task_id, occurrence_date) do update
    set scheduled_date = excluded.scheduled_date,
        status = 'planned',
        completed_at = null,
        skipped_at = null
  returning id into v_occurrence_id;

  return v_occurrence_id;
end
$$;

revoke all on function public.reschedule_task_occurrence_atomic(uuid, date, date)
  from public, anon;
grant execute on function public.reschedule_task_occurrence_atomic(uuid, date, date)
  to authenticated;

create or replace function public.plan_inbox_task_atomic(
  p_task_id uuid,
  p_new_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid;
  v_old_date date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_task_id is null or p_new_date is null then
    raise exception 'invalid_task_input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select t.goal_id, coalesce(t.planned_date, t.due_date)
    into v_goal_id, v_old_date
  from public.tasks t
  where t.id = p_task_id
    and t.user_id = v_user_id
    and t.data_origin in ('USER', 'IMPORT')
    and t.status = 'inbox'
    and t.archived_at is null
    and t.deleted_at is null
  for update;
  if not found then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  perform public._shift_linked_task_blocks_atomic(
    v_user_id, p_task_id, null, v_old_date, p_new_date
  );

  update public.tasks
  set due_date = p_new_date,
      planned_date = p_new_date,
      status = 'planned'
  where id = p_task_id and user_id = v_user_id;

  return v_goal_id;
end
$$;

revoke all on function public.plan_inbox_task_atomic(uuid, date) from public, anon;
grant execute on function public.plan_inbox_task_atomic(uuid, date) to authenticated;

create or replace function public.update_task_with_blocks_atomic(
  p_task_id uuid,
  p_title text,
  p_due_date date,
  p_planned_date date,
  p_update_planned_date boolean,
  p_deadline date,
  p_update_deadline boolean,
  p_domain text,
  p_recurrence_rule text,
  p_goal_id uuid,
  p_project_id uuid,
  p_priority text,
  p_estimated_minutes integer,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid;
  v_old_date date;
  v_existing_planned_date date;
  v_existing_deadline date;
  v_new_deadline date;
  v_new_date date;
  v_existing_recurrence text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_task_id is null
     or p_title is null
     or char_length(btrim(p_title)) not between 1 and 200
     or p_due_date is null
     or p_update_planned_date is null
     or p_update_deadline is null
     or p_domain is null
     or p_domain not in ('work', 'health', 'family', 'finance', 'growth', 'relationships')
     or p_priority is null
     or p_priority not in ('high', 'normal', 'low')
     or (p_recurrence_rule is not null and p_recurrence_rule !~ '^FREQ=(DAILY|WEEKLY)(;BYDAY=(SU|MO|TU|WE|TH|FR|SA)(,(SU|MO|TU|WE|TH|FR|SA))*)?$')
     or (p_estimated_minutes is not null and p_estimated_minutes not between 1 and 1440)
     or (p_notes is not null and char_length(p_notes) > 2000) then
    raise exception 'invalid_task_input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select t.goal_id, t.planned_date, coalesce(t.planned_date, t.due_date), t.deadline, t.recurrence_rule
    into v_goal_id, v_existing_planned_date, v_old_date, v_existing_deadline, v_existing_recurrence
  from public.tasks t
  where t.id = p_task_id
    and t.user_id = v_user_id
    and t.data_origin in ('USER', 'IMPORT')
    and t.archived_at is null
    and t.deleted_at is null
  for update;
  if not found then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  if p_goal_id is not null and not exists (
    select 1 from public.goals g
    where g.id = p_goal_id and g.user_id = v_user_id
      and g.data_origin in ('USER', 'IMPORT')
  ) then
    raise exception 'invalid_task_reference' using errcode = '23514';
  end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects p
    where p.id = p_project_id and p.user_id = v_user_id
      and p.data_origin in ('USER', 'IMPORT') and p.archived_at is null
  ) then
    raise exception 'invalid_task_reference' using errcode = '23514';
  end if;

  v_new_date := coalesce(
    case when p_update_planned_date then p_planned_date else v_existing_planned_date end,
    p_due_date
  );
  v_new_deadline := case when p_update_deadline then p_deadline else v_existing_deadline end;
  if v_new_deadline is not null and v_new_deadline < v_new_date then
    raise exception 'invalid_task_input' using errcode = '22023';
  end if;

  -- A series edit keeps concrete occurrence blocks attached to their immutable
  -- source occurrence; only one-off task blocks follow this form's date change.
  if v_existing_recurrence is null then
    perform public._shift_linked_task_blocks_atomic(
      v_user_id, p_task_id, null, v_old_date, v_new_date
    );
  end if;

  update public.tasks
  set title = p_title,
      due_date = p_due_date,
      planned_date = case when p_update_planned_date then p_planned_date else planned_date end,
      deadline = case when p_update_deadline then p_deadline else deadline end,
      domain = p_domain,
      recurrence_rule = p_recurrence_rule,
      goal_id = p_goal_id,
      project_id = p_project_id,
      priority = p_priority,
      estimated_minutes = p_estimated_minutes,
      notes = p_notes
  where id = p_task_id and user_id = v_user_id;

  return v_goal_id;
end
$$;

revoke all on function public.update_task_with_blocks_atomic(
  uuid, text, date, date, boolean, date, boolean, text, text, uuid, uuid, text, integer, text
) from public, anon;
grant execute on function public.update_task_with_blocks_atomic(
  uuid, text, date, date, boolean, date, boolean, text, text, uuid, uuid, text, integer, text
) to authenticated;

create or replace function public.carry_over_tasks_with_blocks_atomic(
  p_task_ids uuid[],
  p_new_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task_id uuid;
  v_task record;
  v_updated_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_new_date is null or p_task_ids is null or cardinality(p_task_ids) = 0 or cardinality(p_task_ids) > 100
     or (select count(distinct id) from unnest(p_task_ids) as ids(id)) <> cardinality(p_task_ids) then
    raise exception 'invalid_task_ids' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  -- Lock and validate the entire selection before mutating any row. If a block
  -- conflict is discovered later, raising aborts the transaction and all moves.
  for v_task_id in
    select id from unnest(p_task_ids) as ids(id) order by id
  loop
    select t.id, t.planned_date, t.deadline, t.recurrence_rule
      into v_task
    from public.tasks t
    where t.id = v_task_id
      and t.user_id = v_user_id
      and t.data_origin in ('USER', 'IMPORT')
      and t.archived_at is null
      and t.deleted_at is null
      and t.completed_at is null
      and t.planned_date is not null
    for update;
    if not found then
      raise exception 'task_not_found' using errcode = 'P0001';
    end if;
    if v_task.recurrence_rule is not null then
      raise exception 'recurring_occurrence_required' using errcode = 'P0001';
    end if;
    if v_task.deadline is not null and v_task.deadline < p_new_date then
      raise exception 'deadline_conflict' using errcode = 'P0001';
    end if;
  end loop;

  for v_task_id in
    select id from unnest(p_task_ids) as ids(id) order by id
  loop
    select t.id, t.planned_date, t.deadline
      into v_task
    from public.tasks t
    where t.id = v_task_id and t.user_id = v_user_id;

    perform public._shift_linked_task_blocks_atomic(
      v_user_id, v_task_id, null, v_task.planned_date, p_new_date
    );

    update public.tasks
    set planned_date = p_new_date,
        due_date = p_new_date
    where id = v_task_id and user_id = v_user_id;
    v_updated_count := v_updated_count + 1;
  end loop;

  return v_updated_count;
end
$$;

revoke all on function public.carry_over_tasks_with_blocks_atomic(uuid[], date)
  from public, anon;
grant execute on function public.carry_over_tasks_with_blocks_atomic(uuid[], date)
  to authenticated;
