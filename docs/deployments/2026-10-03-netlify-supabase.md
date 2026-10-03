# Kemtit deployment — 2026-10-03

## Deployed resources

- Netlify project: `kemtit-planner`, site ID `0a3bb69d-54a6-4740-9341-b39bc7e2366f`.
- App URL: https://kemtit-planner.netlify.app
- Production deploy: `6ac058e2cbb08bf0d63ed4e7`, GitHub `main` at `f709942`.
- Netlify build, deploying, cleanup and post-processing completed successfully. Build time: 1m 44s.
- Supabase project: `ejwxcnirucsgjdggytno`.
- Supabase URL: https://ejwxcnirucsgjdggytno.supabase.co
- Production is currently protected by Netlify team login. Opening production to the public is awaiting user confirmation; previews will stay private.

## Configuration

Netlify has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the supplied publishable key), `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_FLAG_UPLOADS=0` configured. No service-role key, LINE credentials, cron secret or calendar OAuth credentials were added.

`.env.netlify.local` contains a local copy of these public deployment settings. It is ignored by Git and has mode `0600`. Development `.env.local` remains configured for local Supabase.

Supabase Auth Site URL is the production app URL. The redirect allow list contains the exact production `/auth/callback` URL. Email confirmation remains enabled.

## Database deployment and verification

Before applying migrations, Cloud had zero public tables, zero auth users, and no migration history. All 41 tracked migrations replayed successfully on a fresh local shadow database. The Cloud deployment applied them in timestamp order in one transaction, with an empty-project precondition, then recorded the 41 migration versions and reloaded PostgREST schema. The migration history is protected with RLS and no anon/authenticated privileges.

Cloud has 32 public tables; all 32 have RLS enabled. The checked-in row types for all 32 tables match generated local schema row types. Existing nullable RPC type refinements were retained. The shadow comparison found a pre-existing local function-body difference in `undo_rescue_operation`; deployment used the tracked migrations without copying local-only changes.

A transaction-based smoke test passed both locally and on Cloud:

- Users can only read their own profiles, goals and tasks.
- Own task updates succeed; foreign updates and inserts are denied.
- Foreign goal and subtask links are rejected by ownership checks.
- Goal completion is idempotent and emits exactly one completion event.
- Overlapping accepted time blocks are rejected.
- Authenticated users cannot execute the service-role-only event-claim function.
- All test users/data were rolled back; zero QA users remain.

The supplied publishable key received HTTP 200 from the Auth settings API. Unauthenticated reads of tasks, profiles and external calendar credentials received HTTP 401. The deployed login page rendered through team access; a 390px viewport had document width 390px with no horizontal overflow. This is a login-page deployment smoke check, not full authenticated production QA. Concurrent Cloud workers and full hosted onboarding have not been verified.

## Remaining setup

- Confirm whether to change hosted email OTP from eight digits to six and expiry from 3600 to 600 seconds, matching the application. This security-setting change is awaiting user confirmation.
- Supabase Free currently locks email template editing unless custom SMTP is configured (or the project is upgraded). The default magic-link template contains a sign-in link, without an OTP code. Custom SMTP details are required to configure OTP templates and verify hosted login. No paid upgrade was selected.
- Confirm opening only production to the public; the visibility form is prepared with private previews and production open, but has not been saved.
- Google login/calendar OAuth, cron and LINE remain unconfigured. LINE was explicitly deferred by the user.

Evidence and SQL used for verification are saved locally under the Git-ignored `qa-screenshots/deployment-2026-10-03/` directory. No database password or private API key is included in this report or committed.
