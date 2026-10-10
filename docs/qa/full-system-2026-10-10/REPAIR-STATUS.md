# QA repair verification — 10 October 2026

User authorized implementation of the confirmed QA bugs. Work is in the main local application checkout. Original findings remain in QA-REPORT.md as historical reproductions; this file records repair verification separately.

Baseline: HEAD `c8887b0c4e87f7854c886e01de495dbb4beade8f`, 69 previously modified tracked files plus untracked feature work. Source/migration pre-repair snapshot: `/tmp/kemtit-before-qa-fixes-20261010.tar.gz`. Preserve all prior changes; no reset, commit, or deployment requested.

## Repair matrix

| Finding | Repair scope | Verification status |
| --- | --- | --- |
| QA-01 | Weekly one-off and recurring occurrence cohort | Fixed — mixed-cohort regression tests; Chrome Reviews/Insights 4/8 |
| QA-02 | Planned-work metric wording | Fixed — accurate TH/EN planned-work wording; no deadline changes |
| QA-03 | Thai/English time units | Fixed — TH/EN formatter tests; Chrome Reviews/Insights |
| QA-04 | Sales amount accessible field association | Fixed — accessible Add/Edit tests; Chrome Thai Add field/preset |
| QA-05 | Single feedback success description | Fixed — single accessible success description; component tests |
| QA-06 | Recover eligible Rescue Undo after reload | Fixed — local DB owner/date/snapshot/Undo tests; Chrome apply→reload→Undo |
| QA-07 | Explicit timed/all-day event capture | Fixed — parser/payload/component tests; Chrome timed event save/reload |
| QA-08 | Habit effective-date cohort | Fixed — effective-date and partial-week tests; Chrome pre-creation week |
| QA-09 | Review form isolated by week | Fixed — week-isolation tests; Chrome client navigation and Back |
| QA-10 | Habit toggle accessible state | Fixed — state/failure/keyboard tests; Chrome persisted toggle/reversal |
| QA-11 | Persistent blocking-event scheduling conflicts | Fixed — persistent conflict integration and component payload tests; native browser fill inconclusive |
| QA-12 | Daily-plan form isolated by date | Fixed — date-isolation tests; Chrome next/back with unsaved edits |
| QA-13 | Supported goal-period choices in direct form | Fixed — supported stored-period tests; Chrome existing Quarter selected |
| QA-14 | Corrective task duration validation | Fixed — duration bounds/corrective-copy tests; Chrome invalid 0 preserved stored 15 |
| QA-15 | Visible/accessibly distinct moved occurrences | Fixed — original occurrence date and ARIA tests; Chrome move/reload/restore |
| QA-16 | Preserve singleton groups | Fixed — singleton retention migration; live local group identity/Undo integration |
| QA-17 | Separate skipped from completed work | Fixed — domain/consumer regressions; Chrome skip/reload/print/recovery |
| QA-18 | Locked/stale/inactive interval guidance | Fixed — locked/stale/inactive DB results and control/component tests |

## Verification boundary

The matrix distinguishes automated, real local database, and connected Chrome evidence. All 18 confirmed findings have a repair; this is not a claim that every original full-system QA scenario has passed. Native pointer control continues to return a lock error contrary to the user's unlocked-screen observation; this is a tooling discrepancy, not a product gesture failure. Physical phone/iPad, external provider and usability-pilot evidence remains separate.

## Connected Chrome checks during repair

- QA-09: on week 4 October, entered an unsaved marker and selected one carryover task. Next Week to 11 October showed all three fields empty and carryover disabled. Browser Back restored the actual saved three English fields for 4 October, not the unsaved marker. No review save or carryover was executed. Evidence: `evidence/repair-review-week-isolation.png`.
- QA-12: on 10 October, entered an unsaved note and 321-minute budget. Next Day to 11 October showed its empty note and 480-minute default. Browser Back restored 10 October's saved empty note/450 minutes. No daily plan was saved. Evidence: `evidence/repair-daily-date-isolation.png`.
- QA-04: Sales Add Entry exposed exactly one spinbutton named จำนวน, with a real associated label. Entering 12.5 and using +500 produced 512.5. Closed without saving; original Sales fixtures untouched.
- QA-13: opening the existing quarterly QA goal for edit exposed an ไตรมาส radio with `aria-checked=true`. Closed without saving. Evidence: `evidence/repair-quarter-option.png`.

These checks were run against live local edits. Additional checks and final automation are recorded below.

