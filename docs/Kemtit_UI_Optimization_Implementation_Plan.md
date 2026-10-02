# Kemtit.com — UI Optimization Implementation Plan

**Document type:** UI/UX optimization + implementation handoff  
**Project:** Kemtit.com  
**Date:** 2026-09-23  
**Status:** Batches A–C implemented; Batches D–G remain staged  
**Related source of truth:** `Kemtit_UX_Redesign_Implementation_Plan.md`  
**Current implementation status:** `docs/ui-optimization/qa/README.md`  
**Planner specification:** `docs/planner-development-plan-2026-09-22.md`  
**Planner handoff:** `docs/planner-implementation-handoff-2026-09-22.md`

---

# 1. Executive Summary

Kemtit already has the required product architecture and the main connected workflow:

```text
Prepare → Suggest → Confirm → Auto-connect
```

This plan does **not** propose another architecture redesign. It optimizes the interface so the existing system becomes easier to understand, calmer to use, and consistent across Desktop, Tablet, and Mobile.

The selected visual direction is:

> **Calm Operational Planner — Clean Card + Neutral Timeline**

It combines:

- the clarity of a calm productivity dashboard,
- the time awareness of a timeline-first planner,
- the low-friction capture and planning model already implemented in Kemtit.

The system must **not** become a generic admin dashboard or a project-management board everywhere.

## Final style decision

The UI must not use:

- colored left borders on event/task cards,
- colored navigation stripes,
- decorative bars attached to the left side of list rows,
- a different strong color for every card,
- deeply nested cards,
- excessive rounded floating boxes,
- fake personal data in production empty states.

Category and status should be communicated through:

- a small icon,
- a colored dot,
- a short badge,
- a very light tinted background,
- typography and spacing,
- a neutral timeline spine where time sequence is important.

All category color treatments must remain secondary to the content.

---

# 2. Primary Objectives

The optimized UI must help the user answer these questions quickly:

1. What should I do now?
2. What is important today?
3. What time is already occupied?
4. What still needs to be planned?
5. What changed and what needs attention?
6. Where will a captured item appear after confirmation?

## Success criteria

The optimization is successful when:

- primary actions are visible without scanning several cards,
- the user can read full task names before acting,
- common actions require fewer decisions,
- advanced controls do not dominate the first view,
- mobile pages are not compressed desktop layouts,
- Desktop, Tablet, and Mobile use the same information hierarchy,
- error states cannot be mistaken for empty data,
- the user never has to create duplicate business records for different views,
- suggestions remain visibly different from confirmed user data,
- keyboard and screen-reader users can complete all core workflows.

---

# 3. Non-Goals and Scope Guardrails

This project is an interface optimization. It must not silently expand into a platform rewrite.

## Out of scope

- replacing Next.js, Supabase, Tailwind, Radix, or the current component system,
- rebuilding the database,
- changing canonical domain ownership,
- adding a second planner data model,
- making Google Calendar core business logic,
- introducing a general AI chatbot,
- adding collaboration or team project management,
- implementing investment trading,
- rewriting copy across the entire product without a separate copy review,
- changing routes merely to match a mockup,
- copying demo/localStorage behavior from the prototype into production.

## Required preservation

The implementation must preserve:

- canonical Task/Event/Bill/Expense/Goal/Habit/Note records,
- `item_registry` and `item_links` behavior,
- current onboarding data-origin semantics,
- route query state such as planner view/date and modal parameters,
- server actions and authorization boundaries,
- undo and idempotency behavior,
- current Thai locale support,
- no-fake-data rule,
- existing mobile core navigation:

```text
Today / Plan / + / Insights / More
```

---

# 4. Current Baseline That Must Not Be Reverted

The following optimizations already exist and should be treated as the starting point:

- Desktop Sidebar active state no longer depends on a colored left stripe.
- Universal Quick Capture uses natural input first and hides manual type selection behind progressive disclosure.
- Today no longer shows duplicate capacity summaries at the same hierarchy level.
- Daily Plan controls are placed near the task/priorities context.
- Capacity and Life Balance indicators expose progress semantics.
- Task titles can wrap in core task and planning surfaces.
- Insights tabs have a full-width horizontally scrollable mode.
- Focus onboarding cards have visible keyboard focus treatment.
- Inbox priority is an advanced option while Domain remains explicit.
- Inbox deletion has a delayed delete + Undo behavior.

Do not restore the previous UI while optimizing adjacent pages.

---

# 5. Final Visual Language

## 5.1 Overall character

The interface should feel:

