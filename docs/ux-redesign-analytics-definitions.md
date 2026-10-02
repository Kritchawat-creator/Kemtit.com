# Kemtit UX Redesign — Analytics & Report Metric Definitions

Status: implementation contract for `/insights`.

## Data inclusion rule

Operational and analytical queries count only canonical records whose `data_origin` is:

- `USER`
- `IMPORT`

They exclude `SYSTEM`, `TEMPLATE`, `SUGGESTED`, and `EXAMPLE`. A Starter Workspace suggestion therefore has no analytical effect until the user accepts it and a canonical USER record is created.

All date-only periods use Kemtit's application timezone/calendar rules. Current application timezone is `Asia/Bangkok`; week boundaries use the existing Kemtit week rule from `src/lib/date.ts`.

## Overview

Overview is a summary surface. It does not invent a separate metric source.

- Tasks = Productivity tasks done / tasks total for the current week.
- Time = sum of Kemtit Time Block duration in the current week.
- Routine = Habit completions / weekly Habit targets.
- Finance = current-month income minus current-month expense.
- Active Goals = count of non-archived goals with status `active`.
- Average Goal Progress = arithmetic mean of deterministic goal progress percentages across active goals.
- Streak = task-completion streak from canonical task completion history.

## Productivity

Period: current Kemtit week.

- `tasksTotal`: non-recurring, non-archived, non-deleted canonical Tasks whose due date is inside the current week.
- `tasksDone`: those weekly Tasks with `completed_at != null`.
- `completionRate`: `tasksDone / tasksTotal`; displayed as empty/— when no countable Tasks.
- `streakDays`: consecutive completion dates from canonical Task completion sources. Recurring occurrence history and non-recurring completions are normalized to dates before streak calculation.

Recurring Tasks are deliberately excluded from the simple weekly Task completion-rate denominator; Routine/Habit metrics provide the recurring behavior view.

## Time

Period: current Kemtit week.

- `blocks`: number of internal Kemtit Time Blocks overlapping the reporting range.
- `minutes`: sum of Time Block duration in minutes.
- Average block duration: `minutes / blocks`; empty when there are no blocks.

External Google Calendar Events are not counted as focused/planned Kemtit time merely because they were imported.

## Finance

Period: current calendar month.

- Income = sum of canonical `finance_transactions` where `transaction_type = income`.
- Expense = sum where `transaction_type = expense`.
- Balance = Income − Expense.
- Budget = the canonical monthly budget for the month, or null when the user has not configured one.
- Budget Remaining = `max(0, budget - expense)`; null when no budget exists.
- Due Bills / Paid Bills = canonical Bills in the month grouped by Bill status.

A missing budget or balance source is represented as an empty/not-configured state, never fabricated zero-data onboarding content.

## Goals

Current canonical Goal set.

- Active = `status = active`.
- Completed = `status = completed`.
- Average Progress = arithmetic mean of the existing Goal Cascade progress engine for active Goals.

Execution Goal progress remains derived from defined canonical child/task data. Metric Goal progress remains derived from real metric entries. TEMPLATE/SUGGESTED/EXAMPLE records are excluded before the progress set reaches Insights.

## Routine

Period: current week plus today snapshot.

- Habits = count of active canonical Habits.
- Weekly Target = sum of each active Habit's `target_per_week`.
- Weekly Done = count of Habit completion rows in the week for active canonical Habits.
- Today Total = active Habits visible today.
- Today Done = today's completed Habits.

## Life Balance

Life Balance is descriptive activity distribution, not a wellness score.

For each Kemtit domain, `items` is the count of:

- active canonical Goals in the domain
- canonical Tasks returned for the current week in the domain
- active canonical Habits in the domain

The UI converts these counts to relative bars. It must not label a domain as healthy/unhealthy, balanced/unbalanced, or make unsupported interpretation.

## Empty/error/loading rules

- No denominator → show an explicit empty/— state, not 0% presented as observed performance.
- No budget → display “not configured”, not a fabricated budget.
- No finance records → no fake income/expense/balance history.
- Route-level errors use the app error boundary.
- Loading may use route/Suspense skeletons; a loading placeholder must never use fake business values.

## Source of truth

Implementation: `src/core/insights/queries.ts` plus canonical domain queries. If a formula changes, update this document and the related tests in the same change.
