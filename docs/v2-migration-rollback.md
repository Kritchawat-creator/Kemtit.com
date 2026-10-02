# Kemtit V2 planning migration and rollback notes

Covered migrations:

- `supabase/migrations/20260919210000_v2_planning_foundation.sql`
- `supabase/migrations/20260920090000_v2_reliability_completion.sql`
- `supabase/migrations/20260920091000_v2_habit_goal_link.sql`
- `supabase/migrations/20260920092000_v2_time_block_atomic.sql`
- `supabase/migrations/20260920100000_v2_occurrence_runtime.sql`
- `supabase/migrations/20260920101000_v2_task_subtasks.sql`
- `supabase/migrations/20260920102000_v2_security_indexes.sql`
- `supabase/migrations/20260920103000_v2_occurrence_identity.sql`
- `supabase/migrations/20260920104000_v2_notification_producers.sql`
- `supabase/migrations/20260920105000_v2_time_block_occurrence.sql`

## Forward path

1. Apply every migration in timestamp order in a staging database first.
2. Verify that every new user-owned table has RLS enabled and that an authenticated user can only read/write rows with their own `user_id`.
3. Verify the ownership triggers for project → goal, task → project, occurrence → task, habit → goal, habit completion → habit, and time block → task/occurrence.
4. Backfill `user_profiles.work_mode` from `active_persona`; unresolved legacy personas remain `NULL` for explicit follow-up rather than being guessed.
5. Backfill task state from existing `completed_at`/`archived_at`. Existing `active_persona`, `due_date`, `recurrence_rule`, and completion history remain available during the transition.
6. Verify `claim_domain_events()` with two concurrent workers: one source event may be claimed by only one worker, explicit provider failure must release the processing claim, and a stale claim must become eligible after the safety window.
7. Verify `complete_goal_once()` with concurrent requests: the goal must transition once and exactly one `goal.completed` event must be written.
8. Verify `create_time_block_atomic()` with concurrent overlapping requests for the same user: at most one block may be created.
9. Verify Habit → Goal ownership and the `estimated_minutes` constraint.
10. Verify recurring occurrence actions: `occurrence_date` remains the immutable source identity while `scheduled_date` may move independently; moving one DAILY occurrence onto another series day must leave both occurrences visible without changing the recurring task definition.
11. Verify `task_subtasks` RLS, task ownership validation, position ordering, and CRUD/toggle behavior.
12. Verify V2 notification preferences are opt-in, producer `dedupe_key` prevents duplicate logical source events, and morning/evening producer retries are idempotent.
13. Verify a time block linked to `task_occurrence_id` belongs to the same task/user and that concurrent overlap protection still holds.
14. Regenerate `src/types/database.ts` from the staged schema before production promotion and compare it with the checked-in type contract.

## Recovery / rollback

These migrations are intentionally forward-only at the schema boundary. Do not run an ad-hoc destructive down migration in production. If application rollout must be reversed:

- deploy the previous application build; legacy columns and routes remain intact;
- leave additive tables, columns, functions and indexes in place because the previous build does not depend on them;
- restore from the database/provider point-in-time snapshot only if a migration itself failed or data corruption is observed;
- if a partial migration fails, restore the staging snapshot and fix the migration before retrying; do not manually drop tables in production;
- preserve rows created in `projects`, `task_occurrences`, `habits`, `habit_completions`, `daily_plans`, `time_blocks`, or `weekly_reviews` when rolling the app binary back;
- preserve rows created in `task_subtasks`. They are additive and are ignored by older application builds;
- keep `task_photos_user_task_idx`; it is additive and can be recreated from the migration if an index-only rollback is required;
- keep `task_completions` during the occurrence transition. It remains the historical compatibility source while occurrence-level completion is adopted incrementally;
- keep occurrence identity data: `occurrence_date` is the immutable series source and `scheduled_date` is the actual moved/display date. Do not collapse moved rows back into the recurring task definition during rollback;
- keep `domain_events.processing_at` and `dedupe_key` during an app rollback. Both are additive; stale claims remain recoverable and producer retries remain idempotent;
- keep the V2 notification preference columns on `user_profiles`; they default to `false` and older application builds ignore them safely;
- do not remove `complete_goal_once()` or `claim_domain_events()` until all application versions that may call them are retired;
- do not remove `reschedule_task_occurrence_atomic()` or the occurrence-aware `create_time_block_atomic()` until all application versions that may call them are retired;
- Habit `goal_id` and `estimated_minutes` are nullable and safe to leave in place during rollback.

Before the first production apply, capture a fresh schema/data backup and record:

- current Supabase migration version;
- staged migration output;
- RLS/ownership verification results;
- concurrent event-claim result;
- concurrent goal-completion result;
- concurrent time-block result;
- occurrence reschedule/completion/skip result and confirmation that legacy `task_completions` history remains intact;
- subtask RLS/ownership result;
- Playwright V2 vertical-slice result.

External calendar credentials, AI providers, trading integrations and team collaboration are deliberately outside these migrations.
