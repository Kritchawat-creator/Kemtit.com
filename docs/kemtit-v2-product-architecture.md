# Kemtit V2 — Product Architecture & UX/UI Source of Truth

**Status:** Active architecture for V2  
**Date:** 2026-09-19  
**Supersedes:** `docs/kemtit-full-scope.md` for product architecture decisions. The old document remains as historical POC scope.

## 1. Product decision

Kemtit V2 is a **Personal Planning OS** with one promise:

> **One plan for work and life. เป้าหมาย งาน เวลา และชีวิต อยู่ในแผนเดียวกัน**

The operating loop is:

```text
Goal
  ↓
Capture
  ↓
Plan
  ↓
Schedule
  ↓
Do
  ↓
Track
  ↓
Review
  ↓
Adjust
       WORK + LIFE
```

The architectural principle is:

> **Core เดียว — Context ต่างกัน**

Seller, Professional, Health, Finance, Family, Growth, Relationships and Investment must reuse the same Goal + Project + Task + Habit + Time + Review core. Contexts may change configuration, templates, data capture and presentation, but must not duplicate planning logic.

Implementation strategy: **evolution, not rewrite**.

## 2. Architecture that remains

Keep the current modular monolith and existing boundaries:

```text
src/
├── app/
├── core/
├── modules/
├── shared-services/
└── components/
```

Keep:
- Next.js App Router
- TypeScript
- Supabase / PostgreSQL / RLS
- Server Actions
- `core/`
- `modules/`
- `shared-services/`
- domain events
- LINE infrastructure
- PWA
- Zod
- Goal Cascade
- goal progress engine
- metric entries
- Compass visual language

Modules must not import each other. Reuse Core or ports/events for cross-context behavior.

## 3. Context model

Do not model the product around Persona.

V2 model:

```text
User
├── Work Mode
│   ├── seller
│   └── professional
└── Life Areas
    ├── health
    ├── family
    ├── finance
    ├── growth
    └── relationships
```

Every user has one Work Mode and can use every Life Area. Today defaults to scope `all`.

### WorkMode

```ts
type WorkMode = "seller" | "professional";
```

Seller covers online seller, small business, freelance commerce and social commerce.

Professional covers developer, designer, marketing, sales, HR, accounting, project coordination and other knowledge work.

### Existing life domains

Keep the existing internal domain values:

```text
work
health
family
finance
growth
relationships
```

UI terminology changes from **Domain** to **Area / ด้านชีวิต**. Internal names may remain `domain` to avoid unnecessary refactors.

## 4. Profile migration

Additive first:

```text
user_profiles.work_mode
  seller | professional

user_profiles.default_scope
  all | work | life
```

Compatibility mapping:

```text
seller -> seller
office -> professional
```

`creator` and `student` are disabled today and are not blockers. Audit production data before backfill.

Keep `active_persona` during the transition. Deprecate only after all consumers move to `work_mode`.

## 5. Core planning model

### 5.1 Goals

Keep the current Goal Cascade and metric/execution behavior. Goals may link directly to Tasks or contain Projects.

### 5.2 Projects — new core

Add `src/core/projects/` and `projects`.

Required fields:

```text
id
user_id
goal_id nullable
domain
title
description
status
start_date
target_date
archived_at
created_at
updated_at
```

Relationship:

```text
Goal
 ↓
Project
 ↓
Task
```

A Task may still link directly to a Goal without a Project.

### 5.3 Tasks — major upgrade

Target Task model:

```text
title
notes
goal_id
project_id
domain
status
priority
estimated_minutes
due_date nullable
recurrence
completed_at
archived_at
deleted_at
```

Priority:

```text
high
normal
low
```

Status:

```text
inbox
planned
completed
archived
```

Inbox is a task state. Do not create an `inbox_items` table.

Quick capture example:

```text
title = "โทรหาขนส่ง"
status = inbox
due_date = null
```

### 5.4 Recurrence — occurrence model

The current `task + task_completions` model cannot independently schedule each occurrence.

Add `task_occurrences`:

```text
id
task_id
occurrence_date
scheduled_start
scheduled_end
status
completed_at
skipped_at
unique(task_id, occurrence_date)
```

Rescheduling one occurrence must not change future occurrences. Deleting a series must not immediately destroy historical completion data.

### 5.5 Habits — separate from recurring tasks

Add:
- `src/core/habits/`
- `habits`
- `habit_completions`

Habit fields:

```text
title
domain
goal_id
target_count
target_period
estimated_minutes
active
```

### 5.6 Daily planning

Add `src/core/planning/`.

Core flow:

```text
Yesterday unfinished
       ↓
Inbox
       ↓
Pick today's tasks
       ↓
Capacity Check
       ↓
Schedule
       ↓
Start Day
```

Daily plan concepts:
- date
- available_minutes
- planned_minutes
- top priorities

### 5.7 Time blocking

Add `time_blocks`:

```text
id
user_id
task_occurrence_id nullable
start_at
end_at
source
created_at
```

Source:

```text
manual
kemtit
google
outlook
```

Calendar evolves from **Due Date Calendar** into a **Planning Timeline**.

### 5.8 Capacity engine

Pure calculation:

```text
availableMinutes
- meetingMinutes
- plannedTaskMinutes
= remainingCapacity
```

This is a signature Kemtit feature and must stay in Core, not in Seller/Professional.

### 5.9 Weekly review

Add:
- `src/core/reviews/`
- `weekly_reviews`

Persist only reflection:

```text
week_start
wins
blockers
next_focus
created_at
```

Compute task completion, focus time, goal progress, sales and habit metrics from source data rather than duplicating them in review rows.

## 6. Work modules

### Seller

Keep and expand `src/modules/seller/`.

Target responsibilities:
- templates
- sales
- widgets
- onboarding
- insights

Seller-specific capabilities:
- revenue goals
- sales entries
- sales channels
- daily revenue
- monthly progress
- campaigns

Do not move planning logic into Seller.

### Professional

Add `src/modules/professional/`.

This module contains:
- templates
- widgets
- onboarding presets
- labels/config

Core remains responsible for Projects, Tasks, Calendar, Daily Plan, Goals and Reviews.

Professional presentation may surface:
- project goals
- meeting load
- focus time
- weekly work review

## 7. Finance and investment

Investment V1 is goal planning, not a trading product.

Use:
- finance metric goals
- `goal_entries` for contributions
- habits for contribution cadence
- tasks for transfers
- LINE reminders

Do not build:
- stock prices
- broker integration
- buy/sell execution
- portfolio optimization

Optional config metadata is acceptable for non-query configuration, for example:

```json
{
  "financeType": "investment",
  "strategy": "dca"
}
```

Queryable/filterable data should use real columns/tables.

## 8. Goal entry cleanup

Current `goal_entries` contains Seller-specific `channel` data. Long-term target:

Core:

```text
goal_entries
id
goal_id
amount
date
note
```

Seller:

```text
seller_sales_entries
goal_entry_id
channel
order_count
```

Do this only after Planning Core stabilizes.

## 9. LINE

Preserve the existing LINE infrastructure and extend event coverage:

```text
daily.plan.ready
daily.brief
weekly.review.ready
habit.reminder
investment.reminder
```

Keep notification infrastructure context-agnostic. Message composition can vary by Work Mode.

## 10. Information architecture

### Mobile

Bottom navigation:

```text
วันนี้ | Inbox | + | ปฏิทิน | เป้าหมาย
```

Profile/settings are reached from the top avatar, not a primary bottom item.

### Desktop

```text
MAIN
วันนี้
Inbox
ปฏิทิน
เป้าหมาย
รีวิว

WORK
Seller: ยอดขาย
Professional: โปรเจกต์

LIFE
ชีวิต
การเงิน

ตั้งค่า
```

Do not list every Life Area in the sidebar. Health/Family/Growth/Relationships are filters within Life.

### Canonical routes

```text
/today
/inbox
/calendar
/goals
/reviews
/life
/finance
/settings
/work/sales
/work/projects
```

Compatibility:

```text
/dashboard -> /today
/tasks -> /inbox?view=planned
/entries -> /work/sales
```

Remove dead Reports navigation.

## 11. Today is the product home

The home screen is an action dashboard, not an analytics dashboard.

Required order:
1. greeting
2. scope switcher: All / Work / Life
3. primary direction / Compass
4. Top 3 important tasks
5. capacity summary
6. Plan Today action

Do not lead with four KPI cards.

## 12. Inbox

Quick Capture must take seconds.

Initial add asks only:
- title
- optional quick chips

Details are edited later.

Task detail progressively reveals:
- priority
- duration
- due date
- scheduled time
- area
- goal
- project
- notes
- subtasks
- recurrence
- attachments

## 13. Calendar

Mobile:
- day timeline
- schedule action instead of relying on drag

Tablet:
- calendar + unscheduled panel

Desktop:
- 8-column calendar area
- 4-column planning sidebar

Drag unscheduled tasks into time slots on Tablet/Desktop after the internal scheduling model is stable.

## 14. Context views

### Life

Life is calmer than Seller analytics.

Show:
- health
- finance
- family
- growth
- today's habits

### Finance

Show savings, debt and investment goals plus monthly contributions. No market charts.

### Professional

Surface:
- active goal
- projects
- meeting load
- focus availability
- planned workload
- capacity status

### Seller

Surface:
- monthly revenue progress
- today's revenue
- required daily pace
- tasks
- campaigns
- orders / sales entry

## 15. Responsive contract

One system-wide breakpoint contract:

```text
Compact  < 768
Medium   768-1023
Expanded >= 1024
```

Prefer one DOM structure + CSS Grid.

Avoid page-level JS responsive tree switching. JS breakpoints are for interactions that truly differ.

Shell:
- Compact: top app bar + content + bottom nav + FAB
- Medium: 72px navigation rail + content + optional detail pane
- Expanded: 240px sidebar + utilities + 1200-1440px content

## 16. Design direction

Keep:
- Lavender brand
- Peach accent
- IBM Plex Sans Thai
- Compass Dial
- rounded surfaces
- domain color system
- Thai-first copy

Reduce:
- breadcrumbs on top-level pages
- KPI overload
- repeated pink CTAs
- 11px functional text
- nested card stacks
- separate mobile/desktop product personalities

Use Peach sparingly for:
- FAB
- important marker
- Compass destination
- critical primary moment

Normal primary actions use Lavender.

Custom dashboard / drag-and-drop is deferred. Kemtit owns the Today information hierarchy during V2.

## 17. New folders

Add when implementation reaches the corresponding phase:

```text
src/core/projects/
src/core/habits/
src/core/planning/
src/core/time-blocks/
src/core/reviews/
src/modules/professional/
src/modules/finance/
src/app/(app)/today/
src/app/(app)/inbox/
src/app/(app)/reviews/
src/app/(app)/life/
src/app/(app)/finance/
src/app/(app)/work/
```

Rework rather than rewrite:
- AppShell
- Sidebar
- BottomNav
- PageHeader
- TaskForm
- TaskList
- GoalCard
- CalendarMonth
- CalendarWeek
- QuickAddHost
- GoalProgressPanel

Preserve logic unless change is required:
- CompassDial
- DomainTag
- ProgressBar
- EmptyState
- ResponsiveDialog
- Button/form primitives
- Avatar
- Toast

## 18. Implementation phases

### Phase 0 — stabilize existing core

Must be completed before schema expansion:
- authenticated PWA cache safety
- profile-query redirect loop
- Goal parent cycle protection
- cascade atomicity
- recurring task delete/reschedule semantics
- duplicate LINE event processing
- dead navigation
- CI full-regression E2E

### Phase 1 — architecture foundation

Profile:
- add `work-modes.ts`
- add `scope.ts`
- additive columns `work_mode`, `default_scope`
- maintain compatibility with `active_persona`

### Phase 2 — data-model foundation

Add:
- projects
- task_occurrences
- habits
- habit_completions
- time_blocks
- weekly_reviews

