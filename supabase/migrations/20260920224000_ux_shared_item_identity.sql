-- UX redesign Phase 5B: additive shared identity + relationship layer.
-- Typed domain tables remain canonical owners of business fields. The registry
-- only provides cross-module identity and links; it is not a replacement table.

create table public.item_registry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null
    check (entity_type in ('goal', 'task', 'project', 'habit', 'event', 'bill', 'expense', 'note')),
  entity_id uuid not null,
  data_origin text not null default 'USER'
    check (data_origin in ('SYSTEM', 'TEMPLATE', 'SUGGESTED', 'EXAMPLE', 'USER', 'IMPORT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

comment on table public.item_registry is
  'Shared identity compatibility layer. Business title/status/type-specific fields stay in canonical typed tables.';

create index item_registry_user_type_idx
  on public.item_registry (user_id, entity_type, data_origin, updated_at desc);

create trigger set_item_registry_updated_at
  before update on public.item_registry
  for each row execute function public.set_updated_at();

alter table public.item_registry enable row level security;

create policy "item_registry: select own"
  on public.item_registry for select to authenticated
  using ((select auth.uid()) = user_id);

-- Normal clients do not write registry rows directly. Canonical-table triggers
-- run inside the user's transaction and are the supported write path.
revoke all on public.item_registry from anon;
revoke insert, update, delete on public.item_registry from authenticated;
grant select on public.item_registry to authenticated;

create table public.item_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_item_id uuid not null references public.item_registry (id) on delete cascade,
  target_item_id uuid not null references public.item_registry (id) on delete cascade,
  relation_type text not null
    check (
      relation_type in (
        'CONTRIBUTES_TO',
        'BELONGS_TO',
        'SCHEDULED_AS',
        'TRACKED_AS',
        'PLANNED_IN',
        'SYNCED_WITH'
      )
    ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_item_id, target_item_id, relation_type),
  check (source_item_id <> target_item_id)
);

comment on table public.item_links is
  'Cross-module relationships between canonical item identities. Does not duplicate canonical business records.';

create index item_links_user_source_idx
  on public.item_links (user_id, source_item_id, relation_type);
create index item_links_user_target_idx
  on public.item_links (user_id, target_item_id, relation_type);

create trigger set_item_links_updated_at
  before update on public.item_links
  for each row execute function public.set_updated_at();

create or replace function public.item_links_check_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.item_registry i
    where i.id = new.source_item_id
      and i.user_id = new.user_id
  ) then
    raise exception 'source item must belong to the same user' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.item_registry i
    where i.id = new.target_item_id
      and i.user_id = new.user_id
  ) then
    raise exception 'target item must belong to the same user' using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger item_links_owner
  before insert or update on public.item_links
  for each row execute function public.item_links_check_owner();

alter table public.item_links enable row level security;

create policy "item_links: select own"
  on public.item_links for select to authenticated
  using ((select auth.uid()) = user_id);

-- Relationship writes are maintained from canonical-table triggers for current
-- types. Future Bill/Event/Expense/Note services may get explicit link actions.
revoke all on public.item_links from anon;
revoke insert, update, delete on public.item_links from authenticated;
grant select on public.item_links to authenticated;

-- ---------- canonical row → shared identity ----------

create or replace function public.sync_item_registry_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  v_type := case tg_table_name
    when 'goals' then 'goal'
    when 'tasks' then 'task'
    when 'projects' then 'project'
    when 'habits' then 'habit'
    else null
  end;

  if v_type is null then
    raise exception 'unsupported registry table %', tg_table_name using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    delete from public.item_registry
    where user_id = old.user_id
      and entity_type = v_type
      and entity_id = old.id;
  end if;

  insert into public.item_registry (user_id, entity_type, entity_id, data_origin)
  values (new.user_id, v_type, new.id, new.data_origin)
  on conflict (user_id, entity_type, entity_id)
  do update set data_origin = excluded.data_origin;

  return new;
end
$$;

create or replace function public.remove_item_registry_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  v_type := case tg_table_name
    when 'goals' then 'goal'
    when 'tasks' then 'task'
    when 'projects' then 'project'
    when 'habits' then 'habit'
    else null
  end;

  if v_type is not null then
    delete from public.item_registry
    where user_id = old.user_id
      and entity_type = v_type
      and entity_id = old.id;
  end if;

  return old;
end
$$;

create trigger a_item_registry_goals_write
  before insert or update of user_id, data_origin on public.goals
  for each row execute function public.sync_item_registry_before_write();
create trigger a_item_registry_tasks_write
  before insert or update of user_id, data_origin on public.tasks
  for each row execute function public.sync_item_registry_before_write();
create trigger a_item_registry_projects_write
  before insert or update of user_id, data_origin on public.projects
  for each row execute function public.sync_item_registry_before_write();
create trigger a_item_registry_habits_write
  before insert or update of user_id, data_origin on public.habits
  for each row execute function public.sync_item_registry_before_write();

create trigger z_item_registry_goals_delete
  after delete on public.goals
  for each row execute function public.remove_item_registry_after_delete();
create trigger z_item_registry_tasks_delete
  after delete on public.tasks
  for each row execute function public.remove_item_registry_after_delete();
create trigger z_item_registry_projects_delete
  after delete on public.projects
  for each row execute function public.remove_item_registry_after_delete();
create trigger z_item_registry_habits_delete
  after delete on public.habits
  for each row execute function public.remove_item_registry_after_delete();

-- Existing rows predate the triggers.
insert into public.item_registry (user_id, entity_type, entity_id, data_origin)
select user_id, 'goal', id, data_origin from public.goals
union all
select user_id, 'task', id, data_origin from public.tasks
union all
select user_id, 'project', id, data_origin from public.projects
union all
select user_id, 'habit', id, data_origin from public.habits
on conflict (user_id, entity_type, entity_id)
do update set data_origin = excluded.data_origin;

