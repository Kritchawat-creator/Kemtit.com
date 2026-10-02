-- Kemtit V2 occurrence runtime transition.
-- Recurring series remain on tasks; one-off state lives in task_occurrences.
-- Legacy task_completions rows are intentionally retained for read fallback/history.

create or replace function public.reschedule_task_occurrence_atomic(
  p_task_id uuid,
  p_occurrence_date date,
  p_new_occurrence_date date
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

  if not exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.user_id = v_user_id
      and t.recurrence_rule is not null
      and t.archived_at is null
  ) then
    raise exception 'recurring task not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if p_occurrence_date = p_new_occurrence_date then
    insert into public.task_occurrences (task_id, user_id, occurrence_date, status)
    values (p_task_id, v_user_id, p_occurrence_date, 'planned')
    on conflict (task_id, occurrence_date) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id
      from public.task_occurrences
      where task_id = p_task_id and occurrence_date = p_occurrence_date;
    end if;
    return v_id;
  end if;

  if exists (
    select 1
    from public.task_occurrences
    where task_id = p_task_id
      and occurrence_date = p_new_occurrence_date
      and status <> 'archived'
  ) then
    return null;
  end if;

  insert into public.task_occurrences (
    task_id,
    user_id,
    occurrence_date,
    status,
    completed_at,
    skipped_at
  )
  values (p_task_id, v_user_id, p_occurrence_date, 'archived', null, null)
  on conflict (task_id, occurrence_date) do update
    set status = 'archived', completed_at = null, skipped_at = null;

  insert into public.task_occurrences (task_id, user_id, occurrence_date, status)
  values (p_task_id, v_user_id, p_new_occurrence_date, 'planned')
  on conflict (task_id, occurrence_date) do update
    set status = 'planned', completed_at = null, skipped_at = null
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.reschedule_task_occurrence_atomic(uuid, date, date) from public;
revoke all on function public.reschedule_task_occurrence_atomic(uuid, date, date) from anon;
grant execute on function public.reschedule_task_occurrence_atomic(uuid, date, date) to authenticated;
