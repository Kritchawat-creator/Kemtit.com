-- Google Calendar provider implementation.
-- Provider credentials are server-only: authenticated users receive no direct
-- table privileges. Refresh/access tokens are encrypted by the application
-- before storage.

alter table public.external_calendar_connections
  add column if not exists external_calendar_id text,
  add column if not exists sync_token text,
  add column if not exists sync_status text not null default 'idle'
    check (sync_status in ('idle','syncing','ok','error')),
  add column if not exists last_error text;

create table public.external_calendar_credentials (
  connection_id uuid primary key references public.external_calendar_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token_ciphertext text not null,
  access_token_ciphertext text,
  access_token_expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, connection_id)
);

create trigger set_external_calendar_credentials_updated_at
  before update on public.external_calendar_credentials
  for each row execute function public.set_updated_at();

alter table public.external_calendar_credentials enable row level security;

-- Deliberately no authenticated policies/grants: only the server service-role
-- adapter may read/write encrypted OAuth material.
revoke all on public.external_calendar_credentials from anon, authenticated;

alter table public.external_calendar_event_links
  add column if not exists provider_updated_at timestamptz,
  add column if not exists sync_status text not null default 'ok'
    check (sync_status in ('ok','deleted','error'));

comment on table public.external_calendar_credentials is
  'Server-only encrypted provider credentials. Never expose tokens to client code or Calendar core.';
comment on column public.external_calendar_connections.sync_token is
  'Provider incremental sync token; opaque provider state owned by adapter.';
