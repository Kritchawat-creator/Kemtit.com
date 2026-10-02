-- Link internal time blocks to a concrete recurring occurrence when one is selected.
-- The owner trigger from 20260920103000 also verifies task_id matches occurrence.task_id.

drop function if exists public.create_time_block_atomic(text, timestamptz, timestamptz, uuid, text);

create function public.create_time_block_atomic(
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
