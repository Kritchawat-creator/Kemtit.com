# Kemtit.com — Current State Audit, Gap Analysis & Implementation Order

**Document:** `Kemtit_Current_State_Audit.md`  
**Audit date:** 2026-09-20  
**Primary source of truth:** `Kemtit_UX_Redesign_Implementation_Plan.md`  
**Audit mode:** Repository-level static review only. No business/schema implementation changes were made in this phase.

---

## 1. Executive Summary

The current Kemtit codebase is **not a rewrite candidate**. It already has a useful modular-monolith foundation and several parts of the target product loop are working:

- Next.js App Router + Server Actions
- Supabase/PostgreSQL + RLS
- `core/`, `modules/`, `shared-services/`
- Today as the current landing surface
- Goal cascade with Year/Month/Week period engine
- Task Inbox, recurring task occurrences, priorities and daily planning
- Internal time blocks
- Projects
- Habits + habit completions
- Goal ↔ Task, Goal ↔ Project, Goal ↔ Habit relationships
- Finance-oriented metric goals
- Weekly review metrics
- Mobile center FAB / global Quick Add host
- Shared `EmptyState` and responsive dialog primitives
- E2E coverage for major V2 flows

The new UX redesign should therefore be implemented as **evolution + compatibility layers**, not by replacing the existing application.

However, the current implementation has several structural gaps that must be resolved before adding the full redesign:

### Critical dependency 1 — generated onboarding data is currently real user data

The current onboarding path creates a goal cascade and generated sample tasks directly in the normal `goals` / `tasks` tables. These generated tasks then behave like real user activity and can affect task counts, progress and future analytics.

This conflicts with the new rule:

> TEMPLATE / SUGGESTED / EXAMPLE must not be treated as USER data until explicitly accepted.

This is the most important data-semantics gap to solve before building Insights.

### Critical dependency 2 — no shared identity/source layer exists across modules

The existing system has good direct relationships such as:

- Goal → Project
- Goal → Task
- Project → Task
- Goal → Habit
- Task/Occurrence → Time Block

But there is no generic identity/linking layer that can represent one real-world item across Today, Planner, Calendar, Finance and reminders.

Without that layer, implementing a Bill or Event by creating separate records in multiple modules would produce the exact duplicate-business-record problem the redesign forbids.

### Critical dependency 3 — Finance is not yet a personal finance transaction domain

Current Finance is goal-driven:

- finance metric goals
- saving / investment / debt classification
- `goal_entries` as contributions

It does **not** currently model:

- income
- expenses
- bills
- budget categories
- bill due dates
- recurring bills
- monthly budgets

Therefore the target Quick Capture example:

`Pay electricity bill this Friday, 1,200 THB`

cannot yet be persisted correctly as a Finance item without first adding an appropriate finance domain model.

### Overall recommendation

Keep the current core and progressively add:

1. data-state semantics,
2. role/focus configuration,
3. suggestion/starter-workspace layer,
4. Universal Quick Capture proposal/confirmation,
5. shared identity/linking compatibility layer,
6. planner/calendar/finance projections,
7. Insights only after source semantics are reliable.

---

# 2. Audit Scope

Reviewed areas:

- repository structure
- application routes
- Today
- dashboard compatibility path
- navigation
- onboarding
- profile/work mode/persona model
- goals and period hierarchy
- tasks/inbox/recurrence
- projects
- daily planning
- time blocks/calendar
- habits/routine
- finance and metric entries
- weekly reviews
- global Quick Add
- empty states
- Supabase migrations/data model
- current E2E coverage
- historical V2 architecture documents for compatibility context

Not performed in this phase:

- no source-code changes
- no schema migration
- no architecture rewrite
- no build/test execution
- no browser QA
- no Google OAuth implementation
- no AI/classification implementation

The repository connector available for this audit is read/write-capable but has no shell execution capability, so this document distinguishes **static verification** from runtime verification.

---

# 3. Current Architecture Map

