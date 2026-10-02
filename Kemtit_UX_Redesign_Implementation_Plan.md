# Kemtit.com — UX Redesign & Connected Life Management Implementation Plan

**Document Type:** Product + UX + Technical Implementation Plan  
**Project:** Kemtit.com  
**Status:** Proposed implementation plan  
**Primary Goal:** Redesign Kemtit into a low-friction, connected personal planning system where users enter information once, Kemtit prepares the structure, and users mainly review, confirm, and act.  
**Core UX Principle:** **Prepare → Suggest → Confirm → Auto-connect**  
**Primary Product Loop:** **Plan → Do → Track → Review → Improve → Plan again**

---

# 1. Executive Summary

Kemtit should evolve from a collection of productivity/life-management features into one connected system centered around the user's day.

The redesign should optimize for:

1. **Minimum clicks**
2. **Minimum repeated typing**
3. **No dead-end empty states**
4. **Smart defaults instead of configuration-heavy setup**
5. **One universal capture point**
6. **Cross-linked data instead of duplicated records**
7. **Role-aware personalization**
8. **Today as the operational dashboard**
9. **Insights as the analytical/reporting center**
10. **Mobile-first action flows**
11. **User control over all AI/smart suggestions**
12. **No fake user data appearing as real data**

The intended experience is:

```text
Sign Up
  ↓
Choose Role
  ↓
Choose Focus Areas
  ↓
Optional Connections
  ↓
Kemtit prepares Starter Workspace
  ↓
Suggested Starter Plan
  ↓
User Accepts / Edits / Skips
  ↓
Today becomes useful immediately
  ↓
Quick Capture
  ↓
Smart Classification
  ↓
Confirm
  ↓
Auto-connect to relevant modules
  ↓
Plan / Do / Track
  ↓
Insights / Reports
  ↓
Improve next plan
```

---

# 2. Product Vision

Kemtit should behave less like a traditional CRUD productivity application and more like a **personal coordination layer**.

The user should not need to think:

- Which module do I open?
- Is this a task or event?
- Do I also need to add this to my calendar?
- Do I need another finance entry?
- Do I need to create a reminder separately?
- Where should this appear in my planner?

Instead, the user should be able to express intent once.

Example:

> Pay electricity bill this Friday, 1,200 THB

Kemtit should prepare:

```text
Type          Bill
Title         Pay electricity bill
Amount        1,200 THB
Due date      Friday
Category      Utilities
Area          Finance + Daily Life
Reminder      Suggested
Calendar      Suggested
Budget        Track
```

After confirmation, the same underlying item can appear contextually in:

```text
Today
Calendar
Finance
Planner
Notifications
Insights
```

without requiring the user to create duplicate records.

---

# 3. Non-Goals

This redesign must **not** turn into an uncontrolled rewrite.

The following are explicitly out of scope unless a code audit proves they are required:

- Rewriting the entire backend
- Replacing the existing framework
- Rebuilding the whole database from scratch
- Building native iOS/Android applications
- Building a general-purpose AI chatbot
- Replacing the entire visual design system
- Creating separate applications per role
- Adding social/community features
- Adding complex investment trading functionality
- Adding features unrelated to the agreed Kemtit product loop
- Automatically committing AI-generated decisions without user review
- Treating sample/example data as real user data

---

# 4. Product Principles

## 4.1 Minimum Input

If Kemtit already knows or can safely infer a value, do not force the user to enter it again.

Examples:

- Remember recent category
- Reuse prior reminder preference
- Suggest common bill recurrence
- Preselect current workspace
- Preselect likely calendar
- Reuse role defaults
- Reuse focus-area defaults

---

## 4.2 Natural Input First, Manual Form Second

Default:

```text
What do you want to add?

[ Type anything... ]
```

Advanced form fields should appear only when needed.

Avoid showing this immediately:

```text
Title
Description
Category
Priority
Date
Start Time
End Time
Reminder
Repeat
Tags
Project
Area
```

Instead:

```text
Pay electricity bill Friday 1,200

Detected:
Bill · Friday · ฿1,200 · Utilities

[ Save ]

More options >
```

---

## 4.3 Suggestions Are Not User Data

Kemtit may prepare information, but the user decides whether it becomes real data.

```text
Suggested Item
      ↓
Add / Edit / Skip
      ↓
User Data
```

---

## 4.4 One Concept, One Identity

If one real-world action appears in several modules, it should not become several independent business records.

Example:

```text
Electricity Bill
        │
        ├── Today
        ├── Calendar
        ├── Finance
        └── Reminder
```

These are views/relationships of one underlying item.

---

## 4.5 Today Is the Execution Center

Users should normally start from Today.

Today answers:

> What deserves my attention now?

Reports answer:

> What happened over time?

Planner answers:

> Where am I going?

---

# 5. Target Information Architecture

Recommended high-level structure:

```text
Kemtit
│
├── Today
│   ├── Priorities
│   ├── Schedule
│   ├── Tasks Due
│   ├── Routine
│   ├── Finance Snapshot
│   ├── Goal Progress
│   └── Smart Suggestions
│
├── Plan
│   ├── Year
│   ├── Month
│   └── Week
│
├── Calendar
│
├── Tasks
│
├── Finance
│
├── Goals
│
├── Routine / Habits
│
├── Insights
│   ├── Overview
│   ├── Productivity
│   ├── Time
│   ├── Finance
│   ├── Goals
│   ├── Routine
│   └── Life Balance
│
└── More / Settings
```

Recommended mobile navigation:

```text
Today
Plan
+
Insights
More
```

The middle `+` is Universal Quick Capture.

---

# 6. First-Time User Experience

## 6.1 Objective

A new user must not land on a blank system with no guidance.

The onboarding should create a useful workspace without pretending Kemtit already knows the user's life.

Target experience:

```text
Sign Up
   ↓
Role
   ↓
Focus Areas
   ↓
Optional Connections
   ↓
Starter Suggestions
   ↓
Today
```

---

# 7. Onboarding Redesign

## 7.1 Step 1 — Role

Supported initial roles:

- Employee
- Seller
- Student
- Freelancer

