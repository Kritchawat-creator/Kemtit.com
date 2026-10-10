-- Keep daily priority ordering independent from the daily time budget and notes.
-- Each reorder is atomic, versioned, idempotent, and can be undone once.

create table public.daily_plan_priority_orders (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_date date not null,
  priority_task_ids uuid[] not null default '{}'::uuid[],
  version integer not null default 0 check (version >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_date),
  constraint daily_plan_priority_orders_limit check (cardinality(priority_task_ids) <= 3),
  constraint daily_plan_priority_orders_no_nulls
    check (array_position(priority_task_ids, null::uuid) is null)
);

create index daily_plan_priority_orders_date_idx
  on public.daily_plan_priority_orders (user_id, plan_date desc);

alter table public.daily_plan_priority_orders enable row level security;
create policy "daily_plan_priority_orders: select own"
  on public.daily_plan_priority_orders for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.daily_plan_priority_orders from public, anon, authenticated;
grant select on public.daily_plan_priority_orders to authenticated;

-- Existing saved selections remain the initial source of truth after migration,
-- including an intentionally empty selection.
insert into public.daily_plan_priority_orders (user_id, plan_date, priority_task_ids, version)
select
  dp.user_id,
  dp.plan_date,
  coalesce(
    array_agg(task_id order by ordinal) filter (where task_id is not null),
    '{}'::uuid[]
  ),
  0
from public.daily_plans dp
left join lateral (
  select value::uuid as task_id, min(ordinal) as ordinal
  from unnest(dp.top_priorities) with ordinality as legacy(value, ordinal)
  where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  group by value::uuid
) priorities on true
group by dp.user_id, dp.plan_date
on conflict (user_id, plan_date) do nothing;

create table public.daily_plan_priority_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  plan_date date not null,
  expected_version integer not null check (expected_version >= 0),
  before_priority_task_ids uuid[] not null,
  after_priority_task_ids uuid[] not null,
  version_after integer not null check (version_after > 0),
  response jsonb not null,
  undone_at timestamptz,
  undo_response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id),
  constraint daily_plan_priority_operations_after_limit
    check (cardinality(after_priority_task_ids) <= 3),
  constraint daily_plan_priority_operations_before_limit
    check (cardinality(before_priority_task_ids) <= 3)
);

alter table public.daily_plan_priority_operations enable row level security;
create policy "daily_plan_priority_operations: select own"
  on public.daily_plan_priority_operations for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.daily_plan_priority_operations from public, anon, authenticated;
grant select on public.daily_plan_priority_operations to authenticated;

create or replace function public.set_daily_plan_priorities_atomic(
  p_operation_id uuid,
  p_plan_date date,
  p_priority_task_ids uuid[],
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.daily_plan_priority_operations%rowtype;
  v_order public.daily_plan_priority_orders%rowtype;
  v_response jsonb;
  v_next_version integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  -- Match the lock used by task mutations so stale-task checks serialize with archive/completion.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  if p_operation_id is null or p_plan_date is null or p_expected_version is null
     or p_expected_version < 0 or p_priority_task_ids is null
     or cardinality(p_priority_task_ids) > 3
     or array_position(p_priority_task_ids, null) is not null then
    raise exception 'invalid priority order input' using errcode = '22023';
  end if;
  if cardinality(p_priority_task_ids) <> (
    select count(distinct task_id) from unnest(p_priority_task_ids) as requested(task_id)
  ) then
    raise exception 'duplicate priority task' using errcode = '22023';
  end if;

  -- Serialize retries of the same operation across dates before locking the plan row.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':priority-op:' || p_operation_id::text, 0)
  );
  select * into v_existing
  from public.daily_plan_priority_operations
  where user_id = v_user_id and operation_id = p_operation_id
  for update;
  if found then
    if v_existing.plan_date <> p_plan_date
       or v_existing.expected_version <> p_expected_version
       or v_existing.after_priority_task_ids <> p_priority_task_ids then
      return jsonb_build_object('status', 'conflict', 'reason', 'idempotency_conflict', 'operationId', p_operation_id);
    end if;
    if v_existing.undone_at is not null then
      return coalesce(
        v_existing.undo_response,
        jsonb_build_object('status', 'conflict', 'reason', 'operation_undone', 'operationId', p_operation_id)
      );
    end if;
    return v_existing.response;
  end if;

  -- Lock task rows in a stable order before validating their active state.
  perform task.id
  from public.tasks task
  where task.user_id = v_user_id
    and task.id = any(p_priority_task_ids)
  order by task.id
  for update;

  if exists (
    select 1
    from unnest(p_priority_task_ids) as requested(task_id)
    left join public.tasks task
      on task.id = requested.task_id and task.user_id = v_user_id
    where task.id is null
       or task.archived_at is not null
       or task.deleted_at is not null
       or task.completed_at is not null
       or task.status in ('completed', 'archived')
       or task.data_origin not in ('USER', 'IMPORT')
  ) then
    return jsonb_build_object('status', 'conflict', 'reason', 'stale_task', 'operationId', p_operation_id);
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':priority-date:' || p_plan_date::text, 0)
  );
  insert into public.daily_plan_priority_orders (user_id, plan_date)
  values (v_user_id, p_plan_date)
  on conflict (user_id, plan_date) do nothing;
  select * into v_order
  from public.daily_plan_priority_orders
  where user_id = v_user_id and plan_date = p_plan_date
  for update;

  if v_order.version <> p_expected_version then
    return jsonb_build_object(
      'status', 'conflict',
      'reason', 'version_conflict',
      'operationId', p_operation_id,
      'priorityTaskIds', v_order.priority_task_ids,
      'version', v_order.version
    );
  end if;

  v_next_version := v_order.version + 1;
  update public.daily_plan_priority_orders
  set priority_task_ids = p_priority_task_ids,
      version = v_next_version,
      updated_at = now()
  where user_id = v_user_id and plan_date = p_plan_date;

  v_response := jsonb_build_object(
    'status', 'applied',
    'operationId', p_operation_id,
    'priorityTaskIds', p_priority_task_ids,
    'version', v_next_version
  );
  insert into public.daily_plan_priority_operations (
    user_id, operation_id, plan_date, expected_version,
    before_priority_task_ids, after_priority_task_ids, version_after, response
  ) values (
    v_user_id, p_operation_id, p_plan_date, p_expected_version,
    v_order.priority_task_ids, p_priority_task_ids, v_next_version, v_response
  );
  return v_response;
