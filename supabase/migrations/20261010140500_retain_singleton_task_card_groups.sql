-- Preserve one-member task groups after transfer/removal. Only an empty group
-- is automatically dissolved; explicit dissolve remains available separately.
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
      if (select count(*) from public.tasks t where t.task_group_id = v_group_id and t.user_id = v_user_id) = 0 then
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
    if (select count(*) from public.tasks t where t.task_group_id = v_group_id and t.user_id = v_user_id) = 0 then
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

revoke all on function public.mutate_task_card_group_atomic(uuid, text, uuid, uuid[], text, jsonb, jsonb)
  from public, anon, authenticated;
alter function public.mutate_task_card_group_atomic(uuid, text, uuid, uuid[], text, jsonb, jsonb)
  owner to postgres;
grant execute on function public.mutate_task_card_group_atomic(uuid, text, uuid, uuid[], text, jsonb, jsonb)
  to authenticated;
