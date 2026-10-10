-- Return one applied Rescue operation for the selected day only when its
-- after-state and original placements remain safe to restore.
create or replace function public.latest_undoable_rescue_operation(p_target_date date)
returns table(operation_id uuid, target_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  select operation.id, operation.target_date
  from public.rescue_operations operation
  where operation.user_id = v_user_id
    and operation.target_date = p_target_date
    and operation.status = 'applied'
    and jsonb_typeof(operation.after_state -> 'tasks') = 'array'
    and jsonb_typeof(operation.after_state -> 'time_blocks') = 'array'
    and jsonb_typeof(operation.before_state -> 'tasks') = 'array'
    and jsonb_typeof(operation.before_state -> 'time_blocks') = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(operation.after_state -> 'tasks') expected(value)
      where not exists (
        select 1
        from public.tasks task
        where task.id = (expected.value ->> 'id')::uuid
          and task.user_id = v_user_id
          and task.data_origin in ('USER', 'IMPORT')
          and task.archived_at is null
          and task.deleted_at is null
          and task.status in ('inbox', 'planned')
          and task.updated_at = (expected.value ->> 'updated_at')::timestamptz
      )
    )
    and not exists (
      select 1
      from jsonb_array_elements(operation.after_state -> 'time_blocks') expected(value)
      where not exists (
        select 1
        from public.time_blocks block
        where block.id = (expected.value ->> 'id')::uuid
          and block.user_id = v_user_id
          and block.data_origin in ('USER', 'IMPORT')
          and block.status = 'active'
          and block.status = expected.value ->> 'status'
          and block.version = (expected.value ->> 'version')::integer
          and block.is_locked = (expected.value ->> 'is_locked')::boolean
          and block.start_at = (expected.value ->> 'start_at')::timestamptz
          and block.end_at = (expected.value ->> 'end_at')::timestamptz
      )
    )
    and not exists (
      select 1
      from jsonb_array_elements(operation.before_state -> 'time_blocks') restoring(value)
      where exists (
        select 1
        from public.time_blocks other
        where other.user_id = v_user_id
          and other.status = 'active'
          and other.data_origin in ('USER', 'IMPORT')
          and not exists (
            select 1
            from jsonb_array_elements(operation.after_state -> 'time_blocks') owned(value)
            where (owned.value ->> 'id')::uuid = other.id
          )
          and other.start_at < (restoring.value ->> 'end_at')::timestamptz
          and other.end_at > (restoring.value ->> 'start_at')::timestamptz
      )
    )
    and not exists (
      select 1
      from jsonb_array_elements(operation.before_state -> 'time_blocks') restoring(value)
      join public.calendar_events event
        on event.user_id = v_user_id
       and event.data_origin in ('USER', 'IMPORT')
       and event.blocks_time
       and (
         (
           event.all_day
           and (event.event_date::timestamp at time zone 'Asia/Bangkok')
             < (restoring.value ->> 'end_at')::timestamptz
           and ((event.event_date + 1)::timestamp at time zone 'Asia/Bangkok')
             > (restoring.value ->> 'start_at')::timestamptz
         )
         or (
           not event.all_day
           and ((event.event_date + event.start_time) at time zone 'Asia/Bangkok')
             < (restoring.value ->> 'end_at')::timestamptz
           and ((event.event_date + event.end_time) at time zone 'Asia/Bangkok')
             > (restoring.value ->> 'start_at')::timestamptz
         )
       )
    )
    and not exists (
      select 1
      from jsonb_array_elements(operation.before_state -> 'time_blocks')
        with ordinality left_block(value, ordinal)
      join jsonb_array_elements(operation.before_state -> 'time_blocks')
        with ordinality right_block(value, ordinal)
        on right_block.ordinal > left_block.ordinal
       and (left_block.value ->> 'start_at')::timestamptz
         < (right_block.value ->> 'end_at')::timestamptz
       and (left_block.value ->> 'end_at')::timestamptz
         > (right_block.value ->> 'start_at')::timestamptz
    )
  order by operation.created_at desc, operation.id desc
  limit 1;
end
$$;

revoke all on function public.latest_undoable_rescue_operation(date) from public, anon;
alter function public.latest_undoable_rescue_operation(date) owner to postgres;
grant execute on function public.latest_undoable_rescue_operation(date) to authenticated;