end;
$$;

create or replace function public.undo_daily_plan_priorities_atomic(p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation public.daily_plan_priority_operations%rowtype;
  v_order public.daily_plan_priority_orders%rowtype;
  v_restore_task_ids uuid[];
  v_response jsonb;
  v_next_version integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'operation id is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':priority-op:' || p_operation_id::text, 0)
  );
  select * into v_operation
  from public.daily_plan_priority_operations
  where user_id = v_user_id and operation_id = p_operation_id
  for update;
  if not found then
    return jsonb_build_object('status', 'conflict', 'reason', 'operation_missing', 'operationId', p_operation_id);
  end if;
  if v_operation.undone_at is not null then
    return coalesce(v_operation.undo_response, jsonb_build_object('status', 'conflict', 'reason', 'undo_missing'));
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':priority-date:' || v_operation.plan_date::text, 0)
  );
  select * into v_order
  from public.daily_plan_priority_orders
  where user_id = v_user_id and plan_date = v_operation.plan_date
  for update;
  if not found
     or v_order.version <> v_operation.version_after
     or v_order.priority_task_ids <> v_operation.after_priority_task_ids then
    return jsonb_build_object(
      'status', 'conflict',
      'reason', 'version_conflict',
      'operationId', p_operation_id,
      'priorityTaskIds', v_order.priority_task_ids,
      'version', v_order.version
    );
  end if;

  -- Tasks may have been completed or archived since the original save. Restore
  -- only still-active tasks so Undo cannot reintroduce stale priorities.
  perform task.id
  from public.tasks task
  where task.user_id = v_user_id
    and task.id = any(v_operation.before_priority_task_ids)
  order by task.id
  for update;
  select coalesce(array_agg(requested.task_id order by requested.ordinal), '{}'::uuid[])
    into v_restore_task_ids
  from unnest(v_operation.before_priority_task_ids) with ordinality as requested(task_id, ordinal)
  join public.tasks task
    on task.id = requested.task_id and task.user_id = v_user_id
  where task.archived_at is null
    and task.deleted_at is null
    and task.completed_at is null
    and task.status not in ('completed', 'archived')
    and task.data_origin in ('USER', 'IMPORT');

  v_next_version := v_order.version + 1;
  update public.daily_plan_priority_orders
  set priority_task_ids = v_restore_task_ids,
      version = v_next_version,
      updated_at = now()
  where user_id = v_user_id and plan_date = v_operation.plan_date;

  v_response := jsonb_build_object(
    'status', 'applied',
    'operationId', p_operation_id,
    'priorityTaskIds', v_restore_task_ids,
    'version', v_next_version,
    'undone', true
  );
  update public.daily_plan_priority_operations
  set undone_at = now(), undo_response = v_response
  where user_id = v_user_id and operation_id = p_operation_id;
  return v_response;
end;
$$;

revoke all on function public.set_daily_plan_priorities_atomic(uuid, date, uuid[], integer) from public, anon;
revoke all on function public.undo_daily_plan_priorities_atomic(uuid) from public, anon;
grant execute on function public.set_daily_plan_priorities_atomic(uuid, date, uuid[], integer) to authenticated;
grant execute on function public.undo_daily_plan_priorities_atomic(uuid) to authenticated;