-- ---------- canonical FK → relationship projection ----------

create or replace function public.sync_task_item_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source uuid;
  v_target uuid;
begin
  select id into v_source
  from public.item_registry
  where user_id = new.user_id and entity_type = 'task' and entity_id = new.id;

  delete from public.item_links
  where user_id = new.user_id
    and source_item_id = v_source
    and relation_type in ('CONTRIBUTES_TO', 'BELONGS_TO');

  if new.goal_id is not null then
    select id into v_target
    from public.item_registry
    where user_id = new.user_id and entity_type = 'goal' and entity_id = new.goal_id;

    if v_target is not null then
      insert into public.item_links (user_id, source_item_id, target_item_id, relation_type)
      values (new.user_id, v_source, v_target, 'CONTRIBUTES_TO')
      on conflict (source_item_id, target_item_id, relation_type) do nothing;
    end if;
  end if;

  if new.project_id is not null then
    select id into v_target
    from public.item_registry
    where user_id = new.user_id and entity_type = 'project' and entity_id = new.project_id;

    if v_target is not null then
      insert into public.item_links (user_id, source_item_id, target_item_id, relation_type)
      values (new.user_id, v_source, v_target, 'BELONGS_TO')
      on conflict (source_item_id, target_item_id, relation_type) do nothing;
    end if;
  end if;

  return new;
end
$$;

create or replace function public.sync_project_item_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source uuid;
  v_target uuid;
begin
  select id into v_source
  from public.item_registry
  where user_id = new.user_id and entity_type = 'project' and entity_id = new.id;

  delete from public.item_links
  where user_id = new.user_id
    and source_item_id = v_source
    and relation_type = 'CONTRIBUTES_TO';

  if new.goal_id is not null then
    select id into v_target
    from public.item_registry
    where user_id = new.user_id and entity_type = 'goal' and entity_id = new.goal_id;

    if v_target is not null then
      insert into public.item_links (user_id, source_item_id, target_item_id, relation_type)
      values (new.user_id, v_source, v_target, 'CONTRIBUTES_TO')
      on conflict (source_item_id, target_item_id, relation_type) do nothing;
    end if;
  end if;

  return new;
end
$$;

create or replace function public.sync_habit_item_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source uuid;
  v_target uuid;
begin
  select id into v_source
  from public.item_registry
  where user_id = new.user_id and entity_type = 'habit' and entity_id = new.id;

  delete from public.item_links
  where user_id = new.user_id
    and source_item_id = v_source
    and relation_type = 'CONTRIBUTES_TO';

  if new.goal_id is not null then
    select id into v_target
    from public.item_registry
    where user_id = new.user_id and entity_type = 'goal' and entity_id = new.goal_id;

    if v_target is not null then
      insert into public.item_links (user_id, source_item_id, target_item_id, relation_type)
      values (new.user_id, v_source, v_target, 'CONTRIBUTES_TO')
      on conflict (source_item_id, target_item_id, relation_type) do nothing;
    end if;
  end if;

  return new;
end
$$;

-- Registry sync is a BEFORE trigger, so these AFTER triggers always resolve
-- the source identity in the same transaction.
create trigger b_item_links_tasks
  after insert or update of goal_id, project_id on public.tasks
  for each row execute function public.sync_task_item_links();

create trigger b_item_links_projects
  after insert or update of goal_id on public.projects
  for each row execute function public.sync_project_item_links();

create trigger b_item_links_habits
  after insert or update of goal_id on public.habits
  for each row execute function public.sync_habit_item_links();

-- Backfill current relationships without creating duplicate business rows.
insert into public.item_links (user_id, source_item_id, target_item_id, relation_type)
select t.user_id, source.id, target.id, 'CONTRIBUTES_TO'
from public.tasks t
join public.item_registry source
  on source.user_id = t.user_id and source.entity_type = 'task' and source.entity_id = t.id
join public.item_registry target
  on target.user_id = t.user_id and target.entity_type = 'goal' and target.entity_id = t.goal_id
where t.goal_id is not null
on conflict (source_item_id, target_item_id, relation_type) do nothing;

insert into public.item_links (user_id, source_item_id, target_item_id, relation_type)
select t.user_id, source.id, target.id, 'BELONGS_TO'
from public.tasks t
join public.item_registry source
  on source.user_id = t.user_id and source.entity_type = 'task' and source.entity_id = t.id
join public.item_registry target
  on target.user_id = t.user_id and target.entity_type = 'project' and target.entity_id = t.project_id
where t.project_id is not null
on conflict (source_item_id, target_item_id, relation_type) do nothing;

insert into public.item_links (user_id, source_item_id, target_item_id, relation_type)
select p.user_id, source.id, target.id, 'CONTRIBUTES_TO'
from public.projects p
join public.item_registry source
  on source.user_id = p.user_id and source.entity_type = 'project' and source.entity_id = p.id
join public.item_registry target
  on target.user_id = p.user_id and target.entity_type = 'goal' and target.entity_id = p.goal_id
where p.goal_id is not null
on conflict (source_item_id, target_item_id, relation_type) do nothing;

insert into public.item_links (user_id, source_item_id, target_item_id, relation_type)
select h.user_id, source.id, target.id, 'CONTRIBUTES_TO'
from public.habits h
join public.item_registry source
  on source.user_id = h.user_id and source.entity_type = 'habit' and source.entity_id = h.id
join public.item_registry target
  on target.user_id = h.user_id and target.entity_type = 'goal' and target.entity_id = h.goal_id
where h.goal_id is not null
on conflict (source_item_id, target_item_id, relation_type) do nothing;
