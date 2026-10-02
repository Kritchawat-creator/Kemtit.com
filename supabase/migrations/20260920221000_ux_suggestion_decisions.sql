-- UX redesign: decision metadata for non-persisted starter suggestions.
-- Suggested content itself stays outside business tables until accepted.

create table public.suggestion_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  suggestion_id text not null check (char_length(suggestion_id) between 1 and 160),
  status text not null check (status in ('pending', 'accepted', 'skipped')),
  accepted_entity_type text
    check (accepted_entity_type is null or accepted_entity_type in ('task', 'goal', 'habit')),
  accepted_entity_id uuid,
  custom_title text check (custom_title is null or char_length(custom_title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, suggestion_id),
  check ((accepted_entity_type is null) = (accepted_entity_id is null)),
  check (
    (status = 'accepted' and accepted_entity_id is not null)
    or
    (status = 'pending')
    or
    (status = 'skipped' and accepted_entity_id is null)
  )
);

comment on table public.suggestion_decisions is
  'Decision/audit metadata for prepared suggestions. This table is not user activity and must never be counted as Tasks, Goals, Habits, Finance, or analytics activity.';

create index suggestion_decisions_user_status_idx
  on public.suggestion_decisions (user_id, status, updated_at desc);

create trigger set_suggestion_decisions_updated_at
  before update on public.suggestion_decisions
  for each row execute function public.set_updated_at();

alter table public.suggestion_decisions enable row level security;

create policy "suggestion_decisions: select own"
  on public.suggestion_decisions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "suggestion_decisions: insert own"
  on public.suggestion_decisions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "suggestion_decisions: update own"
  on public.suggestion_decisions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "suggestion_decisions: delete own"
  on public.suggestion_decisions for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.suggestion_decisions from anon;