```text
Next.js App Router
│
├── src/app
│   ├── (auth)
│   │   └── onboarding
│   ├── (app)
│   │   ├── today
│   │   ├── inbox
│   │   ├── calendar
│   │   ├── goals
│   │   ├── finance
│   │   ├── life
│   │   ├── reviews
│   │   ├── tasks
│   │   ├── entries
│   │   ├── work
│   │   └── settings
│   └── api
│       ├── cron
│       └── line
│
├── src/core
│   ├── domain
│   ├── goals
│   ├── tasks
│   ├── projects
│   ├── planning
│   ├── habits
│   ├── finance
│   ├── entries
│   ├── reviews
│   ├── profile
│   └── events
│
├── src/modules
│   ├── seller
│   ├── professional
│   └── finance
│
├── src/shared-services
│   ├── events
│   ├── jobs
│   └── notifications
│
└── Supabase/PostgreSQL
    ├── user_profiles
    ├── goals
    ├── projects
    ├── tasks
    ├── task_occurrences
    ├── task_completions
    ├── task_subtasks
    ├── habits
    ├── habit_completions
    ├── daily_plans
    ├── time_blocks
    ├── goal_entries
    ├── finance_goal_details
    ├── weekly_reviews
    └── domain_events
```

### Assessment

**Keep this modular-monolith shape.**

It already aligns with the redesign guardrail that domain/service boundaries should reflect responsibility rather than UI pages.

Do not introduce microservices or a second backend.

---

# 4. Current User Flow Map

## 4.1 Current onboarding

```text
OTP login
  ↓
Choose Work Mode
  ├── Seller
  └── Professional
  ↓
Create first goal
  ↓
Module template generates goal cascade + sample tasks
  ↓
Persist immediately as normal goal/task rows
  ↓
Mark onboarding complete
  ↓
Today
```

### Gap against target

Target:

```text
Sign up
  ↓
Role
  ↓
Focus Areas
  ↓
Optional Connections
  ↓
Starter Workspace Preview
  ↓
Suggested Starter Plan
  ↓
Add / Edit / Skip
  ↓
Today
```

The current flow is materially different because it turns template-generated records into normal user records before an item-by-item confirmation step.

---

## 4.2 Current daily planning loop

```text
Inbox
  ↓
Plan task for a date
  ↓
Today
  ↓
Select Top Priorities
  ↓
Create Time Block
  ↓
Complete Task
  ↓
Weekly Review
```

This is a strong reusable flow.

---

## 4.3 Current goal planning loop

```text
Goal
  ↓
Goal children by period
  ↓
Project optional
  ↓
Task
  ↓
Task completion / metric entry
  ↓
Goal progress
```

The existing period engine already supports the intended visible hierarchy:

```text
Year → Month → Week
```

Today can remain the execution projection. A new Planner should orchestrate existing records rather than duplicate them.

---

## 4.4 Current capture flow

Global FAB:

```text
+
  ↓
Choose type first
  ├── Task Form
  ├── Goal Form
  └── Entry Form
```

Other capture surfaces also exist:

- Today quick task
- Inbox task capture
- Goal metric quick entry
- Habit create form
- Time block form

### Gap

The app has a **global entry point visually**, but not a Universal Quick Capture behaviorally.

Target:

```text
+
  ↓
Natural language
  ↓
Prepare structured proposal
  ↓
Suggest defaults
  ↓
Confirm
  ↓
Create canonical item
  ↓
Auto-connect projections
```

---

# 5. Current Data Model Map

## 5.1 Existing strong relationships

```text
Goal
├── parent Goal
├── Project
│   └── Task
├── Task
├── Habit
└── Goal Entry

Task
├── Task Occurrence
├── Task Completion
├── Subtask
└── Time Block

Habit
└── Habit Completion

Daily Plan
└── top priorities (task ids stored as text array)

Weekly Review
└── reflection only; metrics computed from source data
```

This is a good foundation and should be preserved.

---

## 5.2 Missing shared identity

There is currently no equivalent of:

```text
CoreItem / ItemRegistry
ItemLink
ItemSource
```

There is also no common source classification on Goals, Tasks, Habits, Finance records such as:

```text
SYSTEM
TEMPLATE
SUGGESTED
USER
IMPORT
```

### Important terminology warning

`domain_events` is an internal event log / side-effect queue.

It is **not** a Calendar Event business entity and must not be repurposed as one.

---

## 5.3 Existing source field that should not be over-interpreted

`time_blocks.source` supports database values:

- manual
- kemtit
- google
- outlook

But the application-side planning schema currently allows only:

- manual
- kemtit

There is no Google OAuth, external account identity, external calendar id, external event id or synchronization state.