- calm,
- clear,
- personal,
- operational,
- trustworthy,
- lightly expressive but not decorative.

Kemtit should look like a planner that helps the user act—not an admin template designed to display the largest possible number of widgets.

## 5.2 Surface hierarchy

Use only three practical surface levels:

1. **Page background** — quiet tinted background.
2. **Primary container** — white or near-white card for a complete section.
3. **Subtle nested area** — light neutral/tinted region inside a primary container.

Avoid placing a shadowed card inside another shadowed card unless it is a modal, popover, or a genuinely independent object.

## 5.3 Color rules

Use color for meaning, not decoration.

Allowed:

- active navigation icon,
- compact domain/status badge,
- small category dot,
- progress indication,
- warning/success/error state,
- one primary CTA,
- very light category background.

Not allowed:

- category-colored left border,
- left-side vertical status stripe,
- full saturated event cards,
- several unrelated accent colors competing on the same screen,
- color-only communication without text/icon/state label.

## 5.4 Timeline item style

Timeline items must use:

```text
Time → neutral timeline dot → clean content row/card
```

Recommended anatomy:

```text
09:00    ●   Team meeting
              Online · 60 min
```

Optional soft background is allowed, but the card must have either:

- no border, or
- one uniform neutral border.

Do not use a category-colored border on the left.

## 5.5 Typography

Continue using the current IBM Plex Sans Thai configuration and semantic type scale.

Rules:

- Page title: one H1 per page.
- Section title: H2.
- Card/object title: H3 or body-semibold depending on density.
- Do not truncate primary action text where wrapping is reasonable.
- Truncation is allowed for secondary metadata, breadcrumbs, emails, and constrained calendar month cells.
- Financial and time values use tabular numerals.

## 5.6 Radius and shadows

Use existing design tokens. Do not add arbitrary raw radius or shadow values.

Recommended usage:

- dense inputs/list controls: `rounded-sm` / `rounded-md`,
- operational cards: `rounded-lg`,
- major page sections: `rounded-xl`,
- empty states, sheets, onboarding hero: `rounded-2xl`,
- subtle shadow only for primary containers,
- list rows should usually rely on dividers, not individual shadows.

## 5.7 Motion

- 150–200ms for hover/open/selection feedback.
- No layout-jumping hover elevation on dense operational lists.
- Respect `prefers-reduced-motion`.
- Completion animation must remain brief and non-blocking.

---

# 6. Responsive Layout Contract

Every optimized page must be designed and reviewed in these three reference viewports:

| Viewport | Reference | Product behavior |
|---|---:|---|
| Mobile | 390px | Bottom navigation, one-column content, action-first flow |
| Tablet | 768px | Compact navigation rail or primary navigation, 8-column composition |
| Desktop | 1440px | Full sidebar, max content width around current 1200px shell |

Minimum supported mobile width: **360px**.

## 6.1 Desktop

- Full Sidebar with grouped destinations.
- Top bar may contain global capture/search/account actions.
- Main content uses 12-column layout where helpful.
- Right supporting column is allowed only when it contains contextual information—not duplicated content.

## 6.2 Tablet

- Do not shrink Desktop Sidebar content into an icon rail containing every destination.
- Tablet Navigation Rail should prioritize:

```text
Today
Plan
Inbox
Calendar
Insights
More
```

- Secondary destinations remain in More.
- Remove the old active colored left stripe from `NavigationRail`.
- Use icon emphasis and a subtle active tile/fill.

## 6.3 Mobile

- Bottom navigation remains:

```text
Today / Plan / + / Insights / More
```

- Main action must remain reachable above or through the center `+`.
- One-column reading order.
- Form fields and content blocks use 100% of the available mobile content width; stack fields instead of squeezing them side by side.
- Avoid desktop-style data tables unless transformed into stacked rows/cards.
- Sticky controls must not cover save, undo, toasts, or safe-area content.

## 6.4 Horizontal scrolling

Horizontal scrolling is allowed only for intentionally scrollable controls such as:

- Insights tab row,
- dense calendar week/month grid,
- optional period switcher where labels cannot fit.

The page body itself must not horizontally scroll.

---

# 7. Shared Component Optimization

## 7.1 App Shell and navigation

Primary files:

- `src/components/layout/AppShell.tsx`
- `src/components/layout/ShellFrame.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/NavigationRail.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/components/layout/TopBar.tsx`
- `src/components/layout/nav-items.ts`

Actions:

