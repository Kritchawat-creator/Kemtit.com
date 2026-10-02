-- Provider-owned event sources are durable identities; calendar_events are
-- bounded day projections consumed by the existing Calendar and Today pages.

alter table public.external_calendar_connections
  add column if not exists granted_scopes text[] not null default '{}',
  add column if not exists can_write boolean not null default false,
  add column if not exists sync_lease_id uuid,
  add column if not exists sync_lease_until timestamptz,
  add column if not exists last_sync_attempt_at timestamptz;

update public.external_calendar_connections c
set granted_scopes = coalesce(
      nullif(string_to_array(trim(cred.scope), ' '), array['']),
      '{}'::text[]
    ),
    can_write = case c.provider
      when 'google' then 'https://www.googleapis.com/auth/calendar.events' = any(
        coalesce(nullif(string_to_array(trim(cred.scope), ' '), array['']), '{}'::text[])
      )
      when 'outlook' then 'Calendars.ReadWrite' = any(
        coalesce(nullif(string_to_array(trim(cred.scope), ' '), array['']), '{}'::text[])
      )
      else false
    end
from public.external_calendar_credentials cred
where cred.connection_id = c.id;

alter table public.calendar_events
  add column if not exists blocks_time boolean not null default true,
  add column if not exists external_source_id uuid;

create table public.external_calendar_event_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.external_calendar_connections(id) on delete cascade,
  external_calendar_id text not null,
  external_event_id text not null,
  title text not null,
  all_day boolean not null,
  start_date date,
  end_date date,
  start_at timestamptz,
  end_at timestamptz,
  blocks_time boolean not null,
  event_kind text not null check (event_kind in ('single','occurrence','series')),
  etag text,
  provider_operation_id text,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  revision uuid not null default gen_random_uuid(),
  last_seen_sync_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_calendar_id, external_event_id),
  check (
    (all_day and start_date is not null and end_date is not null and end_date > start_date and start_at is null and end_at is null)
    or
    (not all_day and start_at is not null and end_at is not null and end_at > start_at and start_date is null and end_date is null)
  )
);

create index external_calendar_event_sources_window_idx
  on public.external_calendar_event_sources(connection_id, all_day, start_date, start_at);
create index external_calendar_event_sources_user_idx
  on public.external_calendar_event_sources(user_id, connection_id);

alter table public.external_calendar_event_sources enable row level security;
revoke all on public.external_calendar_event_sources from public, anon, authenticated;
grant all on public.external_calendar_event_sources to service_role;

-- Preserve imports created by the previous Google-only synchronizer.
insert into public.external_calendar_event_sources (
  user_id,
  connection_id,
  external_calendar_id,
  external_event_id,
  title,
  all_day,
  start_date,
  end_date,
  start_at,
  end_at,
  blocks_time,
  event_kind,
  etag,
  payload_hash
)
select
  link.user_id,
  link.connection_id,
  link.external_calendar_id,
  link.external_event_id,
  event.title,
  event.all_day,
  case when event.all_day then event.event_date else null end,
  case when event.all_day then event.event_date + 1 else null end,
  case when not event.all_day then (event.event_date + event.start_time) at time zone 'Asia/Bangkok' else null end,
  case when not event.all_day then (event.event_date + event.end_time) at time zone 'Asia/Bangkok' else null end,
  event.blocks_time,
  'single',
  null,
  md5(link.external_event_id || event.title || event.event_date::text) ||
    md5(coalesce(link.external_etag, '') || coalesce(event.start_time::text, '') || coalesce(event.end_time::text, ''))
from public.external_calendar_event_links link
join public.calendar_events event on event.id = link.local_event_id and event.user_id = link.user_id
where event.data_origin = 'IMPORT'
on conflict (connection_id, external_calendar_id, external_event_id) do nothing;

with linked_sources as (
  select
    event.id as local_event_id,
    source.id as source_id,
    row_number() over (partition by event.id order by link.created_at, link.id) as link_order
  from public.external_calendar_event_links link
  join public.calendar_events event on event.id = link.local_event_id and event.user_id = link.user_id
  join public.external_calendar_event_sources source
    on source.connection_id = link.connection_id
    and source.external_calendar_id = link.external_calendar_id
    and source.external_event_id = link.external_event_id
  where event.data_origin = 'IMPORT'
)
update public.calendar_events event
set external_source_id = linked.source_id
from linked_sources linked
where linked.local_event_id = event.id
  and linked.link_order = 1;

alter table public.calendar_events
  add constraint calendar_events_external_source_id_fkey
    foreign key (external_source_id)
    references public.external_calendar_event_sources(id)
    on delete cascade;