Therefore this field is an extension hook, **not an existing Google Calendar integration**.

---

# 6. API / Application Boundary Map

Kemtit currently uses **Server Actions + Core queries** as its primary application interface.

`src/app/api` is mainly integration/operational infrastructure such as:

- cron
- LINE webhook/integration

The redesign document shows routes such as:

```text
POST /api/items/capture
POST /api/items/confirm
GET  /api/insights/overview
```

as examples only.

### Recommendation

Do not create a parallel REST API layer merely to match those sample paths.

Prefer the existing conventions:

```text
UI
 ↓
Server Action / Server Query
 ↓
Core service/domain
 ↓
Supabase
```

Introduce route handlers only where there is a concrete need such as:

- OAuth callbacks
- external webhooks
- streaming/model integration
- third-party API contracts

For Quick Capture, a future pair such as:

```text
prepareCapture()
confirmCapture()
```

can initially remain Server Actions/services and still satisfy the product architecture.

---

# 7. Current State vs Target — Gap Matrix

| Area | Current | Target | Gap | Reuse | Change Required | Risk |
|---|---|---|---|---|---|---|
| Onboarding | Seller/Professional → first goal → direct template cascade | Role + Focus Areas + optional connection + Starter Preview + Add/Edit/Skip | Major | Auth, onboarding gate, responsive components, template generators | Recompose flow; add role/focus config; convert templates into proposals | **High** |
| Role model | `work_mode = seller/professional`; legacy `active_persona` | Employee/Seller/Student/Freelancer | Major | Compatibility mapping | Add target role layer/config without breaking existing work-mode consumers | **High** |
| Focus Areas | No onboarding focus-area model | Work, Daily Life, Finance, Health, Study | Missing | Existing internal domains | Add preference/config layer; do not expand core domain enum unnecessarily | Medium |
| Data semantics | No common SYSTEM/TEMPLATE/SUGGESTED/USER/IMPORT semantics | Explicit source/data classes | Missing | Existing tables | Add additive semantics before analytics | **Critical** |
| Starter Workspace | First-goal template writes real records | System structure + unaccepted suggestions | Major | Existing template code | Convert generation to suggestion preview/accept flow | **Critical** |
| Today | Real operational page with priorities, tasks, schedule, capacity, goal progress | Operational center incl. Routine, Finance, Suggestions, first-day state | Partial | **Strong reuse** | Extend data composition and states | Medium |
| Quick Capture | Global + exists, but type-first Task/Goal/Entry menu | Natural-language universal capture | Major | FAB, QuickAddHost, dialogs, existing create actions | Replace interaction logic; preserve manual forms as fallback | **High** |
| Tasks / Inbox | Mature task state, Inbox, recurrence, occurrences | Connected task behavior | Strong | **Reuse** | Add source/identity participation; maintain existing behavior | Medium |
| Goals | Mature cascade, metric/execution, Year/Month/Week support | Goal → Planner → actions → progress | Strong | **Reuse** | Add source semantics and planner projection | Low-Medium |
| Planner | Daily plan exists; hierarchy spread across Goals/Today/Calendar; no `/plan` | Year → Month → Week → Today | Partial | Period engine, Goals, daily plans | Add Planner orchestration UI; avoid new duplicate planning records | Medium |
| Calendar | Day/week/month from tasks + time blocks | Internal calendar + tasks/events/bills + provider sync | Partial | Calendar UI, time blocks | Add canonical event/link model as required; provider layer later | **High** |
| Google Calendar | No real integration | Optional external provider | Missing | `time_blocks.source` concept only | OAuth/account/provider identity/sync rules | High |
| Finance | Finance goals + contributions; saving/investment/debt | Budget, bills, expenses, savings, linked finance context | Major | Goal-based savings/investment can remain | Add finance primitives; do not overload `goal_entries` into a ledger | **Critical** |
| Routine / Habits | Habit + completion + goal link; shown under Life | Routine connected to Today + Insights | Partial-strong | **Strong reuse** | Project habits into Today; add routine reporting rules | Medium |
| Reviews | Weekly reflection + computed task/habit/time metrics | Insights analytical center | Partial foundation | Metric queries and reflection | Keep Reviews; build separate Insights query layer/UI | Medium |
| Insights | No `/insights` route | Overview/Productivity/Time/Finance/Goals/Routine/Life Balance | Missing | Existing query functions | Add after data semantics + finance/linking stabilize | **High if done early** |
| Empty states | Shared `EmptyState` with one action | Explanation + primary/secondary + suggested examples | Partial | **Reuse** | Extend component contract and module states | Low |
| Navigation | Mobile Today/Inbox/+/Calendar/Goals | Today/Plan/+/Insights/More | Major IA difference | Existing shell/FAB | Incremental navigation change with route compatibility | Medium |
| Notifications | Existing preferences + domain-event producers | Same canonical item links | Partial | Notification infra | Add item/link reference rather than duplicated task-like reminders | Medium |
| Timezone | Bangkok helpers / explicit +07 in planning | User-timezone-aware | Gap | Existing date helpers | Add user timezone preference/default and migrate query boundaries gradually | Medium |
| Reporting data | Weekly metrics read source rows | Same-source analytical layer | Good principle | **Reuse** | Formalize metric definitions and source filtering | Medium |