- QA-10: toggled the water habit with Enter, reloaded to verify `aria-pressed=true`, then reversed and reloaded to verify false. Original incomplete state restored. Evidence: `evidence/repair-habit-toggle-restored.png`.
- QA-14: duration 0 kept the edit dialog open with the corrective 1–1,440 whole-minute message. Cancelled and reloaded; stored duration remained 15. Evidence: `evidence/repair-duration-guidance.png`.
- QA-15: moved the 11 October recurring occurrence to 12 October. Reload showed a distinct original-date label and accessible names alongside the natural 12 October occurrence. Moved it back through the date picker; restored one occurrence on each date. Evidence: `evidence/repair-moved-occurrence-label.png`.
- QA-17: skipped the 13 October occurrence, reloaded, and verified 0/0 eligible completion plus a separate skipped section with an enabled recovery checkbox. Daily print used a skipped heading and dash rather than a completed checkmark. Completed then unchecked the occurrence and reloaded to restore its original 0/1 active state. Evidence: `evidence/repair-skipped-today.png`, `evidence/repair-skipped-print.png`.
- QA-01/02/03: Reviews and Insights both display 4/8 planned-work items for 4–10 October, with Thai `3 ชม.` rather than English units. Exact mixed-cohort and moved-occurrence totals are covered by unit fixtures. Evidence: `evidence/repair-review-metrics.png`, `evidence/repair-insights-metrics.png`.
- QA-08: Reviews for 27 September–3 October now shows no habit target (dash), rather than 0/11 before either habit existed. Current partial start week shows 1/3, with the current-target/history limitation disclosed. Evidence: `evidence/repair-habit-precreation-week.png`.
- QA-07 preview: recognized Thai event text with 14:00 shows timed mode and disables confirmation until an end is supplied. Text containing 14:00–14:30 produces both exact times and enables confirmation. Closed without creating a new event. CUA `fill` on the native time input did not persist a value; this interaction is inconclusive, not counted as a passed manual-time edit. Evidence: `evidence/repair-quick-capture-timed-preview.png`.

- QA-07 persistence: submitted a distinct local QA event `นัดหมาย QA ยืนยันเวลาแก้บั๊ก พรุ่งนี้ 14:00–14:30`. Events displayed exactly one new row for 11 October, 14:00–14:30; reload preserved the same interval. This labelled event is retained in the local QA account. Evidence: `evidence/repair-quick-capture-timed-reload.png`.
- QA-11 browser retry is inconclusive: CUA filled datetime-local DOM values 09:00–09:15 but Save closed the editor and reload retained 11:00–11:30. This does not prove that React submitted the edited values; do not count it as a successful conflict reproduction. Actual payload/error-keeps-editor coverage is in TimeBlockActions unit tests; transaction rejection and unchanged records are covered by live local integration. `repair-inline-event-conflict.png` is not authoritative rejection evidence.

## Automated verification

- Local migrations applied without database reset: `20261010140000`, `20261010140500`, `20261010141000`.
- Full unit/component suite: 128 files passed, 700 tests passed; 12 integration files / 27 tests skipped by the default runner's opt-in guard. Integration is run separately below.
- Type generation and TypeScript check passed.
- Full ESLint: 0 errors, 10 warnings (existing warnings in the dirty checkout).
- Local targeted database integration: initial run found three fixture setup/expectation defects, corrected without removing assertions. Four unaffected files passed 6 tests; retry of the other two passed 10 tests. Positive Rescue readback coverage subsequently passed (see below).
- `git diff --check` passed.
- GitNexus CLI change summary reports CRITICAL risk, 95 changed tracked files / 344 symbols / 181 flows across the entire preexisting dirty checkout. Its printed symbol/flow list is abbreviated; this is not an isolated patch risk score or a clean graph verdict. No commit was made.

- QA-06 Chrome: applied the 11 October proposal for two one-off QA tasks at 09:00–09:30 and 09:30–09:45. Reload retained both placements and the Undo button. Undo followed by another reload restored 450 free minutes / 60 unscheduled minutes and the original proposal; the two test placements were removed through normal Undo. Evidence: `evidence/repair-rescue-undo-after-reload.png`, `evidence/repair-rescue-undo-restored.png`.
- Positive Rescue integration: server-returned operation id can be used to Undo; wrong owner/date and changed after-state are excluded. Four tests in the schedule-conflicts file pass.
- Production build passed (`pnpm run build`, webpack); final `tsc --noEmit` passed after the last added integration case.

## Reviewable change set and release boundary

- `repair-files.txt` lists files changed relative to the pre-repair source archive; `repair-only.patch` isolates this turn's source/migration edits from prior uncommitted work.
- Three migrations were applied only to local Supabase. Hosted environments require these migrations before deploying the corresponding code. No commit or deployment was performed.
- Existing historical habit target/archive edits cannot be reconstructed; the UI discloses the current-active/current-target basis. All native pointer/physical-device/external-provider and usability-pilot work remains outside this repair verification.
- The local QA timed event is retained; test-only Rescue placements and task/habit mutations used during checks were reversed. No permanent deletion was added.

## Final integration result

All 12 local integration files have passing final results, covering 28 unique tests. The full run passed 11 files and 27 tests and found one preexisting UUID-order assertion failure in daily-plan priority. The assertion was corrected to compare the two exact rows by owner id, preserving expected task ids and versions; targeted rerun passed all 3 tests in that file. No product authorization or version guard was loosened.

Final commands: `pnpm test`; `pnpm run typecheck`; `pnpm run lint`; `pnpm run build`; `V2_INTEGRATION=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/integration`; targeted integration reruns as described above. Final source/test/migration inventory contains 63 files; documentation and screenshots are additional review artifacts. Native time-input filling remains explicitly inconclusive; it is not counted as Chrome conflict-rejection evidence.

## Commit follow-up

On the user's subsequent commit request, the dependency features were committed separately (authentication `1076140`, feedback `3d400b2`, planner `884ac95`, navigation `e0a54ce`), followed by the isolated 18-finding repair in `799aa80`. The earlier no-commit notes describe the verification run before that request. No push or deployment was performed. Screenshots, raw logs, and the pre-repair patch archive remain local QA artifacts; links to those artifacts require the original local workspace.
