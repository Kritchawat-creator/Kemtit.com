-- UX redesign: make business-data origin queryable.
-- Existing onboarding template cascades are identified from the historical
-- goal.created domain event payload { fromTemplate: true }.

alter table public.goals
  add column if not exists data_origin text not null default 'USER';

alter table public.tasks
  add column if not exists data_origin text not null default 'USER';

alter table public.task_completions
  add column if not exists data_origin text not null default 'USER';

alter table public.task_occurrences
  add column if not exists data_origin text not null default 'USER';

alter table public.time_blocks
  add column if not exists data_origin text not null default 'USER';

alter table public.projects
  add column if not exists data_origin text not null default 'USER';

alter table public.habits
  add column if not exists data_origin text not null default 'USER';

alter table public.goal_entries
  add column if not exists data_origin text not null default 'USER';

do $$
declare
  v_table text;
  v_constraint text;
begin
  foreach v_table in array array[
    'goals',
    'tasks',
    'task_completions',
    'task_occurrences',
    'time_blocks',
    'projects',
    'habits',
    'goal_entries'
  ]
  loop
    v_constraint := v_table || '_data_origin_check';
    if not exists (
      select 1
      from pg_constraint
      where conname = v_constraint
        and conrelid = ('public.' || v_table)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (data_origin in (''SYSTEM'', ''TEMPLATE'', ''SUGGESTED'', ''EXAMPLE'', ''USER'', ''IMPORT''))',
        v_table,
        v_constraint
      );
    end if;
  end loop;
end
$$;

-- All rows default to USER. Correct the legacy generated onboarding cascades
-- using the historical event marker emitted atomically with each template goal.
with template_goals as (
  select distinct (payload ->> 'goalId')::uuid as goal_id
  from public.domain_events
  where event_type = 'goal.created'
    and payload ->> 'fromTemplate' = 'true'
    and payload ? 'goalId'
)
update public.goals g
set data_origin = 'TEMPLATE'
from template_goals tg
where g.id = tg.goal_id;

with template_goals as (
  select distinct (payload ->> 'goalId')::uuid as goal_id
  from public.domain_events
  where event_type = 'goal.created'
    and payload ->> 'fromTemplate' = 'true'
    and payload ? 'goalId'
)
update public.tasks t
set data_origin = 'TEMPLATE'
from template_goals tg
where t.goal_id = tg.goal_id;

-- Derived activity inherits the semantic origin of its canonical parent.
update public.task_completions c
set data_origin = t.data_origin
from public.tasks t
where c.task_id = t.id
  and c.data_origin <> t.data_origin;

update public.task_occurrences o
set data_origin = t.data_origin
from public.tasks t
where o.task_id = t.id
  and o.data_origin <> t.data_origin;

update public.time_blocks b
set data_origin = o.data_origin
from public.task_occurrences o
where b.task_occurrence_id = o.id
  and b.data_origin <> o.data_origin;

update public.time_blocks b
set data_origin = t.data_origin
from public.tasks t
where b.task_occurrence_id is null
  and b.task_id = t.id
  and b.data_origin <> t.data_origin;

update public.time_blocks
set data_origin = 'IMPORT'
where task_id is null
  and task_occurrence_id is null
  and source in ('google', 'outlook');

update public.goal_entries e
set data_origin = g.data_origin
from public.goals g
where e.goal_id = g.id
  and e.data_origin <> g.data_origin;

-- Future derived rows inherit origin from their canonical parent. This keeps
-- reporting semantics correct even if a legacy/template id reaches a mutation.
create or replace function public.task_derived_data_origin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select t.data_origin
  into new.data_origin
  from public.tasks t
  where t.id = new.task_id
    and t.user_id = new.user_id;

  if new.data_origin is null then
    raise exception 'task origin could not be resolved' using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger task_completions_data_origin
  before insert or update of task_id, user_id on public.task_completions
  for each row execute function public.task_derived_data_origin();

create trigger task_occurrences_data_origin
  before insert or update of task_id, user_id on public.task_occurrences
  for each row execute function public.task_derived_data_origin();

create or replace function public.time_block_data_origin()
returns trigger
language plpgsql
set search_path = public
as $body$
begin
  if new.task_occurrence_id is not null then
    select o.data_origin
    into new.data_origin
    from public.task_occurrences o
    where o.id = new.task_occurrence_id
      and o.user_id = new.user_id;
  elsif new.task_id is not null then
    select t.data_origin
    into new.data_origin
    from public.tasks t
    where t.id = new.task_id
      and t.user_id = new.user_id;
  elsif new.source in ('google', 'outlook') then
    new.data_origin := 'IMPORT';
  else
    new.data_origin := 'USER';
  end if;

  if new.data_origin is null then
    raise exception 'time block origin could not be resolved' using errcode = '23514';
  end if;

  return new;
end
$body$;

create trigger time_blocks_data_origin
  before insert or update of task_id, task_occurrence_id, user_id, source on public.time_blocks
  for each row execute function public.time_block_data_origin();

create or replace function public.goal_entry_data_origin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select g.data_origin
  into new.data_origin
  from public.goals g
  where g.id = new.goal_id
    and g.user_id = new.user_id;

  if new.data_origin is null then
    raise exception 'goal origin could not be resolved' using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger goal_entries_data_origin
  before insert or update of goal_id, user_id on public.goal_entries
  for each row execute function public.goal_entry_data_origin();

comment on column public.goals.data_origin is
  'Data semantics for UX/reporting. Unaccepted SUGGESTED/EXAMPLE/TEMPLATE records must not count as USER activity.';
comment on column public.tasks.data_origin is
  'Data semantics for UX/reporting. Legacy onboarding sample tasks linked to template goals are TEMPLATE.';
comment on column public.task_completions.data_origin is
  'Inherited semantic origin of the canonical task for deterministic reporting.';
comment on column public.task_occurrences.data_origin is
  'Inherited semantic origin of the canonical recurring task for deterministic reporting.';
comment on column public.time_blocks.data_origin is
  'Semantic data origin. Separate from time_blocks.source, which identifies the scheduling/provider source.';
comment on column public.projects.data_origin is
  'Data semantics for UX/reporting.';
comment on column public.habits.data_origin is
  'Data semantics for UX/reporting.';
comment on column public.goal_entries.data_origin is
  'Inherited semantic origin of the canonical goal for deterministic reporting and future imports.';

create index if not exists goals_user_origin_idx
  on public.goals (user_id, data_origin, status, period_start);
create index if not exists tasks_user_origin_idx
  on public.tasks (user_id, data_origin, status, due_date);
create index if not exists task_completions_user_origin_idx
  on public.task_completions (user_id, data_origin, completed_on);
create index if not exists task_occurrences_user_origin_idx
  on public.task_occurrences (user_id, data_origin, occurrence_date, status);
create index if not exists time_blocks_user_origin_idx
  on public.time_blocks (user_id, data_origin, start_at);
create index if not exists projects_user_origin_idx
  on public.projects (user_id, data_origin, status);
create index if not exists habits_user_origin_idx
  on public.habits (user_id, data_origin, archived_at);
create index if not exists goal_entries_user_origin_idx
  on public.goal_entries (user_id, data_origin, entry_date desc);