---

# 8. Reuse / Refactor / Replace / Add Matrix

## REUSE

Keep these concepts and implementations unless an impact review proves otherwise:

- Next.js App Router
- Server Actions
- Supabase + PostgreSQL + RLS
- `core/` / `modules/` / `shared-services/`
- Goal Cascade engine
- Year/Month/Week period functions
- Projects
- Tasks
- Inbox task state
- recurring task occurrences
- subtasks
- task priorities
- Habits + completions
- Daily Plan
- Time Blocks
- Weekly Review reflection
- domain-event/notification infrastructure
- responsive dialogs/sheets
- existing calendar presentation components
- current E2E vertical slices

## REFACTOR / EXTEND

- Today data composition
- EmptyState contract
- QuickAddHost
- QuickAddMenu/FAB behavior
- Onboarding orchestration
- profile configuration
- role-based navigation/config
- Calendar data source composition
- Finance UI/domain boundaries
- metric-query functions for Insights

## REPLACE BEHAVIOR, NOT INFRASTRUCTURE

- type-first Quick Add interaction
- direct template-to-user-record onboarding behavior
- first-goal-as-mandatory-onboarding-completion model
- current mobile information architecture after new Plan/Insights are ready

## ADD

- role configuration for Employee/Seller/Student/Freelancer
- focus-area preferences
- Starter Workspace service
- suggestion model/service
- SYSTEM/TEMPLATE/SUGGESTED/USER/IMPORT semantics
- SuggestedItem UX
- ConfirmSheet
- Universal Quick Capture proposal model
- shared identity/linking compatibility layer
- Planner route/surface
- canonical Calendar Event capability if required by detailed design
- external calendar account/event mapping
- real finance primitives
- Insights query layer + routes
- metric definitions
- user timezone preference
- telemetry events for redesign flows

---

# 9. High-Risk Findings

## R1 — Onboarding template contamination

### Evidence

Current first-goal action calls a module template and then `createGoalCascade()`.

Seller and Professional templates generate child goals and sample tasks. The cascade RPC writes them to normal business tables.

### Impact

Generated starter content can be interpreted as actual user work:

- Today/task counts
- completion metrics
- productivity reporting
- future Insights
- notifications

### Required direction

Template generation must become:

```text
Template
  ↓
Suggestion proposal
  ↓
User Add/Edit/Skip
  ↓
USER record only after confirmation
```

Do not build Insights before this is resolved.

---

## R2 — Role migration conflict

Current:

```text
work_mode:
seller | professional

legacy active_persona:
seller | creator | student | office
```

Target:

```text
employee | seller | student | freelancer
```

The current database constraints cannot simply accept the new role values by writing them into `active_persona` or `work_mode`.

### Recommended compatibility direction

Do **not** repurpose `active_persona`.

Prefer an additive role configuration such as a target role field/profile model while keeping `work_mode` as a compatibility projection during rollout.

Example conceptual mapping:

```text
seller     → existing seller work behavior
employee   → existing professional work behavior + employee config
freelancer → existing professional/shared core + freelancer config
student    → shared core + student config
```

Exact schema should be approved in the implementation migration design, not changed during this audit.

---

## R3 — Finance cannot support target Bill/Expense semantics yet

`goal_entries` is a metric-goal contribution table. It has:

- goal id
- amount
- date
- optional seller channel