Role selection should influence:

- Starter suggestions
- Quick Capture examples
- Default widgets
- Category presets
- Planner suggestions
- Finance onboarding suggestions
- Today recommendations

Do **not** fork application logic by role.

Use configuration.

Example conceptual model:

```text
RoleProfile
├── roleCode
├── enabledSuggestions
├── defaultWidgetOrder
├── suggestedCategories
├── captureExamples
└── starterTemplateId
```

---

## 7.2 Step 2 — Focus Areas

Initial focus areas:

- Work
- Daily Life
- Finance
- Health
- Study

Multi-select.

Role and focus area should combine to generate starter suggestions.

Example:

```text
Role: Employee

Focus:
Work
Daily Life
Finance
Health
```

Potential suggestions:

```text
Focus work
Review meetings
Morning routine
Exercise
Set monthly budget
Weekly health goal
```

---

## 7.3 Step 3 — Optional Connections

Initial supported connection:

- Google Calendar

Rules:

- Clearly optional
- Must have "Connect later"
- Kemtit must work without a connection
- Connection should enhance the experience, not unlock basic use

Future providers:

- Outlook Calendar
- Other providers only when justified

---

## 7.4 Step 4 — Starter Workspace Preview

Before creating suggested user data, preview what Kemtit will prepare.

Example:

```text
Kemtit will prepare:

✓ Personalized Today
✓ Suggested starter plan
✓ Default categories
✓ Planner structure
✓ Optional finance setup
```

Primary CTA:

```text
Set up my Kemtit
```

---

# 8. Starter Workspace Strategy

Do not use the generic concept "mock data" internally.

Use distinct data classifications.

## 8.1 Data Classes

```text
SYSTEM
TEMPLATE
SUGGESTED
EXAMPLE
USER
```

---

## 8.2 SYSTEM

Safe to create automatically.

Examples:

- Today view
- Inbox
- Default calendar container
- Default task areas
- Core finance categories
- Core status values
- Core planner structure

These are infrastructure, not claims about the user's life.

---

## 8.3 TEMPLATE

Reusable structures.

Examples:

- Employee starter template
- Seller starter template
- Student starter template
- Freelancer starter template
- Monthly budget template

Template data is not automatically counted as user activity.

---

## 8.4 SUGGESTED

Personalized proposals.

Examples:

- Focus work
- Morning exercise
- Review meetings
- Set monthly budget

Rules:

- Not included in analytics
- Not included in completion rate
- Not included in financial calculations
- Becomes USER only after acceptance

---

## 8.5 EXAMPLE

Display-only educational preview.

Example:

```text
Example Budget

Food       ฿8,000
Transport  ฿3,000
Bills      ฿5,000
```

Rules:

- Must be clearly labeled
- Never count in real reports
- Never affect totals
- Never generate reminders
- Never trigger notifications
- Never appear as user history

---

## 8.6 USER

Accepted or manually created user data.

Only USER data should normally affect:

- Reports
- Analytics
- Notifications
- Financial calculations
- Goal completion
- Productivity metrics
- Habit streaks

---

# 9. Starter Plan UX

After onboarding:

```text
Your starter plan is ready
```

Group suggestions by area.

Example:

```text
WORK
Focus work                 Add | Edit | Skip
Review meetings            Add | Edit | Skip

DAILY LIFE
Drink water                Add | Edit | Skip
Morning stretch            Add | Edit | Skip

FINANCE
Set monthly budget         Add | Edit | Skip

HEALTH
Weekly health goal         Add | Edit | Skip
```

Also provide:

```text
[ Use starter plan ]
[ Set up manually ]
```

System must clearly say:

> These are suggestions. Nothing is added until you confirm.

---

# 10. Today — Operational Dashboard

## 10.1 Role

Today becomes the default operational surface.

It should answer:

1. What is most important today?
2. What is scheduled?
3. What is due?
4. What routines matter?
5. Is there anything financially relevant today?
6. Am I progressing toward important goals?
7. Is there something Kemtit recommends I adjust?

---

## 10.2 Recommended Layout

```text
Good morning

[ + Quick Add ]

Today's Priorities
Schedule / Time Blocks
Tasks Due Today
Routine
Finance Snapshot
Goal Progress
Suggestions
```

---

## 10.3 Progressive Disclosure

Do not show full module details on Today.

Example:

```text
Finance Snapshot

Spent today      ฿850
Monthly budget   62%

[ View Finance ]
```

Today is for awareness and action, not deep analysis.

---

## 10.4 First-Day Variant

If little user data exists:

```text
Start Here

○ Add your first priority
○ Plan one focus block
○ Add one routine
○ Set one monthly goal
```

Below:

```text
Suggested for you
```

This avoids a blank dashboard.

---

# 11. Universal Quick Capture

## 11.1 Objective

Replace separate creation entry points where possible.

Current-style complexity to avoid:

```text
Add Task
Add Event
Add Expense
Add Habit
Add Goal
Add Note
```

Primary UX:

```text
+ Quick Add
```

---

## 11.2 Supported Initial Types

```text
TASK
EVENT
HABIT
BILL
EXPENSE
GOAL
NOTE
```

---

## 11.3 Flow

```text
Quick Add
   ↓
Natural-language input
   ↓
Classification
   ↓
Structured extraction
   ↓
Smart defaults
   ↓
Confirm
   ↓
Create item
   ↓
Create relationships
   ↓
Relevant modules update
```

---

## 11.4 Example

Input:

```text
Pay electricity bill this Friday, 1,200 THB
```

Classification result:

```text
Title       Pay electricity bill
Type        Bill
Amount      1,200 THB
Due         Friday
Category    Utilities
Priority    Medium
Area        Finance + Daily Life
```

Suggested actions:

```text
✓ Add reminder
✓ Track in budget
✓ Show in Today
○ Repeat monthly
```

---

# 12. Confirmation UX

The confirmation page must be compact.

Primary information:

```text
Pay electricity bill
Bill · Utilities
Friday
฿1,200
```

Optional controls:

```text
Reminder             ON
Track in budget      ON
Repeat monthly       Suggested
```

