-- Keep user-facing archive operations recoverable and consistent with linked
-- time blocks. Deleted rows remain in place; no hard-delete path is introduced.

alter table public.tasks
  add column if not exists archived_from_status text;

alter table public.projects
  add column if not exists archived_from_status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_archived_from_status_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks add constraint tasks_archived_from_status_check
      check (archived_from_status is null or archived_from_status in ('inbox', 'planned', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'projects_archived_from_status_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects add constraint projects_archived_from_status_check
      check (archived_from_status is null or archived_from_status in ('active', 'paused', 'completed'));
  end if;
end
$$;

create or replace function public.archive_task_atomic(p_task_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid;
  v_task_status text;
  v_cancelled_blocks integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_task_id is null then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  -- Match the lock order used by task/time-block scheduling and rescue RPCs.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select goal_id, status
    into v_goal_id, v_task_status
  from public.tasks
  where id = p_task_id
    and user_id = v_user_id
    and data_origin in ('USER', 'IMPORT')
    and archived_at is null
    and status <> 'archived'
    and deleted_at is null
  for update;

  if not found then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  update public.tasks
  set archived_from_status = case
        when v_task_status in ('inbox', 'planned', 'completed') then v_task_status
        when completed_at is not null then 'completed'
        when due_date is null and planned_date is null then 'inbox'
        else 'planned'
      end,
      status = 'archived',
      archived_at = now()
  where id = p_task_id and user_id = v_user_id;

  update public.time_blocks b
  set status = 'cancelled',
      version = b.version + 1
  where b.user_id = v_user_id
    and b.data_origin in ('USER', 'IMPORT')
    and b.status = 'active'
    and (
      b.task_id = p_task_id
      or exists (
        select 1
        from public.task_occurrences o
        where o.id = b.task_occurrence_id
          and o.task_id = p_task_id
          and o.user_id = v_user_id
      )
    );
  get diagnostics v_cancelled_blocks = row_count;

  return jsonb_build_object(
    'goalId', v_goal_id,
    'cancelledBlocks', v_cancelled_blocks
  );
end
$$;

create or replace function public.restore_task_atomic(p_task_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid;
  v_archived_status text;
  v_completed_at timestamptz;
  v_due_date date;
  v_planned_date date;
  v_restored_status text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_task_id is null then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select goal_id, archived_from_status, completed_at, due_date, planned_date
    into v_goal_id, v_archived_status, v_completed_at, v_due_date, v_planned_date
  from public.tasks
  where id = p_task_id
    and user_id = v_user_id
    and data_origin in ('USER', 'IMPORT')
    and status = 'archived'
    and deleted_at is null
  for update;

  if not found then
    raise exception 'task_not_found' using errcode = 'P0001';
  end if;

  v_restored_status := coalesce(
    v_archived_status,
    case
      when v_completed_at is not null then 'completed'
      when v_due_date is null and v_planned_date is null then 'inbox'
      else 'planned'
    end
  );

  update public.tasks
  set archived_at = null,
      archived_from_status = null,
      status = v_restored_status
  where id = p_task_id and user_id = v_user_id;

  -- Cancelled blocks remain history. Restoring the task never reactivates a
  -- block that may now overlap a different commitment.
  return jsonb_build_object('goalId', v_goal_id);
end
$$;

create or replace function public.archive_project_atomic(p_project_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_project_id is null then
    raise exception 'project_not_found' using errcode = 'P0001';
  end if;

  update public.projects
  set archived_from_status = case
        when status in ('active', 'paused', 'completed') then status
        else 'active'
      end,
      status = 'archived',
      archived_at = now()
  where id = p_project_id
    and user_id = v_user_id
    and data_origin in ('USER', 'IMPORT')
    and archived_at is null
    and status <> 'archived'
  returning id into v_project_id;

  if v_project_id is null then
    raise exception 'project_not_found' using errcode = 'P0001';
  end if;
  return v_project_id;
end
$$;

create or replace function public.restore_project_atomic(p_project_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_project_id is null then
    raise exception 'project_not_found' using errcode = 'P0001';
  end if;

  update public.projects
  set status = coalesce(archived_from_status, 'active'),
      archived_from_status = null,
      archived_at = null
  where id = p_project_id
    and user_id = v_user_id
    and data_origin in ('USER', 'IMPORT')
    and status = 'archived'
  returning id into v_project_id;

  if v_project_id is null then
    raise exception 'project_not_found' using errcode = 'P0001';
  end if;
  return v_project_id;
end
$$;

-- User-origin block writes serialize before they lock individual block rows.
-- This keeps direct authenticated updates in the same lock order as the RPCs.
create or replace function public.lock_user_time_block_writes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  end if;
  return null;
end
$$;

drop trigger if exists time_blocks_user_write_lock on public.time_blocks;
create trigger time_blocks_user_write_lock
  before insert or update on public.time_blocks
  for each statement execute function public.lock_user_time_block_writes();

create or replace function public.time_blocks_reject_archived_task()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_task_id uuid := new.task_id;
  v_occurrence_task_id uuid;
  v_occurrence_status text;
  v_archived_at timestamptz;
  v_deleted_at timestamptz;
  v_task_status text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if new.task_occurrence_id is not null then
    select task_id, status
      into v_occurrence_task_id, v_occurrence_status
    from public.task_occurrences
    where id = new.task_occurrence_id and user_id = new.user_id;

    if v_occurrence_task_id is null then
      raise exception 'time block occurrence must belong to the same user' using errcode = '23514';
    end if;
    if v_task_id is not null and v_task_id <> v_occurrence_task_id then
      raise exception 'time block task and occurrence must refer to the same task' using errcode = '23514';
    end if;
    v_task_id := v_occurrence_task_id;

    if v_occurrence_status = 'archived' then
      raise exception 'time_block_task_archived' using errcode = 'P0001';
    end if;
  end if;

  if v_task_id is not null then
    select archived_at, deleted_at, status
      into v_archived_at, v_deleted_at, v_task_status
    from public.tasks
    where id = v_task_id and user_id = new.user_id
    for update;

    if found and (v_archived_at is not null or v_deleted_at is not null or v_task_status = 'archived') then
      raise exception 'time_block_task_archived' using errcode = 'P0001';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists time_blocks_reject_archived_task on public.time_blocks;
create trigger time_blocks_reject_archived_task
  before insert or update on public.time_blocks
  for each row execute function public.time_blocks_reject_archived_task();

revoke all on function public.archive_task_atomic(uuid) from public, anon;
grant execute on function public.archive_task_atomic(uuid) to authenticated;
revoke all on function public.restore_task_atomic(uuid) from public, anon;
grant execute on function public.restore_task_atomic(uuid) to authenticated;
revoke all on function public.archive_project_atomic(uuid) from public, anon;
grant execute on function public.archive_project_atomic(uuid) to authenticated;
revoke all on function public.restore_project_atomic(uuid) from public, anon;
grant execute on function public.restore_project_atomic(uuid) to authenticated;