It should not be stretched into a general financial ledger.

A bill needs different semantics:

- payee/title
- amount
- due date
- paid/unpaid state
- category
- recurrence
- optional budget relationship
- reminder/schedule projection

A general expense needs yet another transaction semantic.

### Required direction

Create finance-domain primitives deliberately, then connect them through shared identity/linking.

Do not create a fake “bill task + goal entry + time block” trio.

---

## R4 — Shared identity is required before full auto-connect

Current direct foreign keys are useful but type-specific.

The redesign needs a way to say:

```text
one canonical Electricity Bill
  ├── visible in Today
  ├── visible in Finance
  ├── scheduled/reminded in Calendar
  └── represented in Planner if relevant
```

without four independent business records.

### Direction

Introduce an additive compatibility layer rather than merging all existing tables into one mega-table.

Possible target concept:

```text
Item Registry / Core Identity
        +
Typed domain record
        +
Item Links / Projections
```

The exact table layout remains a Phase-1/Phase-5 engineering decision after impact analysis.

---

## R5 — Insights would currently be semantically unsafe

The existing weekly review correctly calculates metrics from source data rather than copying totals. That principle is good.

But the source data currently does not distinguish:

- accepted user data
- generated template content
- suggestions
- imported data

Therefore a polished chart can still be mathematically correct but product-semantically wrong.

### Rule

Insights must wait until accepted/user/source semantics are queryable.

---

# 10. Today Audit

## Current strengths

Current Today already provides:

- current date
- scope
- top priorities
- due/overdue/done tasks
- schedule/time blocks
- capacity information
- weekly task progress
- goal progress
- task detail interactions
- day-plan settings

The old `/dashboard` route redirects to `/today`, so Today is already the product home.

## Missing target surfaces

Add progressively:

- Routine
- Finance Snapshot
- Smart Suggestions
- first-day Start Here state
- Starter Workspace state
- Universal Quick Capture instead of task-only inline capture
- optional linked external calendar events later

## Recommendation

**Refactor Today; do not replace it.**

---

# 11. Planner Audit

The current period engine already explicitly supports visible POC planning:

```text
Year → Month → Week
```

and `childPeriodType()` maps:

```text
year  → month
month → week
week  → execution/task
```

This is highly aligned with the new requirement.

### Current fragmentation

Planning is currently spread across:

- Goals for period hierarchy
- Inbox for unplanned tasks
- Today for daily execution
- Daily Plan for priorities/capacity
- Calendar for scheduling

There is no `/plan` route.

### Recommendation

Create Plan as an orchestration/projection layer over existing goals/planning data.

Do **not** add separate `year_plans`, `month_plans`, `week_plans` tables unless later requirements prove they hold unique data not represented by Goal/Planning relationships.

Target:

```text
/plan?view=year
/plan?view=month
/plan?view=week
        ↓
Today for execution
```

Keep Today out of a duplicate daily-planner route.

---

# 12. Quick Capture Audit

## Reusable infrastructure

- center mobile FAB
- global QuickAddHost
- ResponsiveDialog
- existing TaskForm
- existing GoalForm
- existing Habit/Entry actions
- server-side validation conventions

## Missing behavior

No natural-language capture pipeline.

No support in global capture for:

- EVENT
- HABIT
- BILL
- EXPENSE
- NOTE

No capture proposal state.

No confidence/uncertainty state.

No compact confirmation surface.

No idempotency token for universal confirm.

## Recommended staged rollout

To preserve the source-of-truth implementation order without creating invalid domain records:

### Quick Capture A — UX/proposal foundation

Implement:

```text
input
→ deterministic parse
→ type proposal
→ structured proposal
→ confirm UI
```

Initially wire only types whose canonical data model is already safe.

Keep old forms as manual fallback.

### Shared Linking

Add identity/linking compatibility layer.

### Quick Capture B — complete type enablement

Enable EVENT/BILL/EXPENSE/NOTE only after their canonical typed storage exists.

This prevents the UI from getting ahead of data integrity.

---

# 13. Calendar Audit

## Current

Calendar is effectively a planning view of:

- Tasks
- Task Occurrences
- Time Blocks

with day/week/month presentation.

## Missing

- canonical business Event model
- external account model
- external calendar identity
- external event identity
- sync direction
- sync status
- provider timestamps
- duplicate detection
- conflict/deletion rules
- OAuth