CTA:

```text
Save
```

Advanced fields:

```text
More options >
```

Avoid reopening a large traditional form unless requested.

---

# 13. Smart Defaults Engine

Build smart defaults incrementally.

Do not start with complex AI.

## 13.1 Level 1 — Static Defaults

Based on:

- Item type
- Role
- Focus area

---

## 13.2 Level 2 — Recent Choices

Example:

```text
Last used:
Calendar = Personal
Reminder = 1 day before
Category = Utilities
```

---

## 13.3 Level 3 — Historical Pattern

Example:

```text
Electricity bill
→ Utilities
→ Monthly
→ Reminder 2 days before
```

---

## 13.4 Level 4 — Context

Examples:

- Current day
- Current planner context
- Current active goal
- Open project
- Current role mode
- Upcoming calendar availability

---

## 13.5 Safety Rule

Smart defaults may prefill.

They must not silently create commitments unless the user has previously enabled explicit automation.

---

# 14. Core Item Architecture

A code audit must happen before modifying existing data structures.

The target concept is a shared identity layer.

Example conceptual model:

```text
CoreItem
├── id
├── userId
├── type
├── title
├── status
├── source
├── area
├── priority
├── startAt
├── dueAt
├── createdAt
└── updatedAt
```

Type-specific details can remain separate.

```text
CoreItem
├── TaskData
├── EventData
├── HabitData
├── FinanceData
├── GoalData
└── NoteData
```

Do **not** force all type-specific properties into one huge table.

---

# 15. Item Source Model

Recommended conceptual source:

```text
SYSTEM
TEMPLATE
SUGGESTED
USER
IMPORT
```

Optional display-only classification:

```text
isExample
```

Prefer avoiding persisted example records where possible.

---

# 16. Cross-Link Architecture

## 16.1 Problem

A bill may need to appear in:

- Today
- Finance
- Calendar
- Planner
- Reminder

Duplicating records causes:

- Synchronization bugs
- Conflicting status
- Duplicate notifications
- Reporting errors
- Difficult deletion behavior

---

## 16.2 Target

Use relationships.

Concept:

```text
ItemLink
├── id
├── sourceItemId
├── targetType
├── targetId
├── relationType
└── metadata
```

Examples:

```text
Bill → Calendar Event      SCHEDULED_AS
Bill → Budget Category     TRACKED_AS
Task → Goal                CONTRIBUTES_TO
Task → Planner Block       PLANNED_IN
Event → External Event     SYNCED_WITH
```

---

# 17. Calendar Architecture

## 17.1 Kemtit Calendar

Kemtit should maintain its own calendar/scheduling model.

External providers are integrations.

```text
Kemtit Calendar
       │
       ├── Internal Events
       ├── Tasks with time
       ├── Bills / reminders
       └── Synced External Events
```

---

## 17.2 Google Calendar Integration

Flow:

```text
Connect
   ↓
OAuth
   ↓
Select permissions
   ↓
Import / Sync
   ↓
Normalize
   ↓
Kemtit calendar view
   ↓
Today
```

Suggested provider mapping fields:

```text
provider
externalAccountId
externalCalendarId
externalEventId
syncDirection
syncStatus
lastSyncedAt
providerUpdatedAt
```

---

## 17.3 Mobile Browser

Kemtit should not depend on direct access to Apple/Android local calendar databases.

Web version should prioritize:

```text
Kemtit Web
   ↓
Google Calendar
   ↓
Mobile calendar account sync
```

Native device calendar access can be a later native-app capability.

---

# 18. Calendar Empty State

Bad:

```text
No events
```

Target:

```text
Nothing planned yet.

[ Connect Google Calendar ]
[ Add your first event ]

Try one:
+ Team sync
+ Focus block
+ Doctor appointment
+ Pay electricity bill
```

The empty state must provide a next action.

---

# 19. Planner Redesign

## 19.1 Structure

```text
Plan
├── Year
├── Month
└── Week

Today = execution
```

Avoid a separate daily planner that duplicates Today.

---

## 19.2 Planning Hierarchy

```text
Goal
 ↓
Year
 ↓
Month
 ↓
Week
 ↓
Today
```

Users should not copy/paste the same objective manually into every level.

---

## 19.3 Example

```text
Goal
Save ฿60,000 this year

Month
Save ฿5,000

Week
Review discretionary spending

Today
No-spend day
```

The relationships should remain traceable.

---

# 20. Finance Redesign

## 20.1 New User Finance Experience

Do not create fake balances.

Initial state:

```text
You haven't set up your monthly budget yet.

[ Set up in 30 sec ]
[ Use a sample template ]
```

---

## 20.2 Finance Wizard

Suggested minimal flow:

```text
Income Range
   ↓
Budget Categories
   ↓
Bills
   ↓
Savings Goal
```

---

## 20.3 Income Input

Do not require exact income immediately.

Options could include:

```text
< ฿20k
฿20k–40k
฿40k–70k
฿70k+
Prefer not to say
Custom
```

Exact values can be entered later.

---

## 20.4 Example Templates

If showing example amounts:

```text
Example Preview
Not real data
```

No example values may enter actual:

- Net balance
- Monthly totals
- Reports
- Budget usage
- Insights

---

# 21. Goals

Goals should connect to actionable behavior.

Target:

```text
Goal
  ↓
Milestones
  ↓
Planner
  ↓
Tasks / Habits
  ↓
Progress
```

Example:

```text
Goal
Exercise 4x/week

Routine
Exercise

Today
Exercise 18:00

Insights
3 / 4 completed
```

---

# 22. Routine / Habits

Routine should support lightweight recurring behaviors.

Important metrics:

- Completion rate
- Current streak
- Best streak
- Frequency
- Trend

Avoid over-gamification.

The system should inform, not guilt.

---

# 23. Dashboard Strategy

Kemtit should have two types of dashboard behavior.

## 23.1 Today Dashboard

Purpose:

> What should I do now?

Data:

- Priorities
- Schedule
- Due tasks
- Routines
- Finance alerts
- Goal progress
- Suggestions

High interaction.

---