create unique index calendar_events_external_source_date_uidx
  on public.calendar_events(external_source_id, event_date)
  where external_source_id is not null;

create table public.external_calendar_operations (
  operation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.external_calendar_connections(id) on delete cascade,
  source_event_id uuid references public.external_calendar_event_sources(id) on delete set null,
  external_event_id text,
  operation_kind text not null check (operation_kind in ('create','update','delete')),
  request_payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('queued','pending','succeeded','conflict','unknown','failed')),
  error_code text check (error_code is null or error_code in (
    'revision_conflict','event_not_editable','operation_mismatch','connection_unavailable',
    'provider_conflict','provider_forbidden','provider_unauthorized','provider_not_found',
    'provider_rate_limited','provider_timeout','provider_request_failed','configuration',
    'invalid_response','response_unknown','lease_lost'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index external_calendar_operations_user_recent_idx
  on public.external_calendar_operations(user_id, updated_at desc);
create index external_calendar_operations_unresolved_idx
  on public.external_calendar_operations(user_id, updated_at desc)
  where status in ('queued','pending','unknown','conflict');

alter table public.external_calendar_operations enable row level security;
revoke all on public.external_calendar_operations from public, anon, authenticated;
grant all on public.external_calendar_operations to service_role;

-- Provider-owned projections are visible but cannot be changed or deleted by
-- authenticated clients. All provider writes flow through the service RPCs.
drop policy if exists "calendar_events: update own" on public.calendar_events;
drop policy if exists "calendar_events: delete own" on public.calendar_events;
create policy "calendar_events: update own non-import" on public.calendar_events
  for update to authenticated
  using ((select auth.uid()) = user_id and data_origin <> 'IMPORT')
  with check ((select auth.uid()) = user_id and data_origin <> 'IMPORT');
create policy "calendar_events: delete own non-import" on public.calendar_events
  for delete to authenticated
  using ((select auth.uid()) = user_id and data_origin <> 'IMPORT');

drop policy if exists "external_calendar_connections: delete own" on public.external_calendar_connections;
revoke delete on public.external_calendar_connections from authenticated;
revoke select on public.external_calendar_connections from authenticated;
grant select (id, user_id, provider, account_label, status, sync_status, last_synced_at, last_error, can_write, created_at, updated_at)
  on public.external_calendar_connections to authenticated;
drop policy if exists "external_calendar_event_links: select own" on public.external_calendar_event_links;
revoke all on public.external_calendar_event_links from authenticated;

create or replace function public.calendar_events_external_source_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.data_origin = 'IMPORT' and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'calendar_import_service_only' using errcode = '42501';
  end if;

  if new.external_source_id is not null then
    if coalesce(auth.role(), '') <> 'service_role' or new.data_origin <> 'IMPORT' then
      raise exception 'calendar_external_source_service_only' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.external_calendar_event_sources source
      where source.id = new.external_source_id and source.user_id = new.user_id
    ) then
      raise exception 'calendar_external_source_owner_mismatch' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger calendar_events_external_source_guard
  before insert or update on public.calendar_events
  for each row execute function public.calendar_events_external_source_guard();

create or replace function public._upsert_external_calendar_event_source(
  p_user_id uuid,
  p_connection_id uuid,
  p_sync_id uuid,
  p_event jsonb,
  p_projection_start date,
  p_projection_end date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.external_calendar_connections%rowtype;
  v_event_id text;
  v_title text;
  v_all_day boolean;
  v_start_date date;
  v_end_date date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_blocks_time boolean;
  v_kind text;
  v_etag text;
  v_operation_id text;
  v_payload_hash text;
  v_source_id uuid;
  v_projection jsonb;
  v_projection_date date;
  v_projection_dates date[] := '{}';
  v_projection_title text;
  v_projection_all_day boolean;
  v_start_time time;
  v_end_time time;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_event) is distinct from 'object' or jsonb_typeof(p_event->'projections') is distinct from 'array' then
    raise exception 'calendar_snapshot_invalid' using errcode = '22023';
  end if;
  if p_projection_end <= p_projection_start or p_projection_end - p_projection_start > 750 then
    raise exception 'calendar_snapshot_invalid' using errcode = '22023';
  end if;

  select * into v_connection
  from public.external_calendar_connections
  where id = p_connection_id and user_id = p_user_id and status = 'active';
  if not found then raise exception 'calendar_connection_unavailable' using errcode = 'P0002'; end if;

  v_event_id := p_event->>'externalId';
  v_title := p_event->>'title';
  v_all_day := (p_event->>'allDay')::boolean;
  v_blocks_time := (p_event->>'blocksTime')::boolean;
  v_kind := p_event->>'kind';
  v_etag := nullif(p_event->>'etag', '');
  v_operation_id := nullif(p_event->>'operationId', '');
  v_payload_hash := p_event->>'payloadHash';
  if v_event_id is null or char_length(v_event_id) not between 1 and 1000
     or v_title is null or v_all_day is null or v_blocks_time is null
     or v_kind is null or v_kind not in ('single','occurrence','series')
     or v_payload_hash is null or v_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'calendar_snapshot_invalid' using errcode = '22023';
  end if;

  if v_all_day then
    v_start_date := (p_event->>'start')::date;
    v_end_date := (p_event->>'end')::date;
    if v_end_date <= v_start_date then
      raise exception 'calendar_snapshot_invalid' using errcode = '22023';
    end if;
  else
    v_start_at := (p_event->>'start')::timestamptz;
    v_end_at := (p_event->>'end')::timestamptz;
    if v_end_at <= v_start_at then
      raise exception 'calendar_snapshot_invalid' using errcode = '22023';
    end if;
  end if;

  insert into public.external_calendar_event_sources (
    user_id, connection_id, external_calendar_id, external_event_id, title,
    all_day, start_date, end_date, start_at, end_at, blocks_time, event_kind,
    etag, provider_operation_id, payload_hash, last_seen_sync_id
  ) values (
    p_user_id, p_connection_id, coalesce(v_connection.external_calendar_id, 'primary'), v_event_id, v_title,
    v_all_day, v_start_date, v_end_date, v_start_at, v_end_at, v_blocks_time, v_kind,
    v_etag, v_operation_id, v_payload_hash, p_sync_id
  )
  on conflict (connection_id, external_calendar_id, external_event_id) do update
    set title = excluded.title,
        all_day = excluded.all_day,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        blocks_time = excluded.blocks_time,
        event_kind = excluded.event_kind,
        etag = excluded.etag,
        provider_operation_id = excluded.provider_operation_id,
        revision = case
          when public.external_calendar_event_sources.payload_hash is distinct from excluded.payload_hash
            then gen_random_uuid()
          else public.external_calendar_event_sources.revision
        end,
        payload_hash = excluded.payload_hash,
        last_seen_sync_id = coalesce(excluded.last_seen_sync_id, public.external_calendar_event_sources.last_seen_sync_id),
        updated_at = now()
  returning id into v_source_id;

  for v_projection in
    select item.value from jsonb_array_elements(p_event->'projections') as item(value)
  loop
    v_projection_date := (v_projection->>'event_date')::date;
    v_projection_title := v_projection->>'title';
    v_projection_all_day := (v_projection->>'all_day')::boolean;
    if v_projection_date < p_projection_start or v_projection_date >= p_projection_end
       or v_projection_title is null or char_length(v_projection_title) not between 1 and 200
       or v_projection_all_day is distinct from v_all_day
       or (v_projection->>'blocks_time')::boolean is distinct from v_blocks_time then
      raise exception 'calendar_projection_invalid' using errcode = '22023';
    end if;
    v_projection_dates := array_append(v_projection_dates, v_projection_date);
    v_start_time := null;
    v_end_time := null;
    if not v_projection_all_day then
      v_start_time := (v_projection->>'start_time')::time;
      v_end_time := (v_projection->>'end_time')::time;
      if v_start_time is null or v_end_time is null or v_end_time <= v_start_time then
        raise exception 'calendar_projection_invalid' using errcode = '22023';
      end if;
    end if;

    insert into public.calendar_events (
      user_id, title, event_date, start_time, end_time, all_day, blocks_time,
      data_origin, external_source_id
    ) values (
      p_user_id, v_projection_title, v_projection_date, v_start_time, v_end_time,
      v_projection_all_day, v_blocks_time, 'IMPORT', v_source_id
    )
    on conflict (external_source_id, event_date) where external_source_id is not null
    do update set
      title = excluded.title,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      all_day = excluded.all_day,
      blocks_time = excluded.blocks_time,
      data_origin = 'IMPORT',
      updated_at = now();
  end loop;

  delete from public.calendar_events projection
  where projection.external_source_id = v_source_id
    and projection.event_date >= p_projection_start
    and projection.event_date < p_projection_end
    and not (projection.event_date = any(v_projection_dates));

  return v_source_id;
end
$$;

revoke all on function public._upsert_external_calendar_event_source(uuid, uuid, uuid, jsonb, date, date)
  from public, anon, authenticated, service_role;

create or replace function public.persist_external_calendar_connection(
  p_user_id uuid,
  p_provider text,
  p_account_id text,
  p_account_label text,
  p_calendar_id text,
  p_refresh_token_ciphertext text,
  p_access_token_ciphertext text,
  p_access_token_expires_at timestamptz,
  p_scopes text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection_id uuid;
  v_old_refresh text;
  v_old_scope text;
  v_old_scopes text[];
  v_scopes text[];
  v_can_write boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_provider is null or p_provider not in ('google','outlook') or p_user_id is null or nullif(p_account_id, '') is null
     or nullif(p_access_token_ciphertext, '') is null or p_access_token_expires_at is null then
    raise exception 'calendar_connection_invalid' using errcode = '22023';
  end if;

  select id, granted_scopes into v_connection_id, v_old_scopes
  from public.external_calendar_connections
  where user_id = p_user_id and provider = p_provider and provider_account_id = p_account_id
  for update;
  if v_connection_id is not null then
    select refresh_token_ciphertext, scope into v_old_refresh, v_old_scope
    from public.external_calendar_credentials
    where connection_id = v_connection_id and user_id = p_user_id
    for update;
  end if;
  if p_refresh_token_ciphertext is null and v_old_refresh is null then
    raise exception 'calendar_refresh_token_missing' using errcode = '22023';
  end if;

  v_scopes := case
    when coalesce(array_length(p_scopes, 1), 0) > 0 then p_scopes
    else coalesce(v_old_scopes, nullif(string_to_array(trim(v_old_scope), ' '), array['']), '{}'::text[])
  end;
  v_can_write := case p_provider
    when 'google' then 'https://www.googleapis.com/auth/calendar.events' = any(v_scopes)
    when 'outlook' then 'Calendars.ReadWrite' = any(v_scopes)
    else false
  end;

  if v_connection_id is null then
    insert into public.external_calendar_connections (
      user_id, provider, provider_account_id, account_label, external_calendar_id,
      status, sync_status, last_error, granted_scopes, can_write
    ) values (
      p_user_id, p_provider, p_account_id, left(p_account_label, 200), coalesce(nullif(p_calendar_id, ''), 'primary'),
      'active', 'idle', null, v_scopes, v_can_write
    ) returning id into v_connection_id;
  else
    update public.external_calendar_connections
    set account_label = left(p_account_label, 200),
        external_calendar_id = coalesce(nullif(p_calendar_id, ''), external_calendar_id, 'primary'),
        status = 'active', sync_status = 'idle', last_error = null,
        granted_scopes = v_scopes, can_write = v_can_write,
        sync_lease_id = null, sync_lease_until = null, updated_at = now()
    where id = v_connection_id and user_id = p_user_id;
  end if;

  insert into public.external_calendar_credentials (
    connection_id, user_id, refresh_token_ciphertext, access_token_ciphertext,
    access_token_expires_at, scope
  ) values (
    v_connection_id, p_user_id, coalesce(p_refresh_token_ciphertext, v_old_refresh),
    p_access_token_ciphertext, p_access_token_expires_at, array_to_string(v_scopes, ' ')
  )
  on conflict (connection_id) do update set
    refresh_token_ciphertext = coalesce(excluded.refresh_token_ciphertext, public.external_calendar_credentials.refresh_token_ciphertext),
    access_token_ciphertext = excluded.access_token_ciphertext,
    access_token_expires_at = excluded.access_token_expires_at,
    scope = coalesce(nullif(excluded.scope, ''), public.external_calendar_credentials.scope),
    updated_at = now();

  return v_connection_id;
end
$$;

create or replace function public.update_external_calendar_tokens(
  p_user_id uuid,
  p_connection_id uuid,
  p_lease_id uuid,
  p_refresh_token_ciphertext text,
  p_access_token_ciphertext text,
  p_access_token_expires_at timestamptz,
  p_scopes text[]
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider text;
  v_old_scopes text[];
  v_scopes text[];
  v_can_write boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  select provider, granted_scopes into v_provider, v_old_scopes
  from public.external_calendar_connections
  where id = p_connection_id and user_id = p_user_id and status = 'active'
    and sync_lease_id = p_lease_id and sync_lease_until > now()
  for update;
  if not found or p_access_token_ciphertext is null or p_access_token_expires_at is null then return false; end if;

  v_scopes := case when coalesce(array_length(p_scopes, 1), 0) > 0 then p_scopes else v_old_scopes end;
  v_can_write := case v_provider
    when 'google' then 'https://www.googleapis.com/auth/calendar.events' = any(v_scopes)
    when 'outlook' then 'Calendars.ReadWrite' = any(v_scopes)
    else false
  end;
  update public.external_calendar_credentials
  set refresh_token_ciphertext = coalesce(p_refresh_token_ciphertext, refresh_token_ciphertext),
      access_token_ciphertext = p_access_token_ciphertext,
      access_token_expires_at = p_access_token_expires_at,
      scope = case when coalesce(array_length(p_scopes, 1), 0) > 0 then array_to_string(p_scopes, ' ') else scope end,
      updated_at = now()
  where connection_id = p_connection_id and user_id = p_user_id;
  if not found then return false; end if;

  update public.external_calendar_connections
  set granted_scopes = v_scopes, can_write = v_can_write, updated_at = now()
  where id = p_connection_id and user_id = p_user_id and sync_lease_id = p_lease_id;
  return found;
end
$$;

create or replace function public.claim_external_calendar_sync(
  p_user_id uuid,
  p_connection_id uuid,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.external_calendar_connections
  set sync_lease_id = p_lease_id,
      sync_lease_until = now() + interval '5 minutes',
      last_sync_attempt_at = now(),
      sync_status = 'syncing',
      last_error = null,
      updated_at = now()
  where id = p_connection_id and user_id = p_user_id and status = 'active'
    and (sync_lease_until is null or sync_lease_until <= now());
  return found;
end
$$;

create or replace function public.renew_external_calendar_lease(
  p_user_id uuid,
  p_connection_id uuid,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.external_calendar_connections
  set sync_lease_until = now() + interval '5 minutes', updated_at = now()
  where id = p_connection_id and user_id = p_user_id and status = 'active'
    and sync_lease_id = p_lease_id and sync_lease_until > now();
  return found;
end
$$;

create or replace function public.finish_external_calendar_sync_error(
  p_user_id uuid,
  p_connection_id uuid,
  p_lease_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.external_calendar_connections
  set sync_status = 'error',
      last_error = case when p_error_code in ('configuration','unauthorized','forbidden','not_found','conflict','rate_limited','timeout','request_failed','invalid_response') then p_error_code else 'request_failed' end,
      sync_lease_id = null, sync_lease_until = null, updated_at = now()
  where id = p_connection_id and user_id = p_user_id and status = 'active'
    and sync_lease_id = p_lease_id and sync_lease_until > now();
  return found;
end
$$;

create or replace function public.apply_external_calendar_snapshot(
  p_user_id uuid,
  p_connection_id uuid,
  p_lease_id uuid,
  p_sync_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_projection_start date,
  p_projection_end date,
  p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event jsonb;
  v_count integer := 0;
  v_projection_count bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform 1 from public.external_calendar_connections
  where id = p_connection_id and user_id = p_user_id and status = 'active'
    and sync_lease_id = p_lease_id and sync_lease_until > now()
  for update;
  if not found then raise exception 'calendar_sync_lease_lost' using errcode = '40001'; end if;
  if p_sync_id is null or p_window_start is null or p_window_end is null or p_window_end <= p_window_start
     or p_projection_start is null or p_projection_end is null
     or p_window_end - p_window_start > interval '740 days'
     or p_projection_end <= p_projection_start or p_projection_end - p_projection_start > 750
     or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) > 20000 then
    raise exception 'calendar_snapshot_invalid' using errcode = '22023';
  end if;
  select coalesce(sum(jsonb_array_length(item.value->'projections')), 0)
  into v_projection_count
  from jsonb_array_elements(p_events) as item(value);
  if v_projection_count > 20000 then
    raise exception 'calendar_snapshot_projection_limit' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_events) item(value)
    group by item.value->>'externalId'
    having count(*) > 1
  ) then
    raise exception 'calendar_snapshot_duplicate' using errcode = '22023';
  end if;

  for v_event in select item.value from jsonb_array_elements(p_events) as item(value)
  loop
    perform public._upsert_external_calendar_event_source(
      p_user_id, p_connection_id, p_sync_id, v_event, p_projection_start, p_projection_end
    );
    v_count := v_count + 1;
  end loop;

  delete from public.external_calendar_event_sources source
  where source.user_id = p_user_id and source.connection_id = p_connection_id
    and source.last_seen_sync_id is distinct from p_sync_id
    and (
      (source.all_day and source.start_date < p_projection_end and source.end_date > p_projection_start)
      or
      (not source.all_day and source.start_at < p_window_end and source.end_at > p_window_start)
    );

  update public.external_calendar_connections
  set sync_status = 'ok', last_synced_at = now(), last_error = null,
      sync_lease_id = null, sync_lease_until = null, sync_token = null, updated_at = now()
  where id = p_connection_id and user_id = p_user_id and sync_lease_id = p_lease_id;
  if not found then raise exception 'calendar_sync_lease_lost' using errcode = '40001'; end if;
  return v_count;
end
$$;

create or replace function public.claim_external_calendar_operation(
  p_user_id uuid,
  p_connection_id uuid,
  p_operation_id uuid,
  p_operation_kind text,
  p_source_event_id uuid,
  p_expected_revision uuid,
  p_request_payload jsonb,
  p_payload_hash text,
  p_lease_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_connection public.external_calendar_connections%rowtype;
  v_operation public.external_calendar_operations%rowtype;
  v_source public.external_calendar_event_sources%rowtype;
  v_existing boolean := false;
  v_reconcile boolean := false;
  v_error_code text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_operation_kind is null or p_operation_kind not in ('create','update','delete')
     or p_operation_id is null or p_lease_id is null or p_user_id is null or p_connection_id is null
     or p_request_payload is null or p_payload_hash is null
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'calendar_operation_invalid' using errcode = '22023';
  end if;
  select * into v_connection
  from public.external_calendar_connections
  where id = p_connection_id and user_id = p_user_id and status = 'active'
  for update;
  if not found then return jsonb_build_object('status','unavailable','errorCode','connection_unavailable'); end if;

  select * into v_operation from public.external_calendar_operations
  where operation_id = p_operation_id for update;
  v_existing := found;
  if v_existing then
    if v_operation.user_id <> p_user_id or v_operation.connection_id <> p_connection_id
       or v_operation.operation_kind <> p_operation_kind or v_operation.payload_hash <> p_payload_hash then
      return jsonb_build_object('status','conflict','errorCode','operation_mismatch');
    end if;
    if v_operation.status in ('succeeded','conflict','failed') then
      return jsonb_build_object(
        'status',v_operation.status,'errorCode',v_operation.error_code,
        'operationId',p_operation_id,'sourceEventId',v_operation.source_event_id
      );
    end if;
    v_reconcile := v_operation.status in ('pending','unknown');
  end if;

  if not v_connection.can_write then
    return jsonb_build_object('status','unavailable','errorCode','connection_unavailable');
  end if;

  if v_existing then
    if v_operation.status = 'queued' and v_operation.operation_kind in ('update','delete') then
      select * into v_source from public.external_calendar_event_sources
      where id = v_operation.source_event_id and user_id = p_user_id and connection_id = p_connection_id
      for update;
      if not found then return jsonb_build_object('status','notFound'); end if;
      if p_expected_revision is null or v_source.revision <> p_expected_revision then
        update public.external_calendar_operations
        set status = 'conflict', error_code = 'revision_conflict', updated_at = now()
        where operation_id = p_operation_id;
        return jsonb_build_object('status','conflict','errorCode','revision_conflict','operationId',p_operation_id);
      end if;
      if v_source.event_kind = 'series' or nullif(v_source.etag, '') is null then
        update public.external_calendar_operations
        set status = 'failed', error_code = 'event_not_editable', updated_at = now()
        where operation_id = p_operation_id;
        return jsonb_build_object('status','unavailable','errorCode','event_not_editable');
      end if;
    elsif v_operation.status not in ('queued','pending','unknown') then
      return jsonb_build_object('status',v_operation.status,'errorCode',v_operation.error_code,'operationId',p_operation_id);
    elsif v_operation.operation_kind in ('update','delete') and v_operation.source_event_id is not null then
      select * into v_source from public.external_calendar_event_sources
      where id = v_operation.source_event_id and user_id = p_user_id and connection_id = p_connection_id;
    end if;
  else
    if p_operation_kind in ('update','delete') then
      if p_source_event_id is null or p_expected_revision is null then
        return jsonb_build_object('status','unavailable','errorCode','event_not_editable');
      end if;
      select * into v_source from public.external_calendar_event_sources
      where id = p_source_event_id and user_id = p_user_id and connection_id = p_connection_id
      for update;
      if not found then return jsonb_build_object('status','notFound'); end if;
      if v_source.revision <> p_expected_revision then
        v_error_code := 'revision_conflict';
        insert into public.external_calendar_operations (
          operation_id,user_id,connection_id,source_event_id,external_event_id,
          operation_kind,request_payload,payload_hash,status,error_code
        ) values (
          p_operation_id,p_user_id,p_connection_id,v_source.id,v_source.external_event_id,
          p_operation_kind,p_request_payload,p_payload_hash,'conflict',v_error_code
        );
        return jsonb_build_object('status','conflict','errorCode',v_error_code,'operationId',p_operation_id);
      end if;
      if v_source.event_kind = 'series' or nullif(v_source.etag, '') is null then
        return jsonb_build_object('status','unavailable','errorCode','event_not_editable');
      end if;
    end if;
  end if;

  if v_connection.sync_lease_id is not null and v_connection.sync_lease_until > now()
     and v_connection.sync_lease_id <> p_lease_id then
    if not v_existing then
      insert into public.external_calendar_operations (
        operation_id,user_id,connection_id,source_event_id,external_event_id,
        operation_kind,request_payload,payload_hash,status
      ) values (
        p_operation_id,p_user_id,p_connection_id,v_source.id,v_source.external_event_id,
        p_operation_kind,p_request_payload,p_payload_hash,'queued'
      ) returning * into v_operation;
    end if;
    return jsonb_build_object('status','queued','operationId',p_operation_id);
  end if;

  if not v_existing then
    insert into public.external_calendar_operations (
      operation_id,user_id,connection_id,source_event_id,external_event_id,
      operation_kind,request_payload,payload_hash,status
    ) values (
      p_operation_id,p_user_id,p_connection_id,v_source.id,v_source.external_event_id,
      p_operation_kind,p_request_payload,p_payload_hash,'pending'
    ) returning * into v_operation;
  elsif v_operation.status = 'queued' then
    update public.external_calendar_operations
    set status = 'pending', updated_at = now()
    where operation_id = p_operation_id
    returning * into v_operation;
  end if;

  update public.external_calendar_connections
  set sync_lease_id = p_lease_id, sync_lease_until = now() + interval '5 minutes',
      last_sync_attempt_at = now(), updated_at = now()
  where id = p_connection_id and user_id = p_user_id and status = 'active';
  if not found then return jsonb_build_object('status','unavailable','errorCode','connection_unavailable'); end if;

  return jsonb_build_object(
    'status','ready','reconcile',v_reconcile,'operationId',p_operation_id,
    'operationKind',v_operation.operation_kind,'sourceEventId',v_operation.source_event_id,
    'externalEventId',coalesce(v_operation.external_event_id,v_source.external_event_id),
    'calendarId',coalesce(v_connection.external_calendar_id,'primary'),
    'etag',v_source.etag,'eventKind',v_source.event_kind,'revision',v_source.revision,
    'canonicalValue',case when v_source.id is null then null else jsonb_build_object(
      'title',v_source.title,
      'start',case when v_source.all_day then v_source.start_date::text else to_char(v_source.start_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'end',case when v_source.all_day then v_source.end_date::text else to_char(v_source.end_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'allDay',v_source.all_day,'blocksTime',v_source.blocks_time
    ) end,
    'requestPayload',v_operation.request_payload
  );
end
$$;

create or replace function public.finish_external_calendar_operation(
  p_user_id uuid,
  p_connection_id uuid,
  p_operation_id uuid,
  p_lease_id uuid,
  p_status text,
  p_error_code text,
  p_provider_event jsonb,
  p_projection_start date,
  p_projection_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_operation public.external_calendar_operations%rowtype;
  v_connection public.external_calendar_connections%rowtype;
  v_source_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('succeeded','conflict','unknown','failed') then
    raise exception 'calendar_operation_invalid' using errcode = '22023';
  end if;
  select * into v_connection from public.external_calendar_connections
  where id = p_connection_id and user_id = p_user_id and status = 'active'
    and sync_lease_id = p_lease_id and sync_lease_until > now()
  for update;
  if not found then return jsonb_build_object('status','stale','operationId',p_operation_id); end if;
  select * into v_operation from public.external_calendar_operations
  where operation_id = p_operation_id and user_id = p_user_id and connection_id = p_connection_id
  for update;
  if not found then return jsonb_build_object('status','stale','operationId',p_operation_id); end if;

  if p_status = 'succeeded' and v_operation.operation_kind in ('create','update') then
    if jsonb_typeof(p_provider_event) is distinct from 'object' then
      raise exception 'calendar_operation_invalid' using errcode = '22023';
    end if;
    v_source_id := public._upsert_external_calendar_event_source(
      p_user_id,p_connection_id,null,p_provider_event,p_projection_start,p_projection_end
    );
    update public.external_calendar_operations
    set status = 'succeeded', error_code = null, source_event_id = v_source_id,
        external_event_id = p_provider_event->>'externalId', updated_at = now()
    where operation_id = p_operation_id;
  elsif p_status = 'succeeded' and v_operation.operation_kind = 'delete' then
    delete from public.external_calendar_event_sources
    where id = v_operation.source_event_id and user_id = p_user_id and connection_id = p_connection_id;
    update public.external_calendar_operations
    set status = 'succeeded', error_code = null, source_event_id = null, updated_at = now()
    where operation_id = p_operation_id;
  else
    update public.external_calendar_operations
    set status = p_status,
        error_code = case
          when p_error_code in (
            'revision_conflict','event_not_editable','operation_mismatch','connection_unavailable',
            'provider_conflict','provider_forbidden','provider_unauthorized','provider_not_found',
            'provider_rate_limited','provider_timeout','provider_request_failed','configuration',
            'invalid_response','response_unknown','lease_lost'
          ) then p_error_code
          else null
        end,
        updated_at = now()
    where operation_id = p_operation_id;
  end if;

  update public.external_calendar_connections
  set sync_lease_id = null, sync_lease_until = null, updated_at = now()
  where id = p_connection_id and user_id = p_user_id and sync_lease_id = p_lease_id;
  return jsonb_build_object(
    'status',p_status,'operationId',p_operation_id,
    'sourceEventId',case when v_operation.operation_kind = 'delete' then null else v_source_id end
  );
end
$$;

create or replace function public.disconnect_external_calendar_connection(
  p_user_id uuid,
  p_connection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'not_authorized' using errcode = '42501'; end if;
  perform 1 from public.external_calendar_connections
  where id = p_connection_id and user_id = p_user_id
  for update;
  if not found then return false; end if;

  delete from public.calendar_events event
  using public.external_calendar_event_links link
  where link.connection_id = p_connection_id and link.user_id = p_user_id
    and event.id = link.local_event_id and event.user_id = p_user_id and event.data_origin = 'IMPORT';
  delete from public.external_calendar_event_sources
  where connection_id = p_connection_id and user_id = p_user_id;
  delete from public.external_calendar_credentials
  where connection_id = p_connection_id and user_id = p_user_id;
  update public.external_calendar_operations
  set status = 'unknown', error_code = 'connection_unavailable', updated_at = now()
  where connection_id = p_connection_id and user_id = p_user_id and status in ('queued','pending');
  update public.external_calendar_connections
  set status = 'revoked', sync_status = 'idle', sync_token = null, last_error = null,
      sync_lease_id = null, sync_lease_until = null, can_write = false, updated_at = now()
  where id = p_connection_id and user_id = p_user_id;
  return found;
end
$$;

revoke all on function public.persist_external_calendar_connection(uuid,text,text,text,text,text,text,timestamptz,text[])
  from public, anon, authenticated;
grant execute on function public.persist_external_calendar_connection(uuid,text,text,text,text,text,text,timestamptz,text[])
  to service_role;
revoke all on function public.update_external_calendar_tokens(uuid,uuid,uuid,text,text,timestamptz,text[])
  from public, anon, authenticated;
grant execute on function public.update_external_calendar_tokens(uuid,uuid,uuid,text,text,timestamptz,text[])
  to service_role;
revoke all on function public.claim_external_calendar_sync(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_external_calendar_sync(uuid,uuid,uuid) to service_role;
revoke all on function public.renew_external_calendar_lease(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.renew_external_calendar_lease(uuid,uuid,uuid) to service_role;
revoke all on function public.finish_external_calendar_sync_error(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.finish_external_calendar_sync_error(uuid,uuid,uuid,text) to service_role;
revoke all on function public.apply_external_calendar_snapshot(uuid,uuid,uuid,uuid,timestamptz,timestamptz,date,date,jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_external_calendar_snapshot(uuid,uuid,uuid,uuid,timestamptz,timestamptz,date,date,jsonb)
  to service_role;
revoke all on function public.claim_external_calendar_operation(uuid,uuid,uuid,text,uuid,uuid,jsonb,text,uuid)
  from public, anon, authenticated;
grant execute on function public.claim_external_calendar_operation(uuid,uuid,uuid,text,uuid,uuid,jsonb,text,uuid)
  to service_role;
revoke all on function public.finish_external_calendar_operation(uuid,uuid,uuid,uuid,text,text,jsonb,date,date)
  from public, anon, authenticated;
grant execute on function public.finish_external_calendar_operation(uuid,uuid,uuid,uuid,text,text,jsonb,date,date)
  to service_role;
revoke all on function public.disconnect_external_calendar_connection(uuid,uuid) from public, anon, authenticated;
grant execute on function public.disconnect_external_calendar_connection(uuid,uuid) to service_role;
