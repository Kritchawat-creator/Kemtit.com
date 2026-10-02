-- UX redesign: idempotent confirmation metadata for Universal Quick Capture.
-- This table is operational metadata only; canonical business data stays in
-- tasks/goals/habits and later typed domains.

create table public.capture_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_id uuid not null,
  status text not null check (status in ('pending', 'completed')),
  entity_type text check (entity_type is null or entity_type in ('task', 'goal', 'habit')),
  entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id),
  check ((entity_type is null) = (entity_id is null)),
  check (
    (status = 'completed' and entity_id is not null)
    or
    (status = 'pending')
  )
);

comment on table public.capture_confirmations is
  'Idempotency metadata for Quick Capture confirmation. It is not user activity and must not be included in reports or domain calculations.';

create index capture_confirmations_user_status_idx
  on public.capture_confirmations (user_id, status, updated_at desc);

create trigger set_capture_confirmations_updated_at
  before update on public.capture_confirmations
  for each row execute function public.set_updated_at();

alter table public.capture_confirmations enable row level security;

create policy "capture_confirmations: select own"
  on public.capture_confirmations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "capture_confirmations: insert own"
  on public.capture_confirmations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "capture_confirmations: update own"
  on public.capture_confirmations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "capture_confirmations: delete own"
  on public.capture_confirmations for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.capture_confirmations from anon;
