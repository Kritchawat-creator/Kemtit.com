-- Durable task-card cover ordering and one-level task-only groups.
-- Mutations are RPC-only so a client cannot forge the before/after state used by Undo.

alter table public.tasks
  add column task_group_id uuid,
  add column task_group_position integer not null default 0;

create table public.task_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  position integer not null default 0,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add constraint tasks_task_group_id_fkey
    foreign key (task_group_id) references public.task_groups(id) on delete set null;

create index task_groups_user_position_idx on public.task_groups(user_id, position, created_at, id);
create index tasks_group_position_idx on public.tasks(task_group_id, task_group_position, created_at, id)
  where task_group_id is not null;
create trigger set_task_groups_updated_at before update on public.task_groups
  for each row execute function public.set_updated_at();

create function public.tasks_check_group_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.task_group_id is not null and not exists (
    select 1 from public.task_groups g
    where g.id = new.task_group_id and g.user_id = new.user_id
  ) then
    raise exception 'task group must belong to the same user' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger tasks_group_owner before insert or update of task_group_id, user_id on public.tasks
  for each row execute function public.tasks_check_group_owner();

-- The tasks table remains writable for ordinary task fields, but membership is only
-- changed by the RPCs, which also bump the group version and record Undo snapshots.
create function public.tasks_guard_group_membership_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'postgres' and (
    (tg_op = 'INSERT' and new.task_group_id is not null)
    or (tg_op = 'UPDATE' and (
      new.task_group_id is distinct from old.task_group_id
      or new.task_group_position is distinct from old.task_group_position
    ))
  ) then
    raise exception 'task group membership requires the group mutation RPC' using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger tasks_group_membership_rpc_only before insert or update of task_group_id, task_group_position
  on public.tasks for each row execute function public.tasks_guard_group_membership_write();

alter table public.task_groups enable row level security;
create policy "task_groups: select own" on public.task_groups for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.task_groups from anon, authenticated;
grant select on public.task_groups to authenticated;

-- Immutable operation snapshots: authenticated users may read their own rows, but all writes
-- must pass through the narrowly scoped security-definer functions below.
create table public.task_card_group_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  group_id uuid,
  group_ids uuid[] not null default '{}'::uuid[],
  action text not null check (action in ('create', 'add', 'remove', 'rename', 'dissolve')),
  before_state jsonb not null,
  after_state jsonb not null,
  response jsonb not null,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
alter table public.task_card_group_operations enable row level security;
create policy "task_card_group_operations: select own"
  on public.task_card_group_operations for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.task_card_group_operations from public, anon, authenticated;
grant select on public.task_card_group_operations to authenticated;

