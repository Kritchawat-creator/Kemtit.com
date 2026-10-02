-- Add the owner-leading index required by user-scoped task photo reads/RLS.
-- Existing task_id ordering is retained for task detail queries.
create index task_photos_user_task_idx
  on public.task_photos (user_id, task_id, created_at);
