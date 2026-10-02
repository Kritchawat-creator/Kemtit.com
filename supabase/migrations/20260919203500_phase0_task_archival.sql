-- Phase 0 task safety: soft-delete tasks so recurring completion history is preserved.
-- The full task_occurrences model arrives in V2 Phase 2; until then recurring
-- reschedule is intentionally blocked at the action/UI layer instead of mutating
-- the whole series accidentally.

alter table public.tasks
  add column if not exists archived_at timestamptz;

comment on column public.tasks.archived_at is
  'Soft-delete timestamp. Archived tasks stay in DB so task_completions/history are preserved.';

create index if not exists tasks_user_active_due_idx
  on public.tasks (user_id, due_date)
  where archived_at is null;

create index if not exists tasks_goal_active_idx
  on public.tasks (goal_id)
  where archived_at is null;