create or replace function public.mutate_task_card_group_atomic(
  p_operation_id uuid,
  p_action text,
  p_group_id uuid,
  p_task_ids uuid[],
  p_title text,
  p_expected_group_versions jsonb,
  p_expected_task_states jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request jsonb;
  v_existing public.task_card_group_operations;
  v_group_id uuid := p_group_id;
  v_target_group_id uuid;
  v_group_ids uuid[];
  v_affected_task_ids uuid[];
  v_task_id uuid;
  v_next_position integer;
  v_task_ids uuid[] := coalesce(p_task_ids, '{}'::uuid[]);
  v_entry jsonb;
  v_existing_group_count integer;
  v_expected_group_count integer;
  v_expected_task_count integer;
  v_actual_task_count integer;
  v_group_id_in jsonb;
  v_before jsonb;
  v_after jsonb;
  v_response jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_operation_id is null or p_action is null
     or p_action not in ('create', 'add', 'remove', 'rename', 'dissolve')
     or cardinality(v_task_ids) > 100
     or cardinality(v_task_ids) <> (select count(distinct item.task_id) from unnest(v_task_ids) as item(task_id))
     or (p_action in ('create', 'add', 'remove') and cardinality(v_task_ids) < 1)
     or (p_action = 'create' and cardinality(v_task_ids) < 2)
     or (p_action = 'rename' and (p_title is null or char_length(btrim(p_title)) not between 1 and 80))
     or (p_action = 'create' and (p_title is null or char_length(btrim(p_title)) not between 1 and 80))
     or jsonb_typeof(coalesce(p_expected_group_versions, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_expected_task_states, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'action', p_action,
    'groupId', p_group_id,
    'taskIds', to_jsonb(v_task_ids),
    'title', p_title,
    'expectedGroupVersions', coalesce(p_expected_group_versions, '[]'::jsonb),
    'expectedTaskStates', coalesce(p_expected_task_states, '[]'::jsonb)
  );
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_existing
  from public.task_card_group_operations o
  where o.user_id = v_user_id and o.operation_id = p_operation_id
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

  if p_action = 'create' then
    if p_group_id is not null then raise exception 'invalid_input' using errcode = '22023'; end if;
    v_group_id := gen_random_uuid();
    v_target_group_id := v_group_id;
  elsif p_action in ('add', 'remove', 'rename', 'dissolve') and p_group_id is null then
    raise exception 'group_not_found' using errcode = 'P0001';
  else
    v_target_group_id := p_group_id;
  end if;

  if p_action = 'create' then
    select coalesce(array_agg(distinct t.task_group_id) filter (where t.task_group_id is not null), '{}'::uuid[])
      into v_group_ids from public.tasks t
      where t.id = any(v_task_ids) and t.user_id = v_user_id;
    v_group_ids := v_group_ids || array[v_group_id];
    select array_agg(distinct id order by id) into v_group_ids
    from unnest(v_group_ids) as ids(id);
    select array_agg(distinct affected.id order by affected.id) into v_affected_task_ids
    from (
      select unnest(v_task_ids) as id
      union all
      select t.id from public.tasks t
      where t.user_id = v_user_id and t.task_group_id = any(v_group_ids)
    ) affected;
  else
    perform 1 from public.task_groups g where g.id = v_group_id and g.user_id = v_user_id for update;
    if not found then raise exception 'group_not_found' using errcode = 'P0001'; end if;
    if p_action = 'add' then
      select array_agg(distinct t.task_group_id) filter (where t.task_group_id is not null)
        into v_group_ids from public.tasks t
        where t.id = any(v_task_ids) and t.user_id = v_user_id and t.task_group_id <> v_group_id;
      v_group_ids := coalesce(v_group_ids, '{}'::uuid[]) || array[v_group_id];
      select array_agg(distinct id order by id) into v_group_ids
      from unnest(v_group_ids) as ids(id);
      select array_agg(distinct affected.id order by affected.id) into v_affected_task_ids
      from (
        select unnest(v_task_ids) as id
        union all
        select t.id from public.tasks t
        where t.user_id = v_user_id and t.task_group_id = any(v_group_ids)
      ) affected;
      if exists (select 1 from public.tasks t where t.id = any(v_task_ids) and t.task_group_id = v_group_id) then
        raise exception 'task_already_in_group' using errcode = 'P0001';
      end if;
    elsif p_action in ('remove', 'dissolve') then
      v_group_ids := array[v_group_id];
      select coalesce(array_agg(t.id order by t.id), '{}'::uuid[]) into v_affected_task_ids
      from public.tasks t where t.task_group_id = v_group_id and t.user_id = v_user_id;
      if p_action = 'remove' and exists (
        select 1 from unnest(v_task_ids) as requested(id)
        where not (requested.id = any(v_affected_task_ids))
      ) then raise exception 'group_membership_conflict' using errcode = 'P0001'; end if;
      if p_action = 'dissolve' then v_task_ids := v_affected_task_ids; end if;
    elsif p_action = 'rename' then
      v_group_ids := array[v_group_id];
      v_affected_task_ids := '{}'::uuid[];
    end if;
  end if;

  if cardinality(v_affected_task_ids) > 500 then
    raise exception 'group_operation_too_large' using errcode = '22023';
  end if;
  if p_action = 'add' and (
    (select count(*) from public.tasks t where t.user_id = v_user_id and t.task_group_id = p_group_id)
      + cardinality(v_task_ids) > 100
  ) then
    raise exception 'group_size_limit' using errcode = '22023';
  end if;

  perform 1 from public.task_groups g where g.id = any(v_group_ids) and g.user_id = v_user_id
  order by g.id for update;

  select count(*) into v_expected_group_count
  from jsonb_array_elements(coalesce(p_expected_group_versions, '[]'::jsonb));
  select count(*) into v_existing_group_count from public.task_groups g
  where g.id = any(v_group_ids) and g.user_id = v_user_id
    and not (p_action = 'create' and g.id = v_group_id);
  if v_expected_group_count <> v_existing_group_count or exists (
    select 1 from public.task_groups g
    where g.id = any(v_group_ids) and g.user_id = v_user_id
      and not (p_action = 'create' and g.id = v_group_id)
      and not exists (select 1 from jsonb_array_elements(coalesce(p_expected_group_versions, '[]'::jsonb)) as expected(value)
        where (expected.value ->> 'groupId')::uuid = g.id
          and (expected.value ->> 'version')::integer = g.version)
  ) then raise exception 'group_version_conflict' using errcode = '40001'; end if;

  perform 1 from public.tasks t where t.id = any(v_affected_task_ids) and t.user_id = v_user_id
    order by t.id for update;
  select count(*) into v_expected_task_count
  from jsonb_array_elements(coalesce(p_expected_task_states, '[]'::jsonb));
  select count(*) into v_actual_task_count from public.tasks t
  where t.id = any(v_affected_task_ids) and t.user_id = v_user_id
    and t.data_origin in ('USER', 'IMPORT')
    and (p_action not in ('create', 'add') or t.id <> all(v_task_ids) or
      (t.archived_at is null and t.deleted_at is null and t.status <> 'archived'));
  if v_expected_task_count <> cardinality(v_affected_task_ids)
     or v_actual_task_count <> cardinality(v_affected_task_ids)
     or exists (
       select 1 from public.tasks t where t.id = any(v_affected_task_ids) and t.user_id = v_user_id
         and not exists (select 1 from jsonb_array_elements(coalesce(p_expected_task_states, '[]'::jsonb)) as expected(value)
           where (expected.value ->> 'id')::uuid = t.id
             and (expected.value ->> 'updatedAt')::timestamptz = t.updated_at
             and nullif(expected.value ->> 'groupId', '')::uuid is not distinct from t.task_group_id)
     ) then raise exception 'task_version_conflict' using errcode = '40001'; end if;
  v_before := jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(to_jsonb(g)) from public.task_groups g
      where g.id = any(v_group_ids) and g.user_id = v_user_id
    ), '[]'::jsonb),
    'groupMembershipCounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', membership.group_id,
        'count', (select count(*) from public.tasks t
          where t.user_id = v_user_id and t.task_group_id = membership.group_id)
      ) order by membership.group_id)
      from unnest(v_group_ids) as membership(group_id)
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'task_group_id', t.task_group_id,
        'task_group_position', t.task_group_position, 'updated_at', t.updated_at
      ) order by t.id)
      from public.tasks t where t.id = any(v_affected_task_ids) and t.user_id = v_user_id
    ), '[]'::jsonb)
  );

  if p_action = 'create' then
    insert into public.task_groups(id, user_id, title, position)
    values (v_group_id, v_user_id, btrim(p_title), coalesce((
      select max(g.position) + 1 from public.task_groups g where g.user_id = v_user_id
    ), 0));
    v_next_position := 0;
  elsif p_action = 'add' then
    select coalesce(max(t.task_group_position) + 1, 0) into v_next_position
    from public.tasks t where t.task_group_id = v_group_id and t.user_id = v_user_id;
  end if;

  if p_action in ('create', 'add') then
    update public.tasks set task_group_id = null, task_group_position = 0
    where id = any(v_task_ids) and task_group_id = any(v_group_ids) and user_id = v_user_id;
    for v_entry in select value from jsonb_array_elements(v_before -> 'groups') loop
      v_group_id := (v_entry ->> 'id')::uuid;
      if p_action = 'add' and v_group_id = p_group_id then continue; end if;
      if (select count(*) from public.tasks t where t.task_group_id = v_group_id and t.user_id = v_user_id) <= 1 then
        update public.tasks set task_group_id = null, task_group_position = 0
        where task_group_id = v_group_id and user_id = v_user_id;
        delete from public.task_groups where id = v_group_id and user_id = v_user_id;
      else
        update public.task_groups set version = version + 1 where id = v_group_id and user_id = v_user_id;
      end if;
    end loop;
    v_group_id := v_target_group_id;
    if p_action = 'add' then
      select coalesce(max(t.task_group_position) + 1, 0) into v_next_position
      from public.tasks t where t.task_group_id = v_group_id and t.user_id = v_user_id;
    end if;
    foreach v_task_id in array v_task_ids loop
      update public.tasks
      set task_group_id = v_group_id, task_group_position = v_next_position
      where id = v_task_id and user_id = v_user_id;
      v_next_position := v_next_position + 1;
    end loop;
    update public.task_groups set version = version + 1
    where id = v_group_id and user_id = v_user_id;
  elsif p_action = 'remove' then
    update public.tasks set task_group_id = null, task_group_position = 0
      where id = any(v_task_ids) and user_id = v_user_id;
    if (select count(*) from public.tasks t where t.task_group_id = v_group_id and t.user_id = v_user_id) <= 1 then
      update public.tasks set task_group_id = null, task_group_position = 0
      where task_group_id = v_group_id and user_id = v_user_id;
      delete from public.task_groups where id = v_group_id and user_id = v_user_id;
    else
      update public.task_groups set version = version + 1
      where id = v_group_id and user_id = v_user_id;
    end if;
  elsif p_action = 'dissolve' then
    update public.tasks set task_group_id = null, task_group_position = 0
    where task_group_id = v_group_id and user_id = v_user_id;
    delete from public.task_groups where id = v_group_id and user_id = v_user_id;
  elsif p_action = 'rename' then
    update public.task_groups set title = btrim(p_title), version = version + 1
    where id = v_group_id and user_id = v_user_id;
  end if;

  v_after := jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(to_jsonb(g)) from public.task_groups g
      where g.id = any(v_group_ids) and g.user_id = v_user_id
    ), '[]'::jsonb),
    'groupMembershipCounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', membership.group_id,
        'count', (select count(*) from public.tasks t
          where t.user_id = v_user_id and t.task_group_id = membership.group_id)
      ) order by membership.group_id)
      from unnest(v_group_ids) as membership(group_id)
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'task_group_id', t.task_group_id,
        'task_group_position', t.task_group_position, 'updated_at', t.updated_at
      ) order by t.id)
      from public.tasks t where t.id = any(v_affected_task_ids) and t.user_id = v_user_id
    ), '[]'::jsonb)
  );
  v_response := jsonb_build_object(
    'operationId', p_operation_id, 'action', p_action,
    'groupId', coalesce(p_group_id, v_group_id), 'canUndo', true
  );

  insert into public.task_card_group_operations(
    user_id, operation_id, request, group_id, group_ids, action, before_state, after_state, response
  ) values (
    v_user_id, p_operation_id, v_request, coalesce(p_group_id, v_group_id), v_group_ids,
    p_action, v_before, v_after, v_response
  );
  return v_response;