Extend tasks:
- nullable `due_date`
- status
- priority
- estimated_minutes
- notes
- project_id
- archived_at
- deleted_at

Every table requires:
- user ownership
- RLS
- indexes for query paths

### Phase 3 — app shell redesign

Refactor shell/navigation and remove page-level `ResponsiveSwitch` dependency.

### Phase 4 — daily workflow

Implement:
- `/today`
- `/inbox`
- quick capture
- priority
- duration
- subtasks / notes
- projects
- top 3
- capacity

Success flow:

```text
think -> capture -> plan -> schedule -> complete
```

### Phase 5 — planning calendar

Internal scheduling first. External calendar later.

### Phase 6 — work modes

Seller and Professional must configure the same Core.

### Phase 7 — life platform

Use Core Goal/Habit/Task rather than one table per Life Area.

### Phase 8 — weekly review + LINE

Add reviews and brief/reminder/shutdown flows.

### Phase 9 — external calendar

Order:
1. Google read-only
2. show Google busy blocks
3. Kemtit creates time blocks
4. two-way Google sync
5. Outlook

### Phase 10 — AI

Only after priority, duration, availability, calendar, history and goals exist.

AI planning flow:

```text
Suggest -> Preview -> Confirm
```

Never silently rearrange the user's calendar.

## 19. Testing and CI

Unit:
- Goals
- Projects
- recurrence/occurrences
- Capacity
- Habits
- Planning
- Finance metrics

Integration:
- RLS
- Goal -> Project -> Task
- recurring occurrence
- habit completion
- time blocks

E2E:
- onboarding
- quick capture
- plan day
- schedule task
- complete task
- goal progress
- weekly review
- Seller sales
- Professional project
- Life habit
- Investment goal

Responsive targets:
- 390px
- 768px
- 1024px
- 1440px

CI cannot stop at lint/typecheck/unit/build/uploads. At minimum it must add:
- Core mobile journey
- Desktop smoke
- Tablet smoke

## 20. Migration safety

Every migration must be:
- additive before destructive
- backfilled before field removal
- RLS-enabled with table creation
- indexed for real query paths
- represented in generated DB types
- paired with rollback/data-recovery notes
- compatible with legacy routes/fields during transition

Do not edit production schema manually through Studio.

## 21. Definition of Done

Architecture:
- Work Mode is independent of Life
- Seller and Professional use one Core
- Life works for every Work Mode
- module import boundary remains enforced
- no unnecessary persona logic in Core
- every user table has RLS

Functionality:
- login
- choose Seller/Professional
- create work goal
- create life goal
- quick capture
- inbox
- daily plan
- time block
- complete task
- metric/habit update
- weekly review

UX:
- Mobile communicates what matters today, goal state and capacity within seconds
- Tablet is a real planning workspace
- Desktop increases density without changing the core workflow/personality

## 22. Hard scope boundaries

During V2 redesign:
- do not change brand palette without a new decision
- do not replace Compass signature
- do not add AI before Planning Layer
- do not add team collaboration
- do not turn Kemtit into project-management SaaS
- do not build trading/stock systems
- do not invent new personas/work modes
- do not move business logic into UI
- do not bypass RLS
- do not use service_role on normal user request paths
- do not rewrite working Core only for file-structure aesthetics
- do not use a big-bang migration

## 23. Phase 0 audit — 2026-09-19 (verification update)

The current worktree contains the following Phase 0 hardening. These are implementation facts observed in source/migrations; they are not yet a substitute for staging or production validation:

1. **Authenticated PWA cache:** `src/app/sw.ts` forces dynamic same-origin GETs and non-approved cross-origin requests through `NetworkOnly`, and removes legacy sensitive runtime caches on activation. Static build assets remain cacheable.
2. **Profile error separation:** `src/core/profile/queries.ts:getMe()` throws `profileUnavailable` for a query failure or missing profile row instead of returning the unauthenticated `null` sentinel.
3. **Goal cycles:** the Phase 0 migration replaces the parent trigger function with an ancestor walk, covering self-parent and multi-level cycle attempts while preserving same-owner enforcement.
4. **Cascade atomicity:** `createGoalCascade()` calls the `create_goal_cascade` PostgreSQL function, so the goal/event/task cascade is rolled back as one database statement when a nested insert fails.
5. **Recurring-task history:** tasks are soft-archived with `archived_at`; recurring reschedule is rejected until per-occurrence storage exists, so deleting or moving a series cannot silently rewrite its history.
6. **LINE duplicate protection:** notification sends reserve a unique `sourceEventId` before the provider call, release only explicit provider failures, and leave ambiguous network outcomes reserved to prefer no duplicate delivery.
7. **Navigation:** dead `/entries` and `/tasks` links are no longer exposed by the shell; route coverage is handled separately by the current app routes. Disabled Reports is not shown.
8. **CI coverage:** `.github/workflows/ci.yml` now includes the compact mobile core journey plus desktop and tablet smoke jobs, in addition to lint/typecheck/unit/build and the uploads flow.

### Verification completed in this checkout

- `pnpm test`: 19 files, 91 tests passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: 0 errors, 3 existing React Hook Form compatibility warnings.
- `pnpm build`: passed with the Webpack build path.
- `git diff --check`: reports an existing trailing blank-line warning in `AGENTS.md`; no source-format failure was introduced by this audit update.

### Remaining release gates

- Run Supabase migration/RLS checks in a permitted local or CI environment; the local `supabase db lint --local` attempt was blocked before validation because the CLI could not write its telemetry file under `~/.supabase`.
- Execute the new Playwright core, desktop, and tablet jobs against a real local Supabase stack.
- Add an integration test for concurrent notification reservation/failure recovery before treating LINE idempotency as fully proven.
- The Phase 1/2 contract gate is now represented by the V2 vertical slice in §25; production promotion still requires staged RLS/migration validation, timezone/DST verification, and the rollback runbook in `docs/v2-migration-rollback.md`.

## 24. Execution guardrail

GitNexus is available for this checkout and must remain the edit gate for non-trivial source changes.

Repository: `Kemtit.com`  
Worktree: `/Users/kritchawatpattharawiwatkul/Documents/Kritchawat-Projects/Kemtit.com`  
Indexed commit: `7ab4449`  

The pre-edit impact checks for the current Phase 0 review found:

- `createGoalCascade`: **LOW**, with onboarding goal creation as the direct caller.
- `processEvents`: **LOW**, with the cron route as the direct caller.
- `toggleTask`: **CRITICAL** because it feeds TaskList, Today, Calendar, Goal Detail, and related flows; do not change it casually.

Before committing any further implementation, run `detect_changes({scope: "all"})`, review affected flows, and repeat the relevant tests and migration checks. Phase 1 remains gated by the unresolved contracts above rather than by visual polish alone.

## 25. V2 vertical slice implementation — 2026-09-19

The approved contracts are now represented in the application as an additive vertical slice:

- `work_mode` (`seller|professional`) and `default_scope` (`all|work|life`) are stored independently from the legacy `active_persona`; onboarding now offers Seller and Professional and projects the choice to the legacy field for compatibility.
- The planning foundation migration adds Projects, nullable task dates, task state/priority/notes/estimates, task occurrences, habits, habit completions, daily plans, time blocks, and weekly reviews with ownership checks, RLS, indexes, and rollback notes.
- `/today` is the canonical product home; `/inbox` captures unplanned tasks and promotes them into a dated plan; `/reviews`, `/work/projects`, `/life`, and `/finance` are functional shared-core views. `/dashboard`, `/tasks`, and `/entries` remain compatibility redirects.
- Internal time blocking is implemented first. Capacity is a pure function with tests. Google/Outlook adapters and AI remain intentionally outside this vertical slice until credentials/provider contracts and the planning history are available.
- Existing task completion, goal cascade, photo, LINE, and legacy seller flows remain on the same server actions and are revalidated for the canonical routes.

Verification for this slice must include the full test/type/build checks, migration lint in an environment where the Supabase CLI can write its telemetry file, and real local Supabase/Playwright journeys after the migration is applied.
