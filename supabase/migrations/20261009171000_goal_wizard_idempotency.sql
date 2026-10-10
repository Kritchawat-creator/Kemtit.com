-- Persist one accepted goal wizard operation per user/request so a lost reply can
-- be retried without creating a second canonical goal or first-step task.
create table public.goal_wizard_operations (
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  request_spec jsonb not null,
  goal_id uuid not null,
  task_ids uuid[] not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id),
  constraint goal_wizard_operations_task_ids check (cardinality(task_ids) = 1)
);

alter table public.goal_wizard_operations enable row level security;
revoke all on public.goal_wizard_operations from public, anon, authenticated;

create or replace function public.create_goal_wizard(
  p_request_id uuid,
  p_spec jsonb
)
returns table(goal_id uuid, task_ids uuid[])
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.goal_wizard_operations%rowtype;
  v_goal_id uuid;
  v_task_ids uuid[];
  v_goal_title text;
  v_period_type text;
  v_period_start date;
  v_goal_domain text;
  v_task jsonb;
  v_task_title text;
  v_task_date date;
  v_task_domain text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'goal wizard request id is required' using errcode = '22023';
  end if;
  if p_spec is null or jsonb_typeof(p_spec) <> 'object'
     or p_spec - array['title', 'periodType', 'periodStart', 'domain', 'goalKind', 'tasks'] <> '{}'::jsonb then
    raise exception 'goal wizard spec must contain only canonical fields' using errcode = '22023';
  end if;
  if not (p_spec ?& array['title', 'periodType', 'periodStart', 'domain', 'goalKind', 'tasks']) then
    raise exception 'goal wizard spec is incomplete' using errcode = '22023';
  end if;
  if jsonb_typeof(p_spec -> 'title') <> 'string'
     or jsonb_typeof(p_spec -> 'periodType') <> 'string'
     or jsonb_typeof(p_spec -> 'periodStart') <> 'string'
     or jsonb_typeof(p_spec -> 'domain') <> 'string'
     or jsonb_typeof(p_spec -> 'goalKind') <> 'string' then
    raise exception 'goal wizard string fields are invalid' using errcode = '22023';
  end if;

  v_goal_title := p_spec ->> 'title';
  v_period_type := p_spec ->> 'periodType';
  v_goal_domain := p_spec ->> 'domain';
  if v_goal_title is null or v_goal_title <> btrim(v_goal_title)
     or char_length(v_goal_title) not between 1 and 120 then
    raise exception 'goal wizard title is invalid' using errcode = '22023';
  end if;
  if v_period_type is null or v_period_type not in ('year', 'quarter', 'month', 'week', 'day') then
    raise exception 'goal wizard period type is invalid' using errcode = '22023';
  end if;
  if v_goal_domain is null or v_goal_domain not in ('work', 'health', 'family', 'finance', 'growth', 'relationships') then
    raise exception 'goal wizard domain is invalid' using errcode = '22023';
  end if;
  if p_spec ->> 'goalKind' is distinct from 'execution' then
    raise exception 'goal wizard only creates execution goals' using errcode = '22023';
  end if;
  if jsonb_typeof(p_spec -> 'tasks') <> 'array'
     or jsonb_array_length(p_spec -> 'tasks') <> 1 then
    raise exception 'goal wizard requires exactly one first-step task' using errcode = '22023';
  end if;

  begin
    v_period_start := (p_spec ->> 'periodStart')::date;
  exception when others then
    raise exception 'goal wizard period start is invalid' using errcode = '22023';
  end;
  if v_period_start is null or to_char(v_period_start, 'YYYY-MM-DD') <> p_spec ->> 'periodStart' then
    raise exception 'goal wizard period start is invalid' using errcode = '22023';
  end if;
  if (v_period_type = 'year' and (extract(month from v_period_start) <> 1 or extract(day from v_period_start) <> 1))
     or (v_period_type = 'quarter' and (extract(month from v_period_start) not in (1, 4, 7, 10) or extract(day from v_period_start) <> 1))
     or (v_period_type = 'month' and extract(day from v_period_start) <> 1)
     or (v_period_type = 'week' and extract(dow from v_period_start) <> 0) then
    raise exception 'goal wizard period anchor is invalid' using errcode = '22023';
  end if;

  v_task := p_spec -> 'tasks' -> 0;
  if jsonb_typeof(v_task) <> 'object'
     or v_task - array['title', 'dueDate', 'domain'] <> '{}'::jsonb
     or not (v_task ?& array['title', 'dueDate', 'domain']) then
    raise exception 'goal wizard task spec is incomplete' using errcode = '22023';
  end if;
  if jsonb_typeof(v_task -> 'title') <> 'string'
     or jsonb_typeof(v_task -> 'dueDate') <> 'string'
     or jsonb_typeof(v_task -> 'domain') <> 'string' then
    raise exception 'goal wizard task string fields are invalid' using errcode = '22023';
  end if;
  v_task_title := v_task ->> 'title';
  v_task_domain := v_task ->> 'domain';
  if v_task_title is null or v_task_title <> btrim(v_task_title)
     or char_length(v_task_title) not between 1 and 200 then
    raise exception 'goal wizard task title is invalid' using errcode = '22023';
  end if;
  if v_task_domain is null or v_task_domain not in ('work', 'health', 'family', 'finance', 'growth', 'relationships') then
    raise exception 'goal wizard task domain is invalid' using errcode = '22023';
  end if;
  begin
    v_task_date := (v_task ->> 'dueDate')::date;
  exception when others then
    raise exception 'goal wizard task date is invalid' using errcode = '22023';
  end;
  if v_task_date is null or to_char(v_task_date, 'YYYY-MM-DD') <> v_task ->> 'dueDate' then
    raise exception 'goal wizard task date is invalid' using errcode = '22023';
  end if;

  -- Serialize wizard operations for a user, matching the app's established user-lock key.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select operation.*
    into v_existing
    from public.goal_wizard_operations operation
   where operation.user_id = v_user_id
     and operation.request_id = p_request_id
   for update;
  if found then
    if v_existing.request_spec <> p_spec then
      raise exception 'goal_wizard_idempotency_conflict' using errcode = '23505';
    end if;
    return query select v_existing.goal_id, v_existing.task_ids;
    return;
  end if;

  -- This existing RPC writes canonical USER-origin goal/task records and the goal.created event.
  v_goal_id := public.create_goal_cascade(p_spec, null, false);
  select array_agg(task.id order by task.created_at, task.id)
    into v_task_ids
    from public.tasks task
   where task.user_id = v_user_id
     and task.goal_id = v_goal_id;
  if cardinality(v_task_ids) is distinct from 1 then
    raise exception 'goal wizard did not create exactly one task' using errcode = '23514';
  end if;

  insert into public.goal_wizard_operations (user_id, request_id, request_spec, goal_id, task_ids)
  values (v_user_id, p_request_id, p_spec, v_goal_id, v_task_ids);

  return query select v_goal_id, v_task_ids;
end
$$;

revoke all on function public.create_goal_wizard(uuid, jsonb) from public;
revoke all on function public.create_goal_wizard(uuid, jsonb) from anon;
grant execute on function public.create_goal_wizard(uuid, jsonb) to authenticated;
