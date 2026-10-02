-- Provider-neutral external calendar boundary.
-- No OAuth tokens are stored here. Provider credentials/tokens belong in the
-- server-side provider adapter/secret store, not in calendar core.

create table public.external_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','outlook')),
  provider_account_id text not null check (char_length(provider_account_id) between 1 and 500),
  account_label text check (account_label is null or char_length(account_label) <= 200),
  status text not null default 'active' check (status in ('active','revoked','error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, provider_account_id)
);

create index external_calendar_connections_user_idx
  on public.external_calendar_connections(user_id, provider, status);

create trigger set_external_calendar_connections_updated_at
  before update on public.external_calendar_connections
  for each row execute function public.set_updated_at();

alter table public.external_calendar_connections enable row level security;
create policy "external_calendar_connections: select own"
  on public.external_calendar_connections for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "external_calendar_connections: delete own"
  on public.external_calendar_connections for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Creation/update are performed by trusted OAuth callback/provider services.
revoke all on public.external_calendar_connections from anon;
revoke insert, update on public.external_calendar_connections from authenticated;
grant select, delete on public.external_calendar_connections to authenticated;

create table public.external_calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  connection_id uuid not null references public.external_calendar_connections(id) on delete cascade,
  local_event_id uuid not null references public.calendar_events(id) on delete cascade,
  external_calendar_id text not null check (char_length(external_calendar_id) between 1 and 1000),
  external_event_id text not null check (char_length(external_event_id) between 1 and 1000),
  external_etag text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id, external_calendar_id, external_event_id),
  unique(connection_id, local_event_id)
);

create index external_calendar_event_links_user_idx
  on public.external_calendar_event_links(user_id, connection_id, local_event_id);

create trigger set_external_calendar_event_links_updated_at
  before update on public.external_calendar_event_links
  for each row execute function public.set_updated_at();

create or replace function public.external_calendar_event_links_check_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.external_calendar_connections c
    where c.id = new.connection_id and c.user_id = new.user_id
  ) then
    raise exception 'calendar connection must belong to user' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.calendar_events e
    where e.id = new.local_event_id and e.user_id = new.user_id
  ) then
    raise exception 'calendar event must belong to user' using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger external_calendar_event_links_owner
  before insert or update on public.external_calendar_event_links
  for each row execute function public.external_calendar_event_links_check_owner();

alter table public.external_calendar_event_links enable row level security;
create policy "external_calendar_event_links: select own"
  on public.external_calendar_event_links for select to authenticated
  using ((select auth.uid()) = user_id);

-- Provider services own link writes; users read mappings through the app.
revoke all on public.external_calendar_event_links from anon;
revoke insert, update, delete on public.external_calendar_event_links from authenticated;
grant select on public.external_calendar_event_links to authenticated;