## 23.2 Overview Dashboard

Optional later enhancement.

Purpose:

> How is this week/month going overall?

Potential cards:

- Productivity
- Time
- Finance
- Goals
- Habits
- Life balance

Do not make Overview the default landing page.

---

# 24. Reports / Insights

Recommended navigation label:

```text
Insights
```

rather than a highly enterprise-oriented "Reports" label.

Inside:

```text
Insights
├── Overview
├── Productivity
├── Time
├── Finance
├── Goals
├── Routine
└── Life Balance
```

---

# 25. Insights — Overview

Example:

```text
This Month

Tasks completed       82%
Goals on track         4/6
Focus time             42h
Exercise               12 sessions
Expenses               ฿18,420
Savings                ฿5,000
```

Trends:

```text
Productivity   +12%
Spending        -8%
Exercise        +3 sessions
```

All comparisons must use clearly defined periods.

---

# 26. Productivity Report

Metrics:

- Tasks created
- Tasks completed
- Completion rate
- Overdue count
- Rescheduled count
- Focus sessions
- Focus duration
- Planned vs completed tasks

Potential patterns:

```text
Most productive day
Most productive time
Common overdue category
Average completion delay
```

Avoid making unsupported behavioral claims.

Prefer descriptive insights.

Example:

```text
You completed 68% of focus tasks scheduled between 09:00–11:00 this month.
```

---

# 27. Time Report

Potential breakdown:

```text
Work
Personal
Health
Study
Family
Other
```

Reports:

- Planned time
- Scheduled time
- Completed time if tracking exists
- Category distribution
- Week-over-week trend

Example:

```text
Work        38%
Personal    24%
Health      12%
Study       10%
Family       9%
Other        7%
```

Do not imply actual activity completion when Kemtit only knows scheduled time.

---

# 28. Finance Report

Sections:

```text
Income
Expenses
Budget
Bills
Savings
Investment
```

Initial investment support should remain tracking-oriented unless broader requirements are defined.

Example:

```text
September

Income       ฿65,000
Expenses     ฿31,800
Savings      ฿18,000
Investment   ฿8,000
Remaining    ฿7,200
```

Breakdown:

```text
Housing
Food
Transport
Shopping
Health
Other
```

Support:

- Current month
- Previous month
- Custom period
- Category trend

---

# 29. Goal Report

Show:

- On track
- At risk
- Completed
- Paused

Example:

```text
Save ฿60,000
78%

Exercise 4x/week
70%

Finish English course
90%
```

Do not assign "at risk" without a documented rule.

Example rule:

```text
Expected progress by date > actual progress + tolerance
```

Rules must be deterministic and testable.

---

# 30. Routine Report

Metrics:

```text
Completion rate
Current streak
Best streak
Completed days
Missed days
```

Example:

```text
Morning exercise
18 / 25 days

Drink water
22 / 25 days
```

---

# 31. Life Balance Insights

Potential categories:

```text
Work
Daily Life
Health
Finance
Learning
Family
```

Important rule:

Kemtit should show observations, not moral judgments.

Good:

```text
Scheduled work time increased 18% compared with last month.
```

Avoid:

```text
You're working too much.
```

Unless a user explicitly defines their own threshold.

---

# 32. Analytics Architecture

Reports should read from the same core entities.

Do not create a second parallel reporting data silo unless performance later requires derived aggregates.

Concept:

```text
Core Data
  │
  ├── Items
  ├── Calendar
  ├── Finance
  ├── Goals
  └── Routine
       │
       ↓
Analytics Query Layer
       │
       ↓
Insights
```

If performance requires aggregation:

```text
Core Data
  ↓
Daily Aggregates
  ↓
Monthly Aggregates
  ↓
Insights
```

Derived data must remain reproducible from source data.

---

# 33. Metrics Definitions

Before building charts, define each metric precisely.

Examples:

## Task Completion Rate

```text
completed USER tasks in period
--------------------------------
USER tasks due in period
```

Decide how cancelled tasks are handled.

---

## Focus Time

Must clearly specify whether it means:

- Planned focus time
- Completed focus time
- Tracked actual time

Do not merge them.

---

## Savings

Define whether:

```text
Income - Expense
```

or explicitly logged savings transfers.

These are not always equivalent.

---

# 34. Role-Based Experience

Use one application core.

Do not maintain separate codebases.

Concept:

```text
RoleConfiguration
├── employee
├── seller
├── student
└── freelancer
```

Each can influence:

- Suggestion packs
- Dashboard ordering
- Starter templates
- Categories
- Quick Capture examples

---

# 35. Seller Mode

Possible starter suggestions:

```text
Check orders
Inventory review
Customer follow-up
Record sales
Business expenses
Personal errands
```

Work and Daily Life should coexist.

---

# 36. Employee Mode

Possible suggestions:

```text
Focus work
Review meetings
Project task
Exercise
Personal errands
Monthly budget
```

---

# 37. Student Mode

Possible suggestions:

```text
Today's classes
Assignment review
Study block
Routine
Weekly budget
Personal tasks
```

---

# 38. Freelancer Mode

Possible suggestions:

```text
Client work
Deadline review
Invoice reminder
Portfolio
Income tracking
Personal routine
```

---

# 39. Empty State Design Standard

Every empty state should answer:

1. What is this?
2. Why is it useful?
3. What should I do next?
4. Can Kemtit help me start?

Template:

```text
[ Friendly explanation ]

Recommended:
[ Primary CTA ]

Alternative:
[ Secondary CTA ]

Suggested examples:
[ Item ] [ Item ] [ Item ]
```

---

# 40. Empty State Examples

## Goals

```text
What do you want to improve?

Suggested:
+ Save ฿5,000/month
+ Exercise 3x/week
+ Finish one course

[ Create your own goal ]
```

---

## Finance

```text
You haven't set up your budget yet.

[ Set up in 30 sec ]
[ Use sample template ]
```

---

## Calendar

```text
Nothing planned yet.

[ Connect Google Calendar ]
[ Add event ]
```

---

## Routine

```text
Build a routine that fits your life.

Suggested:
+ Morning stretch
+ Drink water
+ Read 20 minutes
```

