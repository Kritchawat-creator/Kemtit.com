-- Preserve data-origin semantics if the legacy cascade RPC is called.
-- New onboarding no longer uses this RPC, but keeping it correct avoids future
-- TEMPLATE rows silently defaulting back to USER.

create or replace function public.create_goal_cascade(
  p_spec jsonb,
  p_parent_id uuid default null,
  p_from_template boolean default true
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal_id uuid;
  v_goal_kind text;
  v_origin text := case when p_from_template then 'TEMPLATE' else 'USER' end;
  v_child jsonb;
  v_task jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_spec is null or jsonb_typeof(p_spec) <> 'object' then
    raise exception 'goal spec must be an object' using errcode = '22023';
  end if;

  v_goal_kind := p_spec ->> 'goalKind';

  insert into public.goals (
    user_id,
    parent_id,
    title,
    period_type,
    period_start,
    domain,
    goal_kind,
    target_value,
    persona_data,
    data_origin
  )
  values (
    v_user_id,
    p_parent_id,
    p_spec ->> 'title',
    p_spec ->> 'periodType',
    (p_spec ->> 'periodStart')::date,
    p_spec ->> 'domain',
    v_goal_kind,
    case
      when v_goal_kind = 'metric' then (p_spec ->> 'targetValue')::numeric
      else null
    end,
    case
      when nullif(p_spec ->> 'unit', '') is not null
        then jsonb_build_object('unit', p_spec ->> 'unit')
      else '{}'::jsonb
    end,
    v_origin
  )
  returning id into v_goal_id;

  insert into public.domain_events (user_id, event_type, payload)
  values (
    v_user_id,
    'goal.created',
    jsonb_build_object(
      'goalId', v_goal_id,
      'periodType', p_spec ->> 'periodType',
      'goalKind', v_goal_kind,
      'fromTemplate', p_from_template
    )
  );

  for v_task in
    select value
    from jsonb_array_elements(coalesce(p_spec -> 'tasks', '[]'::jsonb))
  loop
    insert into public.tasks (
      user_id,
      goal_id,
      title,
      due_date,
      domain,
      data_origin
    )
    values (
      v_user_id,
      v_goal_id,
      v_task ->> 'title',
      (v_task ->> 'dueDate')::date,
      v_task ->> 'domain',
      v_origin
    );
  end loop;

  for v_child in
    select value
    from jsonb_array_elements(coalesce(p_spec -> 'children', '[]'::jsonb))
  loop
    perform public.create_goal_cascade(v_child, v_goal_id, p_from_template);
  end loop;

  return v_goal_id;
end
$$;

revoke all on function public.create_goal_cascade(jsonb, uuid, boolean) from public;
revoke all on function public.create_goal_cascade(jsonb, uuid, boolean) from anon;
grant execute on function public.create_goal_cascade(jsonb, uuid, boolean) to authenticated;