end
$$;

create or replace function public.undo_task_card_group_atomic(p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation public.task_card_group_operations;
  v_entry jsonb;
  v_group_id uuid;
  v_version integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_operation_id is null then raise exception 'invalid_input' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select * into v_operation from public.task_card_group_operations o
  where o.user_id = v_user_id and o.operation_id = p_operation_id for update;
  if not found then raise exception 'operation_not_found' using errcode = 'P0001'; end if;
  if v_operation.undone_at is not null then
    return jsonb_build_object('operationId', p_operation_id, 'undone', true, 'canUndo', false);
  end if;

  -- Serialize with other planner actions and lock the full task snapshot before checking it.
  perform 1 from public.tasks t
  where t.user_id = v_user_id
    and (
      t.id in (select (entry.value ->> 'id')::uuid
        from jsonb_array_elements(v_operation.after_state -> 'tasks') entry)
      or t.task_group_id = any(v_operation.group_ids)
    )
  order by t.id for update;
  perform 1 from public.task_groups g where g.id = any(v_operation.group_ids) and g.user_id = v_user_id
  order by g.id for update;

  for v_entry in select value from jsonb_array_elements(v_operation.after_state -> 'tasks') loop
    if not exists (
      select 1 from public.tasks t
      where t.id = (v_entry ->> 'id')::uuid and t.user_id = v_user_id
        and t.task_group_id is not distinct from nullif(v_entry ->> 'task_group_id', '')::uuid
        and t.task_group_position = (v_entry ->> 'task_group_position')::integer
        and t.updated_at = (v_entry ->> 'updated_at')::timestamptz
    ) then raise exception 'undo_conflict' using errcode = '40001'; end if;
  end loop;

  for v_entry in select value from jsonb_array_elements(v_operation.after_state -> 'groupMembershipCounts') loop
    if (select count(*) from public.tasks t
        where t.user_id = v_user_id and t.task_group_id = (v_entry ->> 'id')::uuid)
       <> (v_entry ->> 'count')::integer then
      raise exception 'undo_conflict' using errcode = '40001';
    end if;
  end loop;

  for v_group_id in select unnest(v_operation.group_ids) loop
    select entry.value into v_entry
    from jsonb_array_elements(v_operation.after_state -> 'groups') entry
    where (entry.value ->> 'id')::uuid = v_group_id;
    if v_entry is null then
      if exists (select 1 from public.task_groups g where g.id = v_group_id and g.user_id = v_user_id) then
        raise exception 'undo_conflict' using errcode = '40001';
      end if;
    elsif not exists (
      select 1 from public.task_groups g
      where g.id = v_group_id and g.user_id = v_user_id
        and g.version = (v_entry ->> 'version')::integer
        and g.title = v_entry ->> 'title'
        and g.position = (v_entry ->> 'position')::integer
        and g.updated_at = (v_entry ->> 'updated_at')::timestamptz
    ) then
      raise exception 'undo_conflict' using errcode = '40001';
    end if;
  end loop;

  -- Recreate any source group dissolved by the operation before restoring membership.
  for v_entry in select value from jsonb_array_elements(v_operation.before_state -> 'groups') loop
    v_group_id := (v_entry ->> 'id')::uuid;
    select g.version into v_version from public.task_groups g
    where g.id = v_group_id and g.user_id = v_user_id for update;
    if found then
      update public.task_groups
      set title = v_entry ->> 'title',
          position = (v_entry ->> 'position')::integer,
          version = v_version + 1
      where id = v_group_id and user_id = v_user_id;
    else
      insert into public.task_groups(id, user_id, title, position, version)
      values (
        v_group_id, v_user_id, v_entry ->> 'title',
        (v_entry ->> 'position')::integer,
        (v_entry ->> 'version')::integer + 1
      );
    end if;
  end loop;

  for v_entry in select value from jsonb_array_elements(v_operation.before_state -> 'tasks') loop
    update public.tasks
    set task_group_id = nullif(v_entry ->> 'task_group_id', '')::uuid,
        task_group_position = (v_entry ->> 'task_group_position')::integer
    where id = (v_entry ->> 'id')::uuid and user_id = v_user_id;
  end loop;

  -- New groups created by the operation have no before row; membership is now restored,
  -- so deleting them cannot clear an untracked task.
  for v_group_id in select unnest(v_operation.group_ids) loop
    if not exists (
      select 1 from jsonb_array_elements(v_operation.before_state -> 'groups') old_group
      where (old_group.value ->> 'id')::uuid = v_group_id
    ) then
      delete from public.task_groups where id = v_group_id and user_id = v_user_id;
    end if;
  end loop;

  update public.task_card_group_operations set undone_at = now()
  where user_id = v_user_id and operation_id = p_operation_id;
  return jsonb_build_object('operationId', p_operation_id, 'undone', true, 'canUndo', false);
end
$$;

revoke all on function public.mutate_task_card_group_atomic(uuid, text, uuid, uuid[], text, jsonb, jsonb)
  from public, anon, authenticated;
alter function public.mutate_task_card_group_atomic(uuid, text, uuid, uuid[], text, jsonb, jsonb)
  owner to postgres;
grant execute on function public.mutate_task_card_group_atomic(uuid, text, uuid, uuid[], text, jsonb, jsonb)
  to authenticated;
revoke all on function public.undo_task_card_group_atomic(uuid) from public, anon, authenticated;
alter function public.undo_task_card_group_atomic(uuid) owner to postgres;
grant execute on function public.undo_task_card_group_atomic(uuid) to authenticated;

-- Stable photo cover order. Existing rows receive a deterministic legacy order.
alter table public.task_photos add column sort_order integer not null default 0;
with ordered as (
  select id, row_number() over (partition by task_id order by created_at, id) - 1 as sort_order
  from public.task_photos
)
update public.task_photos p set sort_order = ordered.sort_order
from ordered where ordered.id = p.id;
create unique index task_photos_task_sort_order_idx on public.task_photos(task_id, sort_order);

-- Reserve a stable cover position and Storage path before bytes are uploaded. A retry with
-- the same operation ID reuses both; reservations count toward the five-photo limit.
create table public.task_photo_reservations (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  operation_id uuid not null,
  path text not null check (char_length(path) between 1 and 300),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  sort_order integer not null check (sort_order >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'failed', 'attached', 'cancelled')),
  failure_code text check (failure_code is null or failure_code in ('upload_failed', 'upload_unknown')),
  photo_id uuid references public.task_photos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id, operation_id)
);
create unique index task_photo_reservations_pending_order_idx
  on public.task_photo_reservations(task_id, sort_order) where status in ('reserved', 'failed');