---

# 41. Reusable UX Components

Recommended shared components:

```text
<EmptyState />
<SuggestedItem />
<SuggestionGroup />
<QuickCapture />
<SmartField />
<ConfirmSheet />
<StarterTemplate />
<ConnectProvider />
<ProgressCard />
<InsightCard />
<TrendCard />
<MetricCard />
<PeriodSelector />
```

---

# 42. SuggestedItem Contract

Concept:

```text
SuggestedItem
├── id
├── type
├── title
├── subtitle
├── reason
├── defaultValues
├── onAccept
├── onEdit
└── onSkip
```

The component must visually distinguish a suggestion from an existing user item.

---

# 43. Quick Capture Component

Must support:

- Desktop modal
- Mobile bottom sheet
- Keyboard-first usage
- Natural-language entry
- Type suggestions
- Quick manual type selection
- Recent inputs where appropriate

Fallback manual options:

```text
Task
Event
Expense
Habit
Goal
Note
```

---

# 44. Smart Field Pattern

Example:

```text
Category
Utilities              Auto-selected
```

Allow override.

Include why only if useful.

Avoid excessive "AI" labels.

---

# 45. Mobile UX

Mobile priority order:

1. Today
2. Quick Capture
3. Plan
4. Notifications/reminders
5. Insights summary
6. Detail modules

Desktop can expose more simultaneous context.

Mobile should prioritize action.

---

# 46. Mobile Quick Capture

Recommended bottom sheet:

```text
What do you want to add?

[ Pay electricity bill Friday 1200 ]

Suggestions:
Bill · Friday · ฿1,200

[ Continue ]
```

Then compact confirm.

---

# 47. Notifications

Notifications should link back to the same core item.

Avoid generating independent notification records that behave like duplicated tasks.

Notification examples:

- Due soon
- Bill due
- Upcoming meeting
- Habit reminder
- Goal review

Notification preferences should be user-controlled.

---

# 48. Search

Universal search can later search:

- Tasks
- Events
- Bills
- Goals
- Notes
- Planner items

Quick Capture and Search should remain distinct:

```text
Search = find
Quick Add = create
```

---

# 49. Backend Service Boundaries

Exact implementation depends on code audit.

Conceptual services may include:

```text
ItemService
SuggestionService
StarterWorkspaceService
SmartDefaultService
PlanningService
CalendarService
FinanceService
GoalService
RoutineService
InsightService
ExternalCalendarService
```

Avoid creating services merely to mirror UI pages.

Boundaries should reflect domain responsibility.

---

# 50. Suggested API Direction

Examples only; adapt to existing API conventions.

```text
GET  /api/today
POST /api/items/capture
POST /api/items/confirm
GET  /api/suggestions/starter
POST /api/suggestions/{id}/accept
POST /api/suggestions/{id}/skip
GET  /api/insights/overview
GET  /api/insights/productivity
GET  /api/insights/finance
```

Do not introduce these routes if equivalent endpoints already exist.

Reuse before replacing.

---

# 51. Capture API

Potential request:

```json
{
  "input": "Pay electricity bill this Friday, 1200 THB",
  "context": {
    "timezone": "Asia/Bangkok"
  }
}
```

Potential response:

```json
{
  "type": "BILL",
  "title": "Pay electricity bill",
  "amount": 1200,
  "currency": "THB",
  "dueAt": "...",
  "category": "Utilities",
  "suggestions": {
    "reminder": true,
    "trackInBudget": true,
    "repeat": "MONTHLY"
  }
}
```

This response is a proposal until confirmed.

---

# 52. Idempotency

Confirmation APIs should guard against accidental double creation.

Especially important on mobile.

Use an idempotency strategy for:

- Item confirmation
- Calendar sync
- External imports
- Starter plan acceptance

---

# 53. External Calendar Sync Rules

Define:

- Import-only vs two-way
- Conflict handling
- Deletion handling
- Provider update handling
- Duplicate detection
- Timezone handling
- Recurring events
- All-day events

Do not launch two-way sync without explicit conflict rules.

---

# 54. Timezone

Calendar and reminder data must store timezone-aware values.

UI should display using user timezone.

Avoid storing only local clock text.

---

# 55. Recurring Items

Recurring tasks, habits, bills, and external calendar events must have separate recurrence semantics.

Do not reuse one recurrence model blindly if domain behavior differs.

---

# 56. Reporting Date Rules

Reports must define:

- User timezone
- Start/end inclusivity
- Week start preference
- Month boundaries
- Archived/cancelled records
- Imported records

Without this, metrics will be inconsistent.

---

# 57. Data Migration Strategy

Do not migrate until inventory is complete.

Recommended process:

```text
Audit
 ↓
Map current entities
 ↓
Identify duplicates/silos
 ↓
Introduce compatibility layer
 ↓
Migrate incrementally
 ↓
Verify
 ↓
Remove obsolete path later
```

Avoid big-bang migration.

---

# 58. Compatibility Layer

If existing modules already own Task/Event/etc., introduce a shared identity/linking layer first rather than forcing immediate table merges.

This reduces regression risk.

---

# 59. Frontend Refactor Strategy

Prefer incremental route/component replacement.

Recommended:

```text
Design tokens
 ↓
Shared smart UX components
 ↓
Today
 ↓
Onboarding
 ↓
Quick Capture
 ↓
Empty states
 ↓
Planner
 ↓
Insights
```

Do not redesign every screen simultaneously.

---

# 60. Design System Requirements

Maintain consistency for:

- Spacing
- Typography
- Buttons
- Cards
- Form fields
- Empty states
- Suggestion states
- Selected state
- Success state
- Warning state
- Chart spacing
- Mobile bottom sheets

---

# 61. Visual State Semantics

Suggested distinctions:

```text
USER DATA        standard card
SUGGESTED        subtle suggestion treatment
EXAMPLE          clear "Example" badge
SYSTEM DEFAULT   normally invisible as system concept
IMPORTED         provider icon where useful
```

Do not rely only on color.

---

# 62. Accessibility

Required checks:

- Keyboard navigation
- Visible focus state
- Contrast
- Semantic labels
- Screen reader labels
- Touch target sizes
- Error messages
- Form labels
- Chart text alternatives where needed

---

# 63. Performance

UX improvements should not make the initial dashboard slow.

Potential strategy:

```text
Today critical data
    ↓
First render

Secondary:
Finance snapshot
Goal progress
Suggestions
    ↓
Load progressively
```

Avoid blocking Today on expensive report calculations.

---

# 64. Caching

Potential cache targets:

- Starter configuration
- Suggestion templates
- Report aggregates
- External calendar sync state

Do not cache user-sensitive changing data without clear invalidation.

---

# 65. AI / Classification Strategy

Start with deterministic extraction where possible.

Examples:

- Currency patterns
- Dates
- Times
- Known categories
- Recurrence phrases

Use model-based classification only where it materially improves understanding.

Always maintain a manual fallback.

---

# 66. AI Failure UX

If Kemtit is uncertain:

```text
I think this is:

○ Task
● Bill
○ Event

[ Confirm ]
```

Do not silently guess.

---

# 67. Confidence Handling

Optional internal confidence:

```text
typeConfidence
dateConfidence
amountConfidence
categoryConfidence
```

Low-confidence fields should request confirmation or remain unset.

---

# 68. Smart Suggestion Rules

Every suggestion should have a reason source.

Examples:

```text
ROLE_DEFAULT
FOCUS_DEFAULT
RECENT_HISTORY
RECURRING_PATTERN
CALENDAR_CONTEXT
USER_TEMPLATE
```

This makes debugging possible.

---

# 69. Insight Rule Transparency

Insights should be backed by data.

Good:

```text
Your scheduled focus time increased from 7h to 9h this week.
```

Avoid unsupported:

```text
You're becoming more productive.
```

unless Kemtit defines exactly how productivity is measured.

---

# 70. Error Handling

Critical flows requiring explicit error states:

- Sign up/onboarding
- Starter workspace creation
- Starter plan acceptance
- Quick Capture parsing
- Save/confirm
- Calendar OAuth
- Calendar sync
- Finance save
- Insights loading

Never leave users uncertain whether data was saved.

---

# 71. Undo

Where possible, support immediate undo for low-risk operations.

Example:

```text
Bill added to Today, Finance and Calendar.

[ Undo ]
```

This reduces fear around smart automation.

---

# 72. Deletion Semantics

Deleting a linked item must define behavior.

Example:

```text
Delete electricity bill?

This will remove it from:
✓ Today
✓ Finance
✓ Calendar reminder

External Google Calendar event:
○ Keep
● Delete synced event
```

Exact behavior depends on ownership.

---

# 73. Audit Logging

For complex linked actions, retain enough data to diagnose:

- Source
- Created by
- Imported from
- Accepted suggestion
- Sync provider
- Link creation
- Automation decision

This is especially important once smart automation expands.

---

# 74. Implementation Phases

---

## Phase 0 — Code & Architecture Audit

### Objective

Understand current Kemtit implementation before modifying architecture.

### Review

- Frontend routes
- Existing dashboard
- Today
- Tasks
- Calendar
- Finance
- Goals
- Habits/routine
- Reports
- Current onboarding
- Data models
- API endpoints
- Authentication/user profile
- Existing role concepts
- Existing notification model
- Existing recurring-item behavior
- Existing external integrations

### Deliverables

```text
Current Architecture Map
Current User Flow Map
Data Model Map
API Map
Gap Analysis
Reuse / Refactor / Replace Matrix
```

### Do not implement schema redesign before this phase.

---

## Phase 1 — UX Foundations

### Implement

- Data-state semantics
- SYSTEM/TEMPLATE/SUGGESTED/USER distinction
- Shared UX components
- Standard empty state
- Suggestion component
- Confirm sheet
- Mobile bottom sheet
- Period selector
- Insight card primitives

### Acceptance

All new UX work uses shared components.

---

## Phase 2 — Onboarding & Starter Workspace

### Implement

- Role selection
- Focus selection
- Optional Google Calendar prompt
- Starter workspace initialization
- Starter plan generation
- Add/Edit/Skip
- First-time Today redirect

### Acceptance

A new user reaches a useful Today view without manually creating several records.

---

## Phase 3 — Today Dashboard Redesign

### Implement

- Priorities
- Schedule
- Due items
- Routine
- Finance snapshot
- Goal progress
- Suggested actions
- First-day Start Here

### Acceptance

Today remains useful for:

- Brand-new user
- User with partial setup
- Active user
- User without Finance
- User without connected Calendar

---

## Phase 4 — Universal Quick Capture

### Implement

- One Quick Add entry
- Type classification
- Structured extraction
- Smart defaults
- Confirm flow
- Manual fallback

### Acceptance

Core use case:

```text
Quick Add
→ type sentence
→ review
→ save
```

without navigating to a module form.

---

## Phase 5 — Shared Item Linking

### Implement

- Shared identity or compatibility layer
- Relationship model
- Cross-module updates
- Link-aware deletion
- Link-aware status update

### Acceptance

One bill can appear in Today + Finance + Calendar without independent duplicate business records.

---

## Phase 6 — Planner

### Implement

- Year
- Month
- Week
- Goal linkage
- Move/promote planning items
- Today projection

### Acceptance

The same objective can be traced from Goal to Today.

---

## Phase 7 — Calendar

### Implement

- Internal Kemtit calendar improvements
- Helpful empty state
- Google OAuth
- Sync model
- Imported event identity
- Today projection

### Acceptance

Calendar connection is optional and does not block Kemtit use.

---

## Phase 8 — Finance Starter Experience

### Implement

- Guided setup
- Example template preview
- Budget basics
- Bill support
- Savings goal
- Clear example-data separation

### Acceptance

A new user sees no fake real balance.

---

## Phase 9 — Goals + Routine Integration

### Implement

- Goal-to-action links
- Routine-to-Today projection
- Goal progress rules
- Routine metrics

### Acceptance

Progress is based only on defined user data.

---

## Phase 10 — Insights MVP

### Implement