## Recommendation

Preserve current Calendar UI and internal time-block planning.

Then layer:

```text
Internal canonical items/events
        ↓
Calendar projection
        ↓
ExternalCalendarService
        ↓
Google Calendar
```

Google Calendar remains optional and outside core planning rules.

---

# 14. Finance Audit

## Current capabilities

- finance-domain goals
- saving / investment / debt goal classification
- monthly contribution target
- metric contribution entries
- progress display

These are valuable and should remain.

## Target additions

- guided finance setup
- income preference/range
- budget categories
- bill model
- expense/income model
- savings linkage
- budget usage
- due-date projection into Today/Calendar
- reports by period/category

## Principle

Existing finance goals become one part of the new Finance domain, not the entire Finance domain.

---

# 15. Routine Audit

Current Habit infrastructure is one of the strongest reusable pieces.

Existing:

- habit entity
- daily/weekly cadence
- weekly target
- completion records
- Goal link
- estimated minutes
- weekly stats

Missing:

- Today routine section
- routine-specific empty/suggestion state
- streak/best streak reporting at Habit level
- Routine Insights tab
- optional schedule projection rules

### Recommendation

Keep Habit as the core Routine entity unless a concrete requirement appears that a “Routine” is structurally different.

Rename/present at UX level first; avoid a duplicate Routine table.

---

# 16. Insights Audit

## Current reporting-related assets

- weekly task stats
- habit week stats
- time-block stats
- goal progress
- goal-entry sums/trends
- weekly reflection

This is enough to bootstrap an Analytics Query Layer later.

## Missing product surface

No `/insights` route exists.

Target tabs:

1. Overview
2. Productivity
3. Time
4. Finance
5. Goals
6. Routine
7. Life Balance

## Required before implementation

For every metric define:

- source rows
- source classifications included/excluded
- period
- timezone
- cancellation/archive rules
- scheduled vs completed meaning
- comparison period
- empty-state behavior

Do not use the legacy seller dashboard as the new Insights architecture.

Reuse individual pure calculations/charts only where their definitions match the new metric contract.

---

# 17. Empty-State Audit

Current shared component already provides:

- icon/illustration
- eyebrow
- title
- description
- one action

Target standard additionally requires:

- primary CTA
- secondary CTA
- suggested examples/items

### Recommendation

Extend the existing component contract.

Do not create a second unrelated empty-state system.

---

# 18. Navigation Audit

## Current mobile

```text
Today
Inbox
+
Calendar
Goals
```

## Target mobile

```text
Today
Plan
+
Insights
More
```

### Recommendation

Do not change navigation first.

Create real Plan and Insights destinations before exposing the new IA.

During migration:

- keep old routes working
- use redirects/aliases only after consumers are mapped
- do not remove Inbox/Calendar/Goals functionality merely because they leave the bottom bar
- expose them through More/context/detail navigation

---

# 19. Timezone Audit

Current code uses Bangkok-specific helpers and explicit `+07:00` boundaries in planning queries.

This is internally consistent for a Thailand-only product, but the target architecture states that Calendar/reminder/reporting values should follow the user timezone.

### Required later

- user timezone preference/default
- timezone-aware day boundaries
- report boundaries based on user timezone
- external calendar normalization

Do this before Google Calendar and final Insights metric certification.

---

# 20. Existing Test Assets to Preserve

Current E2E tests cover valuable vertical slices:

- Seller onboarding
- Professional onboarding
- Inbox → Today → Top Priority
- Project creation/detail/subtasks
- Finance goal + contribution
- Habit creation/completion
- notification preferences
- weekly review
- task recurrence and occurrence rescheduling
- Calendar day/week/month task projection

These should become regression tests during redesign.

New tests should be added rather than deleting existing behavior before migration is complete.

---

# 21. Recommended Implementation Order

This order is based on both the new UX source of truth and the current code dependencies.

## Phase 0 — Audit & Baseline — NOW

**Status:** this document.

Deliverables:

- Current Architecture Map
- Current User Flow Map
- Data Model Map
- API/Application Boundary Map
- Gap Analysis
- Reuse/Refactor/Replace/Add matrix
- Implementation order
- Risk/dependency list

Before source edits:

- run GitNexus impact analysis for affected symbols
- establish current test/build baseline in an environment with shell access
- preserve current E2E vertical slices

