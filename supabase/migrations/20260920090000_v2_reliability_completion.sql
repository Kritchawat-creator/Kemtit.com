-- Kemtit V2 reliability completion.
-- Closes the remaining Phase 0 concurrency gaps without removing legacy columns.

-- ---------- domain event claiming ----------
alter table public.domain_events
  add column if not exists processing_at timestamptz;

comment on column public.domain_events.processing_at is
  'Timestamp of the current processor claim. Stale claims may be reclaimed after the safety window.';

create index if not exists domain_events_claimable_idx
  on public.domain_events (created_at)
  where processed_at is null;

create or replace function public.claim_domain_events(
  p_limit integer,
  p_max_attempts integer
)
returns setof public.domain_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select e.id
    from public.domain_events e
    where e.processed_at is null
      and e.attempts < p_max_attempts
      and (
        e.processing_at is null
        or e.processing_at < now() - interval '2 minutes'
      )
    order by e.created_at
    for update skip locked
    limit greatest(p_limit, 0)
  ),
  claimed as (
    update public.domain_events e
    set processing_at = now()
    from candidates c
    where e.id = c.id
    returning e.*
  )
  select c.*
  from claimed c
  order by c.created_at;
end
$$;

revoke all on function public.claim_domain_events(integer, integer) from public;
revoke all on function public.claim_domain_events(integer, integer) from anon;
revoke all on function public.claim_domain_events(integer, integer) from authenticated;
grant execute on function public.claim_domain_events(integer, integer) to service_role;

-- ---------- exactly-once goal completion transition ----------
create or replace function public.complete_goal_once(
  p_goal_id uuid
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text;
  v_period_type text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.goals
  set completed_at = now(),
      status = 'completed'
  where id = p_goal_id
    and user_id = v_user_id
    and completed_at is null
  returning title, period_type
  into v_title, v_period_type;

  if not found then
    return false;
  end if;

  insert into public.domain_events (user_id, event_type, payload)
  values (
    v_user_id,
    'goal.completed',
    jsonb_build_object(
      'goalId', p_goal_id,
      'title', v_title,
      'periodType', v_period_type
    )
  );

  return true;
end
$$;

revoke all on function public.complete_goal_once(uuid) from public;
revoke all on function public.complete_goal_once(uuid) from anon;
grant execute on function public.complete_goal_once(uuid) to authenticated;