Initial tabs:

```text
Overview
Productivity
Finance
Goals
Routine
```

Recommended later:

```text
Time
Life Balance
```

### Acceptance

Every displayed metric has a documented calculation rule.

---

## Phase 11 — Advanced Smart Defaults

### Implement

- Recent behavior defaults
- History-based category suggestion
- Recurrence suggestion
- Time suggestion
- Context-aware recommendation

### Acceptance

User can always override suggestions.

---

# 75. Recommended Priority

## P0 — Must Have

- Code audit
- Starter workspace
- Today
- Empty states
- Quick Capture
- Suggestion vs user data separation
- Shared linking foundation

---

## P1 — High Value

- Planner
- Calendar internal improvements
- Google Calendar
- Finance onboarding
- Goals/routine integration
- Insights MVP

---

## P2 — Intelligence

- Historical smart defaults
- Natural-language expansion
- Advanced suggestions
- Smart scheduling
- Life Balance insights

---

# 76. Recommended Delivery Slices

Avoid implementing by technical layer only.

Use vertical slices.

Example Slice 1:

```text
New Employee
→ onboarding
→ starter suggestions
→ Today
```

Slice 2:

```text
Quick Add bill
→ classify
→ confirm
→ Today
→ Finance
```

Slice 3:

```text
Quick Add event
→ Calendar
→ Today
```

Slice 4:

```text
Goal
→ Planner
→ Today task
→ progress
→ Insight
```

This makes behavior testable end-to-end.

---

# 77. Use Case 1 — New Employee

```text
Register
 ↓
Employee
 ↓
Work + Daily Life + Finance + Health
 ↓
Skip Calendar
 ↓
Preview Starter Plan
 ↓
Accept:
  Focus work
  Exercise
  Monthly budget setup
 ↓
Today
```

Expected:

- No dead-end empty state
- Suggestions clearly identified
- Accepted data becomes real
- Skipped data disappears cleanly

---

# 78. Use Case 2 — Electricity Bill

Input:

```text
Pay electricity bill this Friday, 1,200 THB
```

Expected:

```text
Bill created
Today entry visible
Finance bill visible
Calendar reminder visible if enabled
No duplicate independent business records
```

---

# 79. Use Case 3 — Meeting

Input:

```text
Client meeting tomorrow at 10 AM
```

Expected:

```text
Event
Tomorrow 10:00
Work
Calendar
Today when appropriate
Reminder suggested
```

---

# 80. Use Case 4 — Goal

Input:

```text
I want to save 60,000 baht this year
```

Expected:

```text
Goal
Annual target
Suggested monthly target
Optional finance linkage
Planner visibility
Insight progress
```

No automatic financial transfer should be inferred.

---

# 81. Use Case 5 — Routine

Input:

```text
Exercise Monday Wednesday Friday at 6 PM
```

Expected:

```text
Routine
Recurrence
Calendar projection if enabled
Today projection on relevant days
Routine report
```

---

# 82. Dashboard Acceptance Criteria

Today should load with meaningful state for all cases:

### New user
Starter guidance

### User without schedule
Suggested planning CTA

### User without finance
Finance setup CTA, not zero/fake totals

### Active user
Real priorities/schedule/data

### Connected calendar user
Imported events visible

---

# 83. Report Acceptance Criteria

For every chart:

- Period displayed
- Metric definition known
- No example data
- No suggestions counted
- Timezone respected
- Empty state supported
- Loading state supported
- Error state supported

---

# 84. Mobile Acceptance Criteria

Critical flows must work without desktop:

- Onboarding
- Starter plan
- Today
- Quick Capture
- Confirm
- Calendar connect
- Finance setup
- Insights summary

No essential workflow should require hover.

---

# 85. QA Strategy

## Functional

- Add/edit/delete
- Linked updates
- Recurrence
- Timezone
- Report calculations
- Suggestion acceptance
- Example-data isolation
- OAuth
- Sync

---

## UX

Verify click count for core workflows.

Example targets:

```text
Add common item:
Quick Add → Type → Confirm

Accept suggestion:
Add

Open today:
App → Today
```

---

## Regression

Verify unchanged areas after each slice.

Do not accept broad visual changes outside the implementation scope.

---

# 86. Test Matrix

Minimum dimensions:

```text
Desktop
Mobile browser

Employee
Seller
Student
Freelancer

No integrations
Google Calendar connected

New user
Partial setup
Active user

Light data
Heavy data
```

---

# 87. Edge Cases

Must test:

- User skips all starter suggestions
- User has no Finance setup
- User disconnects Calendar
- External event deleted
- Duplicate external event
- Daylight/timezone changes
- Recurring external events
- Bill with no amount
- Task with ambiguous date
- Goal with no deadline
- Suggested item edited before acceptance
- Double-click Save
- Network retry
- Report period with no data

---

# 88. Observability

Track product events needed to measure redesign impact.

Examples:

```text
onboarding_started
onboarding_completed
starter_suggestion_accepted
starter_suggestion_skipped
quick_capture_started
quick_capture_confirmed
quick_capture_corrected
calendar_connected
finance_setup_completed
insight_opened
```

Avoid storing unnecessary sensitive text in telemetry.

---

# 89. UX Success Metrics

Metrics to monitor after release:

- Onboarding completion rate
- Time to first accepted item
- Quick Capture completion rate
- Quick Capture correction rate
- Starter suggestion acceptance rate
- Empty-state CTA conversion
- Calendar connection completion
- Finance setup completion
- Today daily usage
- Weekly Insights usage

---

# 90. Product Health Metrics

Potential later metrics:

- Users creating at least one item
- Users completing at least one item
- Users returning to Today
- Users using 2+ connected modules
- Users viewing Insights after activity exists

These measure whether the connected model is actually being used.

---

# 91. Scope Guardrails for Coding Agent

The implementation agent must follow these rules.

## Required

- Read existing implementation first
- Reuse existing code where safe
- Make minimal scoped changes
- Preserve existing working behavior
- Add tests for changed behavior
- Document migrations
- Document new environment variables
- Keep desktop/mobile behavior consistent
- Validate API contracts

