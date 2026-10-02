# Kemtit UX Redesign — QA Checklist

Use this checklist after applying all UX redesign migrations. Runtime checks are required before release.

## Migration / RLS

- Apply migrations through `20260920227000_google_calendar_oauth_sync.sql`.
- Run database lint.
- Verify authenticated users can read/write only their own canonical USER data.
- Verify `external_calendar_credentials` cannot be read by authenticated browser clients.
- Verify Starter suggestion/capture idempotency tables are user-isolated.
- Verify item_registry/item_links ownership checks reject cross-user links.

## First-time experience

- New OTP user → Role.
- Select Employee/Seller/Student/Freelancer.
- Select one or more Focus Areas.
- Starter Workspace appears before any starter business record is created.
- Accept one suggestion → canonical USER record exists.
- Edit + Accept → edited value is canonical.
- Skip → no canonical business record.
- Leave a suggestion untouched → it does not appear in Today/Goals/Insights.
- Google connect is optional; Skip still reaches Today.
- When Google is configured, Connect returns incomplete-onboarding users to Starter Workspace.

## Quick Capture

Verify Task, Event, Habit, Bill, Expense, Goal, Note.

- Natural-language input creates only a Proposal first.
- User can edit proposed fields before Confirm.
- Double submit/retry with same request id does not create duplicates.
- “Pay electricity bill … 1,200 THB” is classified as Bill and amount parsed.
- Bill exists once in Finance and projects to Calendar/Today as relevant; no substitute Task.
- Event remains Event; Note remains Note.
- Recent-history smart defaults are editable and never override explicit text context.

## Today

- New-user Start Here uses CTA/suggestions, no fake data.
- Priorities and due Tasks are canonical.
- Schedule includes internal Time Blocks and relevant Calendar Events.
- Routine uses real Habits/completions.
- Finance card uses real Goal/Bill context; missing finance shows setup CTA, not fake zero balance history.
- Goal progress uses counted canonical data only.
- Imported Google Event appears when it occurs today.
- Mobile layout has no essential hover-only action.

## Planner

- Year → Month → Week navigation.
- Goal objective is the same canonical Goal across Planner/Goals.
- Week shows canonical Tasks/Events/Bills in the period.
- Today link opens operational Today; there is no duplicate daily-planner business record.
- Add child/period goal uses existing Goal creation flow and relationships.

## Calendar

- Day / Week / Month render internal Event, Task/occurrence, Time Block, Bill.
- Empty state offers next action.
- USER Event create/delete works.
- Bill due date appears without creating Event/Task duplicate.
- Google imported event identity updates in place on repeated sync.
- Cancelled Google event removes only its IMPORT projection.
- Disconnect Google leaves USER Events intact.
- Expired Google sync token (410) triggers full-resync recovery.

## Finance

- No records → no fake balance/history.
- Budget can be configured for month.
- Expense and Income update deterministic monthly summary.
- Bill supports due/paid flow.
- Paying Bill creates one linked Expense and updates Bill status atomically.
- Finance Goals retain existing saving/investment/debt configuration.

## Goals + Routine

- Task/Project/Habit links to Goal remain canonical FK + shared item link projection.
- TEMPLATE/SUGGESTED/EXAMPLE data does not count toward progress/reports.
- Habit completion updates Today and Routine Insights.
- Goal progress remains deterministic.

## Insights

Check tabs:
- Overview
- Productivity
- Time
- Finance
- Goals
- Routine
- Life Balance

For every metric:
- period visible/known
- formula matches `docs/ux-redesign-analytics-definitions.md`
- USER/IMPORT only
- no unaccepted suggestion/example data
- valid empty state
- mobile readable
- no unsupported interpretation

## Navigation

Mobile:
- Today
- Plan
- +
- Insights
- More

More exposes secondary destinations. Desktop keeps canonical destinations reachable without dead links.

## Regression command gate

Run:
- lint
- typecheck
- unit tests
- build
- Supabase migration/database lint
- Playwright onboarding
- Playwright Quick Capture
- Playwright Today
- Playwright Planner/Calendar
- Playwright Finance
- Playwright Insights
- responsive desktop/tablet/mobile smoke

Do not mark release-ready when any runtime gate above has not actually been executed.
