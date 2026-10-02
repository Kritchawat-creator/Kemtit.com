-- Phase 0 LINE notification idempotency.
-- A source domain event may reserve at most one LINE send. Existing historical
-- notification.sent events without sourceEventId are unaffected.

create unique index if not exists domain_events_notification_source_unique
  on public.domain_events ((payload ->> 'sourceEventId'))
  where event_type = 'notification.sent'
    and payload ? 'sourceEventId';