## Forbidden

- Do not redesign unrelated screens
- Do not change colors globally unless required
- Do not rename unrelated modules
- Do not rewrite authentication
- Do not replace infrastructure
- Do not remove existing features without explicit mapping
- Do not add speculative features
- Do not create fake production data
- Do not silently change report definitions
- Do not duplicate linked business records to simplify UI

---

# 92. Migration Guardrails

Before schema changes:

```text
1. Identify current consumers
2. Identify current data volume
3. Identify backfill rule
4. Define rollback
5. Add migration
6. Verify staging
7. Verify reports
8. Verify API compatibility
```

---

# 93. Rollout Strategy

Recommended progressive rollout:

```text
Internal / dev
 ↓
Test users
 ↓
Feature flag
 ↓
Partial rollout
 ↓
Default experience
 ↓
Remove old path after validation
```

Major UX changes should be feature-flagged where feasible.

---

# 94. Feature Flags

Potential flags:

```text
new_onboarding
starter_workspace
new_today
quick_capture_v2
google_calendar_sync
insights_v2
```

Do not leave obsolete flags indefinitely.

---

# 95. Documentation

Update:

- Architecture document
- UX flow document
- API documentation
- Data model documentation
- Calendar sync rules
- Analytics definitions
- Report metric definitions
- QA checklist

---

# 96. Definition of Done — First-Time Experience

A new user can:

```text
Sign up
→ choose role
→ choose focus
→ optionally connect calendar
→ preview starter plan
→ accept/edit/skip
→ reach useful Today
```

without needing to understand the entire application.

---

# 97. Definition of Done — Quick Capture

A user can input:

```text
Pay electricity bill this Friday, 1,200 THB
```

and reach:

```text
Today
Finance
Calendar/reminder
```

after one natural-language input plus confirmation.

No repeated entry.

---

# 98. Definition of Done — Today

Today must:

- Explain today's priorities
- Display schedule
- Show due items
- Show routine
- Show finance context when available
- Show goal progress
- Offer useful next actions
- Have valid new-user state
- Have valid empty state
- Work on mobile

---

# 99. Definition of Done — Insights

Insights must:

- Use real USER data
- Exclude EXAMPLE
- Exclude unaccepted SUGGESTED data
- State time period
- Have deterministic metrics
- Have empty states
- Work on mobile
- Avoid unsupported interpretation

---

# 100. Target Product Architecture

```text
                         KEMTIT
                            │
              ┌─────────────┴─────────────┐
              │                           │
         Smart Input                 Smart Defaults
              │                           │
              └─────────────┬─────────────┘
                            │
                        Core Item
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
       Today              Plan             Calendar
         │                  │                  │
         ├────────────── Finance ──────────────┤
         │                  │                  │
         ├────────────── Goals ────────────────┤
         │                  │                  │
         └──────────── Routine / Habits ───────┘
                            │
                            ↓
                      Analytics Layer
                            │
                            ↓
                         Insights
             ┌──────────────┼──────────────┐
             │              │              │
        Productivity      Finance        Goals
             │              │              │
             └────── Time / Routine ───────┘
                            │
                            ↓
                      Life Balance
```

---

# 101. Recommended Implementation Starting Point

Do **not** start with Reports.

Do **not** start with advanced AI.

Do **not** start with Calendar OAuth.

Start in this order:

```text
1. Audit current code and data architecture
2. Introduce data-state semantics
3. Build shared suggestion/empty-state components
4. Build Starter Workspace
5. Redesign Today
6. Build Universal Quick Capture
7. Add shared linking foundation
8. Connect Planner / Calendar / Finance
9. Build Insights from stable core data
10. Add smarter personalization
```

Reason:

Reports and AI are only reliable when the underlying identity, linking, and data-state rules are correct.

---

# 102. Final Product Loop

The redesign should make this loop natural:

```text
        ┌───────────────┐
        │     PLAN      │
        └───────┬───────┘
                ↓
        ┌───────────────┐
        │      DO       │
        └───────┬───────┘
                ↓
        ┌───────────────┐
        │     TRACK     │
        └───────┬───────┘
                ↓
        ┌───────────────┐
        │    REVIEW     │
        └───────┬───────┘
                ↓
        ┌───────────────┐
        │    IMPROVE    │
        └───────┬───────┘
                │
                └────────────→ PLAN
```

The role of Kemtit is to reduce the effort required between these stages.

---

# 103. Final UX Statement

The redesign should be evaluated against one question:

> **Does Kemtit reduce the number of decisions, clicks, and repeated inputs the user needs to make while still keeping the user in control?**

The desired product behavior is:

```text
Kemtit prepares.
Kemtit suggests.
The user decides.
Kemtit connects.
The user acts.
Kemtit helps the user review.
```

That principle should remain consistent across onboarding, Today, planning, finance, calendar, goals, routines, dashboard, and reports.

---

# 104. Next Required Engineering Deliverable

Before implementation, perform a repository-level code review and produce:

```text
Kemtit_Current_State_Audit.md
```

It should map this plan against the current application with:

| Area | Current | Target | Gap | Reuse | Change Required | Risk |
|---|---|---|---|---|---|---|
| Onboarding | TBD | Personalized onboarding | TBD | TBD | TBD | TBD |
| Today | TBD | Operational dashboard | TBD | TBD | TBD | TBD |
| Quick Capture | TBD | Universal capture | TBD | TBD | TBD | TBD |
| Planner | TBD | Year/Month/Week | TBD | TBD | TBD | TBD |
| Calendar | TBD | Internal + provider sync | TBD | TBD | TBD | TBD |
| Finance | TBD | Guided starter + linking | TBD | TBD | TBD | TBD |
| Goals | TBD | Action-linked goals | TBD | TBD | TBD | TBD |
| Routine | TBD | Connected routines | TBD | TBD | TBD | TBD |
| Insights | TBD | Analytical center | TBD | TBD | TBD | TBD |
| Data Model | TBD | Shared identity/linking | TBD | TBD | TBD | TBD |

Only after that audit should schema-level or broad architectural changes be approved.

---

**End of Plan**