create trigger set_task_photo_reservations_updated_at before update on public.task_photo_reservations
  for each row execute function public.set_updated_at();
alter table public.task_photo_reservations enable row level security;
create policy "task_photo_reservations: select own" on public.task_photo_reservations
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.task_photo_reservations from public, anon, authenticated;
grant select on public.task_photo_reservations to authenticated;

create or replace function public.reserve_task_card_photo_atomic(
  p_task_id uuid,
  p_operation_id uuid,
  p_mime_type text,
  p_content_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.task_photo_reservations;
  v_extension text;
  v_sort_order integer;
  v_count integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_task_id is null or p_operation_id is null or p_mime_type is null or p_content_sha256 is null
     or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
     or p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  perform 1 from public.tasks t where t.id = p_task_id and t.user_id = v_user_id
    and t.archived_at is null and t.deleted_at is null and t.status <> 'archived' for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0001'; end if;
  select * into v_reservation from public.task_photo_reservations r
  where r.user_id = v_user_id and r.task_id = p_task_id and r.operation_id = p_operation_id
  for update;
  if found then
    if v_reservation.mime_type <> p_mime_type
       or v_reservation.content_sha256 <> p_content_sha256 then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    if v_reservation.status = 'cancelled' then
      raise exception 'photo_reservation_cancelled' using errcode = 'P0001';
    end if;
    if v_reservation.status = 'failed' then
      update public.task_photo_reservations
      set status = 'reserved', failure_code = null
      where user_id = v_user_id and task_id = p_task_id and operation_id = p_operation_id
      returning * into v_reservation;
    end if;
    return to_jsonb(v_reservation);
  end if;
  select count(*) into v_count from public.task_photos p where p.task_id = p_task_id;
  select v_count + count(*) into v_count from public.task_photo_reservations r
  where r.task_id = p_task_id and r.status in ('reserved', 'failed');
  if v_count >= 5 then raise exception 'photo_limit' using errcode = 'P0001'; end if;
  select coalesce(max(slot), -1) + 1 into v_sort_order from (
    select p.sort_order as slot from public.task_photos p where p.task_id = p_task_id
    union all
    select r.sort_order as slot from public.task_photo_reservations r
      where r.task_id = p_task_id and r.status in ('reserved', 'failed')
  ) slots;
  v_extension := case p_mime_type when 'image/png' then 'png' when 'image/webp' then 'webp' else 'jpg' end;
  insert into public.task_photo_reservations(
    user_id, task_id, operation_id, path, mime_type, content_sha256, sort_order
  ) values (
    v_user_id, p_task_id, p_operation_id,
    v_user_id::text || '/' || p_task_id::text || '/' || p_operation_id::text || '.' || v_extension,
    p_mime_type, p_content_sha256, v_sort_order
  ) returning * into v_reservation;
  return to_jsonb(v_reservation);
end
$$;

create or replace function public.attach_task_card_photo_reservation_atomic(
  p_task_id uuid,
  p_operation_id uuid,
  p_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.task_photo_reservations;
  v_photo_id uuid;
  v_mime_type text;
  v_size_text text;
  v_size bigint;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_task_id is null or p_operation_id is null or p_path is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  perform 1 from public.tasks t where t.id = p_task_id and t.user_id = v_user_id
    and t.archived_at is null and t.deleted_at is null and t.status <> 'archived' for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0001'; end if;
  select * into v_reservation from public.task_photo_reservations r
  where r.user_id = v_user_id and r.task_id = p_task_id and r.operation_id = p_operation_id
  for update;
  if not found or v_reservation.path <> p_path then
    raise exception 'photo_reservation_not_found' using errcode = 'P0001';
  end if;
  if v_reservation.status = 'cancelled' then
    raise exception 'photo_reservation_cancelled' using errcode = 'P0001';
  end if;
  if v_reservation.status = 'attached' then
    if v_reservation.photo_id is null then raise exception 'photo_not_found' using errcode = 'P0001'; end if;
    return v_reservation.photo_id;
  end if;
  select o.metadata ->> 'mimetype', o.metadata ->> 'size'
    into v_mime_type, v_size_text from storage.objects o
  where o.bucket_id = 'photos' and o.name = p_path;
  if not found then raise exception 'photo_object_missing' using errcode = 'P0001'; end if;
  if v_size_text is null or v_size_text !~ '^[0-9]+$' then
    raise exception 'photo_invalid' using errcode = 'P0001';
  end if;
  v_size := v_size_text::bigint;
  if v_size < 1 or v_size > 10485760 or v_mime_type is null
     or v_mime_type <> v_reservation.mime_type
     or (p_path ~ '[.]jpg$' and v_mime_type <> 'image/jpeg')
     or (p_path ~ '[.]png$' and v_mime_type <> 'image/png')
     or (p_path ~ '[.]webp$' and v_mime_type <> 'image/webp') then
    raise exception 'photo_invalid' using errcode = 'P0001';
  end if;
  insert into public.task_photos(task_id, user_id, path, sort_order)
  values (p_task_id, v_user_id, p_path, v_reservation.sort_order)
  on conflict (task_id, sort_order) do nothing
  returning id into v_photo_id;
  if v_photo_id is null then
    select p.id into v_photo_id from public.task_photos p
    where p.task_id = p_task_id and p.user_id = v_user_id and p.path = p_path;
  end if;
  if v_photo_id is null then raise exception 'photo_order_conflict' using errcode = 'P0001'; end if;
  update public.task_photo_reservations set status = 'attached', photo_id = v_photo_id
  where user_id = v_user_id and task_id = p_task_id and operation_id = p_operation_id;
  return v_photo_id;
end
$$;

create or replace function public.attach_task_photo_atomic(p_task_id uuid, p_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_photo_id uuid;
  v_mime_type text;
  v_size_text text;
  v_size bigint;
  v_photo_count bigint;
  v_reserved_count bigint;
  v_reserved_next integer;
  v_sort_order integer;
  v_reservation_operation_id uuid;
  v_reservation_status text;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_task_id is null or p_path is null or char_length(p_path) > 300 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if p_path !~ ('^' || v_user_id::text || '/' || p_task_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  -- Keep the lock order aligned with reservation mutations (advisory lock, then task row).
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  perform 1 from public.tasks t where t.id = p_task_id and t.user_id = v_user_id
    and t.archived_at is null and t.deleted_at is null and t.status <> 'archived' for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0001'; end if;
  select r.operation_id, r.status into v_reservation_operation_id, v_reservation_status
  from public.task_photo_reservations r
  where r.user_id = v_user_id and r.task_id = p_task_id and r.path = p_path;
  if found then
    if v_reservation_status = 'cancelled' then
      raise exception 'photo_reservation_cancelled' using errcode = 'P0001';
    end if;
    return public.attach_task_card_photo_reservation_atomic(
      p_task_id, v_reservation_operation_id, p_path
    );
  end if;
  select o.metadata ->> 'mimetype', o.metadata ->> 'size'
    into v_mime_type, v_size_text from storage.objects o
   where o.bucket_id = 'photos' and o.name = p_path;
  if not found then raise exception 'photo_object_missing' using errcode = 'P0001'; end if;
  if v_size_text is null or v_size_text !~ '^[0-9]+$' then
    raise exception 'photo_invalid' using errcode = 'P0001';
  end if;
  v_size := v_size_text::bigint;
  if v_size < 1 or v_size > 10485760 or v_mime_type is null
     or v_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
     or (p_path ~ '[.]jpg$' and v_mime_type <> 'image/jpeg')
     or (p_path ~ '[.]png$' and v_mime_type <> 'image/png')
     or (p_path ~ '[.]webp$' and v_mime_type <> 'image/webp') then
    raise exception 'photo_invalid' using errcode = 'P0001';
  end if;
  select tp.id into v_photo_id from public.task_photos tp
  where tp.task_id = p_task_id and tp.user_id = v_user_id and tp.path = p_path;
  if found then return v_photo_id; end if;
  select count(*), coalesce(max(tp.sort_order), -1) + 1
    into v_photo_count, v_sort_order from public.task_photos tp where tp.task_id = p_task_id;
  select count(*), coalesce(max(r.sort_order) + 1, v_sort_order)
    into v_reserved_count, v_reserved_next
  from public.task_photo_reservations r
  where r.task_id = p_task_id and r.status in ('reserved', 'failed');
  if v_photo_count + v_reserved_count >= 5 then
    raise exception 'photo_limit' using errcode = 'P0001';
  end if;
  v_sort_order := greatest(v_sort_order, v_reserved_next);
  insert into public.task_photos(task_id, user_id, path, sort_order)
  values (p_task_id, v_user_id, p_path, v_sort_order) returning id into v_photo_id;
  return v_photo_id;
end;
$function$;

create or replace function public.set_task_photo_order_atomic(p_task_id uuid, p_photo_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_distinct_count integer;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_task_id is null or cardinality(coalesce(p_photo_ids, '{}'::uuid[])) > 5 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  perform 1 from public.tasks t where t.id = p_task_id and t.user_id = v_user_id
    and t.archived_at is null and t.deleted_at is null for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0001'; end if;
  if exists (select 1 from public.task_photo_reservations r
    where r.task_id = p_task_id and r.user_id = v_user_id and r.status in ('reserved', 'failed')) then
    raise exception 'photo_upload_pending' using errcode = '40001';
  end if;
  select count(*), count(distinct id) into v_count, v_distinct_count
  from public.task_photos where task_id = p_task_id and user_id = v_user_id;
  select count(distinct requested.id) into v_distinct_count
  from unnest(coalesce(p_photo_ids, '{}'::uuid[])) as requested(id);
  if cardinality(coalesce(p_photo_ids, '{}'::uuid[])) <> v_count
     or v_distinct_count <> cardinality(coalesce(p_photo_ids, '{}'::uuid[]))
     or exists (select 1 from unnest(coalesce(p_photo_ids, '{}'::uuid[])) as requested(id)
       where not exists (select 1 from public.task_photos p
         where p.id = requested.id and p.task_id = p_task_id and p.user_id = v_user_id)) then
    raise exception 'photo_order_conflict' using errcode = 'P0001';
  end if;
  update public.task_photos p set sort_order = -(p.sort_order + 1)
  where p.task_id = p_task_id and p.user_id = v_user_id;
  update public.task_photos p set sort_order = requested.ordinality - 1
  from unnest(coalesce(p_photo_ids, '{}'::uuid[])) with ordinality requested(id, ordinality)
  where p.id = requested.id and p.task_id = p_task_id and p.user_id = v_user_id;
  return true;
end
$$;

revoke all on function public.attach_task_photo_atomic(uuid, text) from public, anon;
alter function public.attach_task_photo_atomic(uuid, text) owner to postgres;
grant execute on function public.attach_task_photo_atomic(uuid, text) to authenticated;
revoke all on function public.reserve_task_card_photo_atomic(uuid, uuid, text, text) from public, anon, authenticated;
alter function public.reserve_task_card_photo_atomic(uuid, uuid, text, text) owner to postgres;
grant execute on function public.reserve_task_card_photo_atomic(uuid, uuid, text, text) to authenticated;
revoke all on function public.attach_task_card_photo_reservation_atomic(uuid, uuid, text) from public, anon, authenticated;
alter function public.attach_task_card_photo_reservation_atomic(uuid, uuid, text) owner to postgres;
grant execute on function public.attach_task_card_photo_reservation_atomic(uuid, uuid, text) to authenticated;
create or replace function public.cancel_task_card_photo_reservation_atomic(
  p_task_id uuid,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.task_photo_reservations;
  v_photo_id uuid;
  v_task_active boolean;
  v_mime_type text;
  v_size_text text;
  v_size bigint;
  v_object_valid boolean := false;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_task_id is null or p_operation_id is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select t.archived_at is null and t.deleted_at is null and t.status <> 'archived'
  into v_task_active from public.tasks t where t.id = p_task_id and t.user_id = v_user_id for update;
  if not found then raise exception 'task_not_found' using errcode = 'P0001'; end if;
  select * into v_reservation from public.task_photo_reservations r
  where r.user_id = v_user_id and r.task_id = p_task_id and r.operation_id = p_operation_id
  for update;
  if not found then raise exception 'photo_reservation_not_found' using errcode = 'P0001'; end if;
  if v_reservation.status = 'attached' then
    return jsonb_build_object('operationId', p_operation_id, 'status', 'attached', 'photoId', v_reservation.photo_id);
  end if;
  if v_reservation.status = 'cancelled' then
    return jsonb_build_object('operationId', p_operation_id, 'status', 'cancelled', 'photoId', null);
  end if;

  -- Resolve an upload whose response was lost before releasing its cover position.
  -- Invalid objects are left as unreferenced private bytes and the reservation is
  -- tombstoned; this lets the user recover the slot without deleting Storage data.
  if v_task_active then
    select o.metadata ->> 'mimetype', o.metadata ->> 'size'
      into v_mime_type, v_size_text from storage.objects o
    where o.bucket_id = 'photos' and o.name = v_reservation.path;
    if found and v_mime_type is not null and v_size_text is not null
       and v_size_text ~ '^[0-9]+$' and length(v_size_text) <= 10 then
      v_size := v_size_text::bigint;
      v_object_valid := v_size between 1 and 10485760
        and v_mime_type = v_reservation.mime_type
        and ((v_reservation.path ~ '[.]jpg$' and v_mime_type = 'image/jpeg')
          or (v_reservation.path ~ '[.]png$' and v_mime_type = 'image/png')
          or (v_reservation.path ~ '[.]webp$' and v_mime_type = 'image/webp'));
    end if;
  end if;
  if v_object_valid then
    v_photo_id := public.attach_task_card_photo_reservation_atomic(
      p_task_id, p_operation_id, v_reservation.path
    );
    return jsonb_build_object('operationId', p_operation_id, 'status', 'attached', 'photoId', v_photo_id);
  end if;

  update public.task_photo_reservations
  set status = 'cancelled', failure_code = null
  where user_id = v_user_id and task_id = p_task_id and operation_id = p_operation_id;
  return jsonb_build_object('operationId', p_operation_id, 'status', 'cancelled', 'photoId', null);
end
$$;
revoke all on function public.cancel_task_card_photo_reservation_atomic(uuid, uuid)
  from public, anon, authenticated;
alter function public.cancel_task_card_photo_reservation_atomic(uuid, uuid) owner to postgres;
grant execute on function public.cancel_task_card_photo_reservation_atomic(uuid, uuid) to authenticated;

create or replace function public.mark_task_card_photo_failure_atomic(
  p_task_id uuid,
  p_operation_id uuid,
  p_failure_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_task_id is null or p_operation_id is null or p_failure_code is null
     or p_failure_code not in ('upload_failed', 'upload_unknown') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  update public.task_photo_reservations
  set status = 'failed', failure_code = p_failure_code
  where user_id = v_user_id and task_id = p_task_id and operation_id = p_operation_id
    and status = 'reserved';
  return found;
end
$$;
revoke all on function public.mark_task_card_photo_failure_atomic(uuid, uuid, text)
  from public, anon, authenticated;
alter function public.mark_task_card_photo_failure_atomic(uuid, uuid, text) owner to postgres;
grant execute on function public.mark_task_card_photo_failure_atomic(uuid, uuid, text) to authenticated;
revoke all on function public.set_task_photo_order_atomic(uuid, uuid[]) from public, anon, authenticated;
alter function public.set_task_photo_order_atomic(uuid, uuid[]) owner to postgres;
grant execute on function public.set_task_photo_order_atomic(uuid, uuid[]) to authenticated;
