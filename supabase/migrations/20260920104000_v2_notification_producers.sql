-- Kemtit V2 notification producers and preferences.
-- Producers use dedupe_key so scheduled retries cannot enqueue the same logical event twice.

alter table public.domain_events
  add column if not exists dedupe_key text;

create unique index if not exists domain_events_user_dedupe_key_unique
  on public.domain_events (user_id, dedupe_key)
  where dedupe_key is not null;

alter table public.user_profiles
  add column if not exists notify_daily_brief boolean not null default false,
  add column if not exists notify_weekly_review boolean not null default false,
  add column if not exists notify_habits boolean not null default false,
  add column if not exists notify_investment boolean not null default false;

grant update (
  notify_daily_brief,
  notify_weekly_review,
  notify_habits,
  notify_investment
) on public.user_profiles to authenticated;

comment on column public.domain_events.dedupe_key is
  'Stable logical-event key for producer idempotency, e.g. daily.brief:<user>:<date>.';