1. Align active states across Sidebar, Navigation Rail, and Bottom Nav.
2. Remove tablet colored left stripe.
3. Keep `aria-current="page"`.
4. Reduce Tablet rail destinations to primary routes plus More.
5. Preserve Desktop direct access to operational/context routes.
6. Ensure tooltips/accessible labels exist for icon-only navigation.
7. Verify the More tab remains active for secondary mobile destinations.

## 7.2 Page Header

Primary file:

- `src/components/layout/PageHeader.tsx`

Actions:

- Keep title, optional description, date/meta, and one toolbar region.
- Do not reserve a large empty right area when desktop actions are absent.
- Allow a full-width secondary toolbar for pages with many tabs.
- Keep mobile heading short and prevent important titles from disappearing through truncation.

## 7.3 Segmented navigation

Primary file:

- `src/components/ui/segmented-nav.tsx`

Actions:

- Keep compact segmented control for 2–4 options.
- Use horizontally scrollable full-width tabs for 5+ options.
- Active state uses surface + typography, not a colored left indicator.
- Keyboard focus must be visible.

## 7.4 Cards and lists

Rules:

- Summary numbers may use cards.
- Tasks, transactions, events, bills, and habits should primarily use lists/rows.
- Avoid rendering every list item as a separate floating card.
- Use uniform dividers and spacing.
- Primary titles wrap where possible.

## 7.5 Forms

Primary patterns:

- required fields first,
- smart/default fields preselected,
- advanced fields behind disclosure,
- inline validation beside the relevant field,
- disabled/pending state visible,
- save result announced via toast or inline live region.

## 7.6 Dialogs and sheets

Primary file:

- `src/components/ui/responsive-dialog.tsx`

Rules:

- Mobile uses bottom sheet.
- Desktop uses centered dialog.
- Preserve focus trap and return focus.
- Primary action remains visible without covering content.
- Long forms need internal scrolling, not page body overflow.

## 7.7 Empty, loading, error, offline, permission states

Primary files:

- `src/components/domain/EmptyState.tsx`
- `src/app/(app)/loading.tsx`
- `src/app/(app)/error.tsx`
- `src/app/not-found.tsx`
- `src/components/layout/OfflineBanner.tsx`

Each data section must distinguish:

```text
Loading
Empty
Error
Offline
Permission denied
Partial data
Success
```

Never render an error as “no data yet.”

---

# 8. Page-by-Page Optimization Plan

# 8.1 Login / Auth

Routes/files:

- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/login/login-form.tsx`
- `src/app/(auth)/auth/callback/*`

## Desktop

- Centered authentication panel.
- Small brand area and concise value statement.
- Email OTP primary path.
- Google sign-in shown only when configured.
- No dashboard-style sidebar.

## Tablet

- Same core panel with slightly wider breathing room.
- Avoid two decorative columns that add no task value.

## Mobile

- Full-width form with safe-area padding.
- Keyboard must not hide submit action.
- Clear resend/error/cancel states.

## Acceptance

- Authentication failure has actionable guidance.
- Provider cancellation returns the user to a usable screen.
- Intended destination is preserved.
- Calendar permission is not implied by Google sign-in.

---

# 8.2 Onboarding — Role

Routes/files:

- `src/app/(auth)/onboarding/persona/page.tsx`
- `src/app/(auth)/onboarding/persona/persona-picker.tsx`

## UI direction

- 4–6 role cards with clear label and one-line explanation.
- Selected state uses border/background/icon—not a left stripe.
- Continue CTA remains disabled until a role is selected.
- Do not imply a role permanently locks the product mode.

## Responsive

- Desktop: 2–3 column role grid.
- Tablet: 2 columns.
- Mobile: stacked or compact 2-column cards depending on copy fit.

---

# 8.3 Onboarding — Focus Areas

Routes/files:

- `src/app/(auth)/onboarding/focus/page.tsx`
- `src/app/(auth)/onboarding/focus/focus-picker.tsx`

## UI direction

- Multi-select list/cards.
- Visible check state.
- Keep keyboard focus ring.
- Explain that choices personalize defaults and suggestions.

## Acceptance

- No area is silently selected.
- At least one area is required only if that remains the business rule.
- Thai text wraps without card-height breakage.

---

# 8.4 Onboarding — Starter Workspace

Routes/files:

- `src/app/(auth)/onboarding/starter/page.tsx`
- `src/app/(auth)/onboarding/starter/starter-workspace.tsx`
- `src/components/domain/SuggestedItem.tsx`
- `src/components/domain/SuggestionGroup.tsx`

## UI direction

Each suggestion must clearly show:

- type,
- focus area,
- title,
- reason,
- `Suggested` status,
- Add / Edit / Skip.

Accepted suggestions must visibly change to `Accepted` without pretending they existed before confirmation.

Google Calendar remains a separate optional panel after core starter suggestions.

## Acceptance

- Skip does not create operational data.
- Finish is allowed even if all suggestions are skipped.
- No personal amount/history/completion is invented.

---

# 8.5 Today

Route/file:

- `src/app/(app)/today/page.tsx`

Primary supporting components:

- `TaskList`
- `QuickTaskInput`
- `DailyPlanForm`
- `TimeBlockForm`
- `GoalProgressPanel`

## Desktop structure

```text
Header + Scope
Quick Capture
Summary: Priorities / Week Progress / Attention count if meaningful

Main column
- Main goal context (only when relevant)
- Today’s Focus and task list
- Today’s Schedule as neutral timeline

Supporting column
- Capacity
- Routine
- Finance attention
- Suggestions
```

Rules:

- Do not show the same metric twice at the same hierarchy.
- Capacity detail stays in one card.
- Tasks are the primary operational content.
- Schedule uses neutral line + dots/icons, no colored left card border.
- Daily planning settings remain progressively disclosed near tasks.

## Tablet

- Focus first.
- Schedule second.
- Capacity and support sections follow in a two-column or stacked layout.
- Tablet must not hide essential actions in hover-only controls.

## Mobile

Order:

1. Greeting/date.
2. Quick Capture.
3. Compact summary.
4. Today’s Focus.
5. Schedule.
6. Attention/support sections.

Avoid showing more than two major cards before the first actionable task list.

## Acceptance

- User can add and complete a task without leaving Today.
- User can identify the next action within one screen.
- Long task titles remain readable.
- First-day state guides without fake data.
- API failure does not become an empty day.

---

# 8.6 Planner — Year / Month / Week / Today

Route/file:

- `src/app/(app)/plan/page.tsx`

## Year view

- Show yearly direction/goals first.
- Show 12 month cells as a structured overview, not decorative cards.
- Each month displays limited meaningful preview.
- Empty months remain quiet and clickable.

## Month view

- Month goals at top only when present.
- Week sections show date range, goal/task count, and key focus.
- Avoid one large card per minor data item.

## Week view

Desktop:

- 7-day structure or 2-column daily composition depending on density.
- Each day shows tasks, events, and bills from canonical sources.
- Clear transition from Week to Today.

Tablet:

- Horizontal day navigation or stacked daily cards.
- Keep one day’s content readable without miniature text.

Mobile:

- Selected-day list/agenda is primary.
- Week strip provides day switching.
- Today shortcut remains obvious.

## Board view policy

Kanban/Board is **not** the default global planner mode.

A board may be added later as an optional Work Project view, not as the primary representation of personal life, finance, routine, and calendar data.

## Acceptance

- Year → Month → Week → Today preserves item identity.
- Planner never creates duplicate plan records merely to display another level.
- Date/query state remains stable when dialogs close.

---

# 8.7 Calendar — Month / Week / Day

Route/file:

- `src/app/(app)/calendar/page.tsx`

Supporting components:

- `CalendarMonth.tsx`
- `CalendarWeek.tsx`
- `CalendarNav.tsx`
- `TimeBlockForm.tsx`
- `TimeBlockActions.tsx`

## Event visual style

Use:

- small category dot/icon,
- soft background,
- neutral border where required,
- time and source metadata.

Do not use colored left borders.

## Desktop

- Month is suitable for overview.
- Week/Day is suitable for planning and editing.
- Unscheduled items may appear in a contextual side panel.

## Tablet

- Week view should remain readable with horizontal scrolling where necessary.
- Day view may become the default editing surface.

## Mobile

- Agenda/day view is the default practical surface.
- Month grid is for navigation, not for showing full event content.
- Event detail/edit uses bottom sheet.

## Acceptance

- Event, Task occurrence, Time Block, and Bill remain visually distinguishable without color-only cues.
- Imported Google events are clearly read-only.
- Loading/error cannot display false availability.
- Edit/move/cancel/undo behavior is coherent.

---

# 8.8 Inbox

Route/file:

- `src/app/(app)/inbox/page.tsx`

Components:

- `InboxCapture.tsx`
- `InboxList.tsx`
- `NotesList.tsx`

## UI direction

Primary capture:

```text
Title → Domain → Save
```

Advanced:

```text
Priority
```

List rows show:

- title,
- domain/priority metadata,
- quick plan date,
- Plan Today,
- delete with Undo.

## Responsive

- Desktop: compact list rows with action group.
- Tablet: actions wrap below title when needed.
- Mobile: title first, then date/Plan Today; delete remains secondary.

## Acceptance

- Capture does not silently classify everything as Work.
- Delete is reversible during the Undo window.
- Long titles wrap.
- Planning an Inbox task preserves the same Task ID.

---

# 8.9 Tasks

Route/file:

- `src/app/(app)/tasks/page.tsx`

## UI direction

- Search/filter at top.
- List is primary; cards are not required for every task.
- Grouping options may include Overdue / Planned / Done.
- Task details open in responsive dialog/sheet.
- Recurrence, planned date, and deadline must be visually distinct.

## Mobile

- Filters use compact sheet or horizontal chips.
- Task rows wrap title and show only essential metadata.

---

# 8.10 Goals

Routes/files:

- `src/app/(app)/goals/page.tsx`
- `src/app/(app)/goals/[id]/page.tsx`
- `src/components/domain/GoalCard.tsx`
- `src/components/domain/GoalCascadeTree.tsx`
- `src/components/widgets/GoalProgressPanel.tsx`

## Goals overview

- Active / completed / relevant period filters.
- Goal cards use progress and concise metadata.
- No category left border.
- Avoid huge goal cards for low-information goals.

## Goal detail

Recommended order:

1. Goal title and progress.
2. Current period/direction.
3. Linked tasks/projects/habits.
4. Entries or metric history.
5. Child goals/cascade.
6. Edit/archive actions.

## Acceptance

- Progress source is explainable.
- Suggested/template data is excluded from normal progress.
- Long goal names wrap where operationally necessary.

---

# 8.11 Routine / Life

Route/file:

- `src/app/(app)/life/page.tsx`

Components:

- habit components under `src/components/habits/*`

## UI direction

- Today completion list is primary.
- Weekly completion grid is secondary.
- Suggested routines remain in a clearly labeled suggestion region.
- Use check state, text, and compact progress—not colored left bars.

## Mobile

- One-tap completion.
- Habit detail/edit opens as sheet.
- Weekly history can scroll horizontally but must not shrink to unreadable dots.

---

# 8.12 Finance

Route/file:

- `src/app/(app)/finance/page.tsx`

Components:

- `FinanceTransactionForm.tsx`
- `FinanceBudgetForm.tsx`
- `FinanceBills.tsx`
- `FinanceGoalSettings.tsx`
- `FinanceStarterGuide.tsx`

## Desktop structure

1. Income / Expense / Balance / Budget summary.
2. Add transaction primary action.
3. Budget setup.
4. Bills requiring attention.
5. Recent transactions.
6. Saving / investment / debt goals.

## Visual rules

- Green/red are semantic and must be used sparingly.
- Neutral text remains primary.
- A negative amount must include a sign/label, not color alone.
- No fake balances in an empty account.

## Mobile

- Summary becomes 2×2 compact grid or horizontal summary.
- Add transaction is the primary CTA.
- Bills precede historical analysis when something is due.

---

# 8.13 Insights

Route/file:

- `src/app/(app)/insights/page.tsx`

## UI direction

- Full-width scrollable tab row:

```text
Overview / Productivity / Time / Finance / Goals / Routine / Life Balance
```

- Overview should answer “what changed?” rather than only showing totals.
- Facts, trends, and suggestions must be visually separated.
- Do not display a confident insight when data is insufficient.

## Chart rules

- Include text value and period.
- Provide accessible summary.
- Use consistent axis/scale.
- Avoid decorative charts with no decision value.
- Planned time must not be labeled as actual time.

## Mobile

- One insight group at a time.
- Tabs scroll horizontally.
- Charts must remain readable at 390px.

---

# 8.14 Weekly Reviews

Route/file:

- `src/app/(app)/reviews/page.tsx`

## Structure

1. Week navigation.
2. Factual weekly summary.
3. Wins/blockers/learning.
4. Carryover task selection.
5. Next-week focus.
6. Save/confirm.

## Acceptance

- Review data is bound to the selected week.
- Previous-week answers are reference only.
- Carryover retains canonical Task ID and deadline.
- Mobile form does not present all reflection fields as one overwhelming block.

---

# 8.15 Rescue / Replan

Route/file:

- `src/app/(app)/rescue/page.tsx`

Component:

- `src/components/planning/RescueReview.tsx`

## UI direction

Use a three-step interaction:

```text
Problem detected → Preview proposal → Confirm / Edit / Cancel
```

Show:

- what stays locked,
- what moves,
- what cannot fit,
- deadline risk,
- why a suggestion was made,
- Undo after applying.

Do not use color alone to explain move/risk/locked state.

---

# 8.16 Work Projects and Project Detail

Routes/files:

- `src/app/(app)/work/projects/page.tsx`
- `src/app/(app)/work/projects/[id]/*`
- `src/components/projects/*`

## UI direction

Projects may use:

- list view as default,
- optional board view later,
- project progress,
- linked tasks and goal context.

This is the appropriate place for a Kanban-style interface—not the global personal planner.

## Acceptance

- Project board/list uses the same canonical Task.
- Personal routine/finance objects are not forced into project workflow statuses.

---

# 8.17 Sales and Entries

Routes/files:

- `src/app/(app)/work/sales/page.tsx`
- `src/app/(app)/entries/page.tsx`
- `src/components/domain/EntriesTable.tsx`
- `src/components/domain/SalesChart.tsx`

## UI direction

- Summary and trend at top.
- Entries use table/list according to viewport.
- Mobile transforms table into stacked rows.
- Quick entry remains near the metric it updates.
- Confirmed and pending/imported states must be clear.

---

# 8.18 More

Route/file:

- `src/app/(app)/more/page.tsx`

## UI direction

- Group destinations by purpose:

```text
Plan and organize
Life and money
Review and improve
Account and integrations
```

- Prefer compact list groups over a wall of large cards.
- Each destination has icon, label, and one concise explanation.
- No hover lift that causes grid movement.

---

# 8.19 Settings / Profile

Route/files:

- `src/app/(app)/settings/page.tsx`
- related settings components

## Desktop

- Section navigation at left or top.
- Current section content at right.
- Avoid showing every setting form expanded simultaneously.

## Tablet/Mobile

- Use grouped list → detail flow or accordion sections.
- Save action belongs to the active section.

Sections:

- Profile.
- Role / Focus / Scope.
- Planning hours and breaks.
- Google Calendar.
- LINE.
- Notifications.
- Appearance where implemented.
- Account/security.

## Acceptance

- Integration unavailable/error/reconnect states are distinct.
- Disconnect does not imply deleting manual Kemtit data.
- Secrets/configuration instructions are never exposed as editable client fields.

---

# 8.20 Global Quick Capture

Primary files:

- `src/components/domain/QuickCapture.tsx`
- `src/components/layout/QuickAddHost.tsx`
- `src/components/layout/QuickAddMenu.tsx`

## Target flow

```text
Type once
→ Prepare proposal
→ Show detected type/date/domain/amount
→ Edit only what is needed
→ Confirm
→ Show where the item is available
```

## UI rules

- Natural input is visually dominant.
- Manual type override stays collapsed until requested.
- Proposal fields are grouped by importance.
- Advanced fields appear only for the detected type.
- Confirm button remains visible and explicit.
- Errors remain inline and announced.

## Acceptance

- Double submit remains idempotent.
- The user can correct every inferred field before saving.
- Unsupported classification never creates a substitute record silently.

---

# 8.21 Legacy Dashboard Route

Route/files:

- `src/app/(app)/dashboard/*`

Policy:

- `/today` is the canonical operational dashboard.
- `/dashboard` should remain a compatibility path/redirect where required.
- Do not create a separate optimized visual system for the legacy dashboard.
- Preserve supported query parameters during redirect.

---

# 9. Mockup Deliverables Before Production Implementation

Before broad UI code changes, create one image per page or distinct workflow. Every image must show:

```text
Desktop 1440px
Tablet 768px
Mobile 390px
```

## Required mockup set

1. Login / Auth.
2. Onboarding Role.
3. Onboarding Focus Areas.
4. Starter Workspace.
5. Today.
6. Planner Year.
7. Planner Month.
8. Planner Week / Mobile Day.
9. Calendar Month.
10. Calendar Week / Day.
11. Inbox.
12. Tasks.
13. Goals overview.
14. Goal detail.
15. Routine / Life.
16. Finance.
17. Insights.
18. Weekly Review.
19. Rescue / Replan.
20. Work Projects.
21. Project detail / optional Board.
22. Sales / Entries.
23. More.
24. Settings / Profile.
25. Quick Capture — input state.
26. Quick Capture — proposal/confirm state.
27. Empty / Loading / Error / Offline states.

## Mockup approval gate

Each mockup must be checked against:

- no colored left bars,
- no fake production data assumptions,
- one clear primary action,
- complete three-viewport behavior,
- consistent navigation,
- readable Thai text,
- existing functionality and canonical data model.

No implementation batch should begin until the relevant mockup batch is approved.

---

# 10. Implementation Order

# Phase 0 — Baseline and Impact Gate

Before editing:

1. Refresh GitNexus index.
2. Run `impact` for every shared component/symbol to be changed.
3. Record HIGH/CRITICAL/UNKNOWN risks.
4. Run current lint/typecheck/test/build baseline.
5. Capture current screenshots at 390 / 768 / 1440.
6. Separate pre-existing failures from optimization regressions.

Do not interpret UNKNOWN GitNexus impact as low risk.

# Phase 1 — Shared UI Foundations

Scope:

- App Shell.
- Navigation Rail consistency.
- Page Header.
- Segmented navigation.
- surface/list/card rules.
- focus states.
- responsive spacing.
- empty/loading/error patterns.

Expected result:

- common components are stable before page-specific work,
- no broad global token rewrite,
- no page-specific hacks duplicated across routes.

# Phase 2 — Core Daily Loop

Implement in this order:

1. Quick Capture.
2. Today.
3. Inbox.
4. Tasks.
5. Planner.
6. Calendar.

Reason:

This is the highest-frequency loop:

```text
Capture → Decide → Plan → Schedule → Do → Adjust
```

# Phase 3 — Life and Money

1. Goals overview/detail.
2. Routine/Life.
3. Finance.
4. Bills and transactions.

# Phase 4 — Review and Recovery

1. Rescue/Replan.
2. Weekly Review.
3. Insights.

Insights must not be polished ahead of source correctness and state handling.

# Phase 5 — Contextual and Secondary Pages

1. Work Projects.
2. Project detail / optional board.
3. Sales.
4. Entries.
5. More.
6. Settings/Profile.
7. Login and onboarding visual polish.

# Phase 6 — Full Responsive and Accessibility QA

- Browser QA at 390 / 768 / 1440.
- Keyboard-only QA.
- Screen-reader landmark/label QA.
- Contrast review.
- Long Thai content.
- Empty/loading/error/offline/permission states.
- Slow network and double-submit behavior.
- Visual regression screenshots.

---

# 11. File-Level Implementation Map

## Shared layout

```text
src/components/layout/AppShell.tsx
src/components/layout/ShellFrame.tsx
src/components/layout/Sidebar.tsx
src/components/layout/NavigationRail.tsx
src/components/layout/BottomNav.tsx
src/components/layout/TopBar.tsx
src/components/layout/PageHeader.tsx
src/components/layout/nav-items.ts
```

## Shared controls

```text
src/components/ui/segmented-nav.tsx
src/components/ui/responsive-dialog.tsx
src/components/ui/button.tsx
src/components/ui/input.tsx
src/components/ui/textarea.tsx
src/components/ui/select.tsx
src/components/ui/skeleton.tsx
```

## Shared domain UI

```text
src/components/domain/TaskRow.tsx
src/components/domain/TaskList.tsx
src/components/domain/GoalCard.tsx
src/components/domain/EmptyState.tsx
src/components/domain/QuickCapture.tsx
src/components/domain/SuggestedItem.tsx
src/components/domain/SuggestionGroup.tsx
src/components/domain/InsightCard.tsx
src/components/domain/CalendarMonth.tsx
src/components/domain/CalendarWeek.tsx
```

## Styling

```text
src/styles/globals.css
src/styles/theme.ts
```

Guardrail: update global tokens only when the change is demonstrably shared. Do not solve one page by changing every card or radius in the application.

---

# 12. Accessibility Requirements

Every optimized page must meet these requirements:

- one H1 per page,
- logical heading order,
- native button/link semantics,
- visible keyboard focus,
- minimum 44px interactive target where practical,
- associated labels for all fields,
- `aria-current` for active navigation,
- `aria-live`/toast announcement for save/error where appropriate,
- progress bars expose min/max/current values,
- dialogs trap focus and return focus,
- color is never the only status signal,
- reduced motion is respected,
- charts provide equivalent text values,
- loading regions expose busy state,
- destructive actions support undo or explicit confirmation according to reversibility.

---

# 13. State Contract

For each page/data region, define and test:

| State | Required behavior |
|---|---|
| Loading | Skeleton resembles final structure; no fake values |
| Empty | Explains what is absent and gives contextual next action |
| Error | Says data could not be loaded and provides retry where possible |
| Offline | Shows cached/trustworthy data separately from unavailable actions |
| Permission | Explains missing access without implying no data exists |
| Partial | Marks which section failed while preserving valid sections |
| Success | Confirms action without forcing unnecessary navigation |
| Pending | Prevents accidental duplicate submit and shows progress |

---

# 14. Testing and Verification

## Required commands

Run according to the repository’s actual package scripts and environment:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Also run:

- Supabase migration/RLS checks when a batch touches data contracts,
- GitNexus `detect_changes(scope=all)` before commit,
- `detect_changes(scope=compare, base_ref=main)` for review where available.

## Core E2E journeys

1. Fresh account → Role → Focus → Starter → Today.
2. Quick Capture Task → proposal → confirm → appears in canonical views.
3. Add Inbox task → plan for Today → same task appears in Today/Plan.
4. Complete task → undo → all views remain consistent.
5. Plan week → open Today → open Calendar.
6. Create/move/cancel Time Block → undo.
7. Add Expense / Bill → Finance → Today/Calendar projection.
8. Rescue preview → confirm → undo.
9. Weekly Review → carry over canonical task.
10. Google Calendar unavailable/revoked/error without breaking internal planner.

## Visual QA matrix

For every modified page:

```text
390 × mobile
768 × tablet
1440 × desktop
```

Test:

- no body horizontal scroll,
- no clipped Thai labels,
- no hidden primary action,
- no colored left bars,
- no duplicate summary card,
- full titles readable where actionable,
- bottom navigation does not cover content,
- tablet navigation is not overcrowded.

---

# 15. Definition of Done

A page is complete only when:

- approved three-viewport mockup exists,
- implementation follows the approved hierarchy,
- existing business behavior is preserved,
- loading/empty/error states are implemented,
- keyboard and screen-reader behavior is verified,
- no raw color/radius/shadow values are introduced without justification,
- no colored left border/stripe is used for category or active state,
- no fake user data is introduced,
- no duplicate business record is created,
- relevant unit/integration/E2E tests pass,
- lint/typecheck/build pass,
- GitNexus impact and change analysis are reviewed,
- browser screenshots are compared with the approved mockup,
- changes are logged in `tracking-log.md`.

---

# 16. Recommended Delivery Batches

Use small, reviewable batches.

## Batch A — Navigation and common shell

- Navigation Rail.
- Sidebar/Bottom Nav consistency.
- Page Header.
- Segmented navigation.

## Batch B — Today + Quick Capture

- Today hierarchy.
- Neutral timeline style.
- Quick Capture states.
- first-day/error states.

## Batch C — Inbox + Tasks

- capture hierarchy.
- task list readability.
- filters/detail sheet.
- undo consistency.

## Batch D — Planner + Calendar

- Year/Month/Week responsive design.
- calendar event style without left bars.
- day agenda mobile.
- block edit/undo states.

## Batch E — Goals + Routine + Finance

- goal list/detail.
- routine completion.
- finance summary, transaction, bills.

## Batch F — Review + Rescue + Insights

- preview/confirm/undo.
- weekly carryover.
- report tabs/charts/insufficient-data states.

## Batch G — Secondary pages and onboarding

- Work Projects/Sales/Entries.
- More.
- Settings/Profile.
- Login/Onboarding polish.
- global state pages.

Each batch should be independently testable and reversible.

---

# 17. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| UI optimization changes business behavior | Keep domain/server actions untouched unless separately reviewed |
| Shared component change causes broad regression | Run GitNexus impact first; use visual regression matrix |
| Tablet becomes overcrowded | Limit rail to primary routes + More |
| Timeline becomes another decorative card collection | Use neutral spine/list anatomy; cards only where content grouping requires |
| Excessive use of pastel colors reduces contrast | Keep text neutral/dark; use tint only as secondary cue |
| Mobile becomes a compressed desktop | Define mobile reading order and interaction separately |
| Empty states look like demo data | Use instructions/suggestions, never invented user metrics |
| Insights overstate certainty | Show data period, source, and insufficient-data states |
| Scope expands into Board/project management | Restrict Board to Work Project context |
| Existing unverified baseline masks regressions | Record baseline failures before implementation and compare each batch |

---

# 18. Final Product Direction

Kemtit should optimize around this loop:

```text
Capture once
→ understand what matters
→ see available time
→ place work into a realistic plan
→ act
→ recover when the day changes
→ review and improve
```

The final interface should prioritize:

1. readable actions,
2. time awareness,
3. calm information hierarchy,
4. consistent state handling,
5. user control over suggestions,
6. one canonical item across views.

The visual system must remain clean and personal, without colored left bars, decorative status stripes, or generic admin-dashboard density.