**No schema redesign in Phase 0.**

---

## Phase 1 — Data Semantics & Compatibility Foundations

### Objective

Make the system able to distinguish what is real user data from what Kemtit prepared.

### Implement

- source/data-state contract:
  - SYSTEM
  - TEMPLATE
  - SUGGESTED
  - USER
  - IMPORT
- acceptance semantics
- analytics exclusion rules
- suggestion reason codes
- additive compatibility approach for current Goal/Task/Habit records
- idempotency strategy for suggestion acceptance / capture confirmation
- user timezone design/default
- decision record for shared item identity/link model

### Important

Do not merge all domain tables.

Do not yet redesign Finance or Calendar wholesale.

---

## Phase 2 — Shared UX Primitives

### Implement

- extend `EmptyState`
- `SuggestedItem`
- `SuggestionGroup`
- compact `ConfirmSheet`
- Starter Workspace preview primitives
- mobile bottom-sheet confirmation
- consistent suggestion vs user visual semantics

### Reuse

- ResponsiveDialog
- current Buttons/Forms
- existing design tokens
- existing accessibility patterns

No global design-system rewrite.

---

## Phase 3 — Role + Focus Onboarding & Starter Workspace

### Implement

Target roles:

- Employee
- Seller
- Student
- Freelancer

Focus Areas:

- Work
- Daily Life
- Finance
- Health
- Study

### Compatibility strategy

Keep current `work_mode` during transition.

Do not force new role codes into legacy `active_persona`.

Use role/focus configuration to influence:

- suggestion packs
- widget order
- capture examples
- starter categories
- finance setup suggestions

### Replace current dangerous behavior

Do not directly persist sample tasks from starter templates.

Flow becomes:

```text
Role
→ Focus Areas
→ Optional Connection prompt
→ Starter Preview
→ Suggestions
→ Add/Edit/Skip
→ USER data
→ Today
```

Google connection remains optional and can initially be “Connect later” until integration phase.

---

## Phase 4 — Today Redesign on Existing Core

### Add

- first-day Start Here
- accepted starter items
- Routine section
- Finance setup/snapshot state
- Suggestions section
- better empty/partial states
- universal capture entry

### Keep

- priorities
- due tasks
- schedule
- capacity
- goal progress
- existing Today route

---

## Phase 5A — Universal Quick Capture Proposal/Confirm

### Build

```text
Quick Add
→ input sentence
→ deterministic extraction first
→ proposal
→ defaults
→ compact confirmation
```

Reuse current domain actions where canonical storage is already valid.

Keep manual forms as fallback.

Do not auto-create multi-module duplicates.

---

## Phase 5B — Shared Item Identity & Linking Foundation

### Objective

Allow one real-world item to appear in several contexts without becoming several business records.

### Required capabilities

- canonical identity
- typed-domain ownership
- relation/projection records
- link-aware update/delete
- audit/source metadata
- safe reminder/calendar projections

### Migration strategy

Additive compatibility layer first.

Existing Task/Goal/Habit/Project ids remain valid.

Do not big-bang migrate.

---

## Phase 6 — Planner

Create `/plan` using existing period/goal/planning foundation.

Views:

- Year
- Month
- Week

Today remains execution.

Trace:

```text
Goal
→ Year
→ Month
→ Week
→ Today
```

No copy/paste duplication across levels.

---

## Phase 7 — Internal Calendar + External Calendar Boundary

### Internal first

- compose canonical Events/Tasks/Time Blocks/linked Bills as appropriate
- define internal ownership and deletion semantics
- retain existing day/week/month UI where useful

### External later in same phase

- external accounts
- Google OAuth
- provider calendar mapping
- external event identity
- import/sync rules
- timezone rules
- conflict/deletion rules

Google Calendar must not become core business logic.

---

## Phase 8 — Finance Domain Expansion

### Keep

- saving/investment/debt goals
- finance goal progress

### Add

- guided setup
- budget categories
- bills
- expenses/income
- recurring bill semantics
- finance links
- sample preview that never enters totals
- finance snapshot for Today

Only after this phase should BILL/EXPENSE branches of Quick Capture be fully enabled.

---

## Phase 9 — Goals + Routine Integration Completion

### Add/refine

- Goal ↔ Planner
- Goal ↔ Task
- Goal ↔ Habit
- Routine ↔ Today
- routine progress definitions
- goal on-track/at-risk deterministic rules where required

Avoid duplicating goal/routine records for reporting.

---

## Phase 10 — Insights MVP

Build from stable source data.

Suggested rollout:

1. Overview
2. Productivity
3. Finance
4. Goals
5. Routine
6. Time
7. Life Balance

Time/Life Balance can ship after the first five if source quality is not ready.

Every metric needs a definition and tests.

---

## Phase 11 — Advanced Smart Defaults

Only after reliable usage history exists:

- recent-choice defaults
- recurring pattern suggestions
- history-based categories
- time suggestions
- context-aware recommendations

No silent commitments.

---

# 22. Dependency Graph

```text
Current Code Audit
      ↓
Data Semantics
      ↓
Suggestion / Confirm UX
      ↓
Role + Focus + Starter Workspace
      ↓
Today
      ↓
Quick Capture Proposal
      ↓
Shared Identity / Linking
      ├──────────────┐
      ↓              ↓
Planner         Calendar Internal
                     ↓
                Google Calendar

Shared Identity / Linking
      ↓
Finance Expansion
      ↓
Full Bill/Expense Capture

Stable USER/source semantics
+ stable linked domains
      ↓
Insights
      ↓
Advanced Smart Defaults
```

---

# 23. What Must NOT Be Done

Do not:

- rewrite the backend
- replace Supabase
- create microservices
- replace Server Actions with REST without a concrete need
- merge all item types into one giant table
- create duplicate Bill/Task/Event records for one real-world bill
- use `domain_events` as calendar events
- use `goal_entries` as a generic expense ledger
- persist starter examples as real user activity
- build Insights before source semantics exist
- implement Google Calendar before internal ownership/sync rules are defined
- create separate applications/codebases by role
- expand core domain enums merely to represent onboarding Focus Areas
- replace the visual design system globally
- remove current tested flows before compatibility coverage exists

---

# 24. Approval Gates Before Schema Changes

Any future schema change must answer:

1. What current table/consumer does this affect?
2. Can it be additive?
3. What is the compatibility projection?
4. What is the backfill rule?
5. What happens to existing Seller/Professional users?
6. Does this distinguish SUGGESTED from USER correctly?
7. Can reports filter the source class deterministically?
8. Does it avoid duplicate business records?
9. What is the rollback/application rollback path?
10. What tests prove old flows still work?

Per repository rules, run GitNexus impact analysis before editing affected symbols and perform graph change analysis before commit.

---

# 25. Recommended First Engineering Slice After Approval

Do **not** begin with Calendar OAuth, Finance charts or AI parsing.

The first engineering slice should be:

```text
Data-state semantics
        ↓
Suggestion model
        ↓
Starter suggestion generation
        ↓
Add / Edit / Skip
        ↓
Accepted item becomes USER
        ↓
Today displays accepted data only
```

Recommended acceptance scenario:

```text
New Employee
→ choose Work + Daily Life + Finance + Health
→ preview Starter Workspace
→ see suggested items
→ accept one
→ skip one
→ edit one
→ enter Today
→ only accepted/edited items behave as user data
→ skipped/unaccepted suggestions do not affect task counts or analytics
```

This slice proves the most important redesign rule:

> Kemtit prepares. The user decides. Only then does Kemtit connect and count the data.

---

# 26. Audit Conclusion

The current repository is already technically capable enough to support the redesign without a large rewrite.

The strongest assets are:

- Today
- Goal hierarchy
- Task/occurrence model
- Projects
- Habits
- Daily planning/time blocks
- source-based weekly metric queries
- modular boundaries
- Supabase/RLS
- current E2E coverage

The redesign's biggest work is not visual styling. It is **data meaning and orchestration**:

1. distinguish prepared data from real user data,
2. introduce target Role + Focus configuration without breaking current Work Mode,
3. provide one capture/confirm flow,
4. establish one identity/linking strategy,
5. expand Finance with correct domain semantics,
6. expose existing planning data through the new Planner,
7. keep Calendar providers outside core logic,
8. build Insights only after data semantics are trustworthy.

**Recommendation:** approve this audit as Phase 0, then start implementation with Phase 1 Data Semantics & Compatibility Foundations. No broad architecture rewrite is justified by the current code review.
