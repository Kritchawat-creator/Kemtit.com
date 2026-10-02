# Workflow handoff — 2026-10-02

## Final keyword audit handoff — completed

- User request to audit keywords across the entire system is complete for catalog/source scope: 48 namespaces, 1,368 original strings per locale (2,736 total). Exact coverage has no duplicated or missing namespaces.
- Applied 54 unique keys: TH51 updated+1 new, EN21 updated+1 new; 1,369 keys per locale now. Changes include consistent habit/project/archive/note terms, touch-first save help, accurate LINE/photo/iPad copy, state-neutral task checkbox label, and required-expense placeholder separate from optional bill amount. QuickTaskInput touch-first fix preceded this count.
- Full units481 passed/9 skipped; final catalog8 passed including ICU plural rendering; typecheck and scoped lint passed. Final test-only capacity selector updated; rerun lint recorded separately.
- E2E16/16 passed mobile+tablet (2.3min): recurring task completion/uncompletion persistence, project edit/task/subtasks/archive, Life habit completion, planning/time block, and all4 supported profession scenarios. Canonical data/persistence assertions retained.
- CUA verified TH+EN Inbox and required-expense preview at390px; Life/Archive at768px; no horizontal overflow on inspected Inbox/Life views. Restored Thai/default viewport, Today tab id1 marked deliverable. No new user data saved in this keyword browser pass.
- Reports: docs/keyword-audit-2026-10-02.md; exact changes docs/keyword-changes-2026-10-02.json; proposals keyword-audit-{navigation,planning,records}-2026-10-02.json. Evidence8 screenshots+logs under docs/qa/keyword-2026-10-02/.
- Boundaries: static review covered every catalog key, browser runtime was scoped not exhaustive; no physical iPad Safari, real LINE delivery, hosted deployment, or engagement claims. Prototype remains isolated. No commit/reset/deploy. Preserve pre-existing dirty worktree.
- All requested work complete; final response should describe results concisely, link report and screenshot, and include the required memory citation from MEMORY.md242-248 / rollout01a0d937-80ee-75d0-8506-7058b21e46f4.


## Latest keyword audit checkpoint (supersedes earlier follow-up notes)

- All 48 namespaces / 1,368 original keys per locale reviewed in three proposal JSONs: navigation459 + planning442 + records467. Union verified with no duplicate/missing namespace.
- Planning edits finished: dashboard.empty.description (legacy unused key; NOT widgets.goalProgress.empty.description), today.capacityHeading, workflowGuide.priorityRule. Invoice rewrite proposals intentionally rejected; professional guidance may name external work.
- capture_workflow is the sole active writer for approved records/navigation proposals, cross-page habit/archive/project/capacity terminology, QuickCapture required expense placeholder, narrow token allowlists and impacted test labels. QuickCapture exact UID impact LOW: QuickAddHost then AppLayout. No domain/action changes authorized.
- Parent owns serialized pnpm checks and browser verification. Await writer completion, run full units/typecheck/scoped lint, then focused V2 planning/core/tasks and persona E2Es as needed. Record actual outcomes in docs/keyword-audit-2026-10-02.md.
- Pre-audit snapshots remain /tmp/kemtit-keyword-before-{th,en}.json; generate durable exact-change manifest after writer completes. Browser auditTab id1 is Inbox, Thai QA account; viewport reset. CUA docs refreshed after latest compaction.


## Active follow-up — whole-system keyword audit

User's latest request: audit whether keywords/copy are appropriate across the whole system, following the touch-first correction to “เพิ่มงานวันนี้ แล้วกด Enter”. Earlier authorization allows correcting confusing Thai/English words and UX, prioritizing iPad/tablet/mobile.

- QuickTaskInput follow-up implemented: placeholder “ชื่องานวันนี้” / “Task for today”; existing submit now primary “เพิ่มงาน” / “Add task”, min 44px. Form Enter and data contract unchanged. Impact HIGH (TodayPage, TodayTasksWidget, DesktopDashboard); warned user before edit.
- Mobile 390px and tablet 768px tap-created synthetic tasks successfully, visibly confirmed in Today. Viewport reset; tab marked deliverable. Catalog tests 7 passed, component lint passed, baseline typecheck passed (`/tmp/kemtit-keyword-typecheck-baseline.log`).
- Inventory: 48 namespaces, 1,368 leaf strings per locale (TH/EN). Parent production TSX literal scan found only comments, currency checks, decorative K/G; no obvious hardcoded visible prose. Prototype is an isolated English visual reference with explicit demo/unsupported copy; not the product locale catalog.
- Read-only audit agents are reviewing disjoint namespaces and writing proposal JSON only, **no catalog edits yet**:
  - role_workflow → `docs/keyword-audit-navigation-2026-10-02.json`: app/shell/common/nav/more/pro/notifications/auth/onboarding/personas/roles/focusAreas/workModes/scopes/settings/errors/a11y/domains/domainFilter/dates/line/pwa/photos.
  - planning_workflow → `docs/keyword-audit-planning-2026-10-02.json`: planner/calendar/calendarEvents/rescue/goals/periods/goalKinds/pace/progress/widgets/today/planning/reviews/dashboard/workflowGuide.
  - capture_workflow → `docs/keyword-audit-records-2026-10-02.json`: capture/entries/tasks/inbox/projects/archive/life/habits/finance/insights.
- Proposal schema: reviewedNamespaces, reviewedLeafCountPerLocale, findings[{key,thBefore,thAfter,enBefore,enAfter,reason,severity,sourceReferences}], hardcodedFindings, notes.
- Parent flagged cross-system terms to consider: habit กิจวัตร vs นิสัย entity labels; project โปรเจกต์ vs โครงการ; capacity ความจุ (prefer clear time wording backed by displayed value); archive เข้ากรุ unclear (avoid implying permanent deletion); Inbox Enter hint should lead with actual visible button; iOS installation currently only mentions iPhone despite iPad target.
- Next: integrate evidence-backed proposals, verify complete namespace coverage and preserve placeholders/ICU/brands; assign ONE Luna writer to apply approved key changes and update affected text selectors/expected copy (do not weaken behavior assertions). Use graph impact before function edits; locale keys UNKNOWN require text-consumer confirmation. Run catalog/full relevant tests, type/lint, affected E2E and browser spot checks. Write durable glossary/audit results and update this handoff before compaction.
- Current progress: planning agent reports all 442 owned leaf keys reviewed; records agent reports all 467 owned keys reviewed. Navigation remaining group should be 459 to total1,368; verify actual proposal coverage. JSON proposal files were not yet written at this checkpoint. Parent created `docs/keyword-audit-2026-10-02.md` with scope/method/status.
- Pre-audit catalog snapshots saved at `/tmp/kemtit-keyword-before-th.json` and `/tmp/kemtit-keyword-before-en.json` (already include the touch-first QuickTaskInput placeholder fix). Use them for exact copy diffs after applying proposals, not to overwrite later unrelated changes.
- Parent browser verified Life entity “นิสัย” vs Today “กิจวัตร”, Life description exposes implementation (“same core system”), Inbox note hint is Enter-only although Save button exists. Cancelled empty note composer; no note saved. Current tab is `/inbox`, viewport reset.
- Important semantic cautions: entries.quick.hint “เข็มและกราฟ” likely means CompassDial needle, not an abbreviated brand; use clearer progress wording rather than falsely flagging brand misuse. Legacy onboarding first-goal may actually auto-create weekly goals, so preserve true automation claims there. Generic dashboard empty-state “Kemtit can break it into weekly work” may overpromise; check its actual goal link. Freelancer role guidance may legitimately mention external invoicing as a task, but must not imply a native invoice module.
- Planning proposal now written: `docs/keyword-audit-planning-2026-10-02.json`, 442 leaves,10 findings. Parent approved exactly3 keys and delegated planning_workflow to apply them now: widgets.goalProgress.empty.description, today.capacityHeading, workflowGuide.priorityRule. Reject invoice rewrites because they unnecessarily change valid external-work guidance and some change overdue-payment meaning into overdue-preparation; keep proposal trail. Other two agents remain read-only and were explicitly asked to stop expanding research and finish their JSON files. Single writer currently planning_workflow; wait for completion before a second writer edits catalogs.
- CUA persistent browser id2, auditTab id1 at localhost Today with synthetic employee QA account. `viewport` currently768×1024; reset after verification. If compacted, call cua.rewriteDocumentation before continuing.
- No reset/clean/commit/deploy. Huge dirty worktree predates this task. Use current source, preserve other changes. Prior completed workflow work below remains valid, but whole-system audit is **in progress**.

## Final handoff — local scope complete

- All four profession journeys passed on mobile, tablet and desktop: 12 E2E.
- Role guidance passed 4 E2E with 4 roles × 4 horizons × 5 sizes = 80 cases (1440, 1024 landscape, 768 portrait, 390, 360).
- Relevant E2E total: 30 unique tests passed (Capture 8, guide 4, planning 3, Calendar 3, personas 12). Failed preliminary persona runs were corrected for real UI paths and scoped selectors; final persona runs are green.
- Full unit suite: 480 passed / 9 skipped. Last copy/disclosure changes: 30 focused tests passed. Final scoped lint and final typecheck passed.
- Source and tests are stable; no active pnpm process. No remaining implementation step in this local scope. Do not imply production deployment or physical iPad Safari validation.
- Final reports: `docs/workflow-simplification-2026-10-02.md` and `docs/workflow-persona-qa-2026-10-02.md`.
- Durable evidence: `docs/qa/workflow-2026-10-02/` contains 80 guide images, 12 persona images and verification logs. `kemtit-workflow-mobile-e2e.log` is the historical run containing the passing mobile planning test and preliminary persona failures; the later `personas-*-final.log` files supersede those persona failures.
- Browser is back to Thai, viewport override reset, Today tab marked deliverable. It uses synthetic local QA data.
- Latest copy fixes: concise Capture hint, smart-default explanation inside optional details; neutral time-estimate text when no task is selected; clear goal/task actions. Today guide follows core work on mobile.
- Touch-first follow-up: Today inline task entry keeps Enter submission and now has a primary 44px “เพิ่มงาน” / “Add task” button; its placeholders are “ชื่องานวันนี้” / “Task for today”. Domain selection and task payload are unchanged. Parent owns tablet/mobile tap verification and integrated typecheck/catalog checks.
- User instruction persists: update this handoff before every future context compaction. Earlier checkpoints below are historical, superseded by this final section.

## Scope and instructions

- Analyze and implement fewer manual steps using the existing Prototype style; preserve canonical data and validation.
- Order profession-specific steps across year/month/week/day and simulate all supported roles: employee, seller, student, freelancer.
- Latest direction: correct confusing copy/keywords/UX, prioritizing iPad/tablet/mobile.
- Update this handoff before each context compaction. Do not reset, clean, commit, or deploy the pre-existing dirty worktree.

## Implemented, undergoing final verification

- QuickCapture: live preview, one confirm action, optional details, visible missing amount/title validation, retry and duplicate-submit protection.
- DailyPlan: suggest up to three tasks only for new plans, preserve saved choices, order Today by confirmed priorities.
- TimeBlock: suggest a fitting free interval and duration; preserve edits; show no-slot state instead of inventing availability.
- WorkflowGuide: ordered three-step guidance for four roles and four horizons, contextual links with selected dates.
- Documentation: `docs/workflow-simplification-2026-10-02.md` and `docs/workflow-persona-qa-2026-10-02.md`.

## Verified so far

- Baseline: 426 unit tests passed, 9 skipped; typecheck passed.
- Current full unit run: 480 passed, 9 skipped; 89 test files passed, 6 skipped (`/tmp/kemtit-workflow-full-final.log`).
- Current typecheck passed (`/tmp/kemtit-workflow-typecheck.log`).
- Capture E2E: 8 passed desktop/mobile (`/tmp/kemtit-workflow-capture-e2e.log`).
- Manual in-app browser: saved task appears in Today/Calendar; expense 125.50 persists in Finance; suggested daily priority saves and survives reload; suggested time block saves successfully; employee monthly guide opens correctly.
- GitNexus refreshed; impact TimeBlock HIGH (Today and Calendar), disclosed before edits. Route entrypoints UNKNOWN verified with source. Existing authorization, idempotency, persistence contracts retained.

## Historical checkpoint (superseded by final handoff above)

- Source stable except capture agent shortening capture.hint. Today guide now beside settings on desktop, below core work on mobile; tasks visible in first 390px viewport. Guide secondary prose is inside details, links/disclosure use 44px targets. English action corrected to "Go to today's tasks".
- Latest typecheck passed after planning edits (`/tmp/kemtit-workflow-typecheck-final.log`); scoped lint passed (`/tmp/kemtit-workflow-lint-final.log`). Planning/core/catalog tests 78 passed (`/tmp/kemtit-workflow-planning-final.log`).
- Role guide E2E: 4 passed, covers 4 roles × 4 horizons × 4 widths = 64 cases (`/tmp/kemtit-workflow-role-final.log`). Screenshots preserved under `docs/qa/workflow-2026-10-02/`; reviewed student 360/390/768/1440, no visual defect.
- Planning E2E: mobile passed (`/tmp/kemtit-workflow-mobile-e2e.log`), tablet+desktop 2 passed (`/tmp/kemtit-workflow-planning-e2e-final.log`). Saved order survives reload; fixed manual-time conflict still rejected.
- Calendar existing E2E: 3 passed across mobile/tablet/desktop (`/tmp/kemtit-workflow-calendar-final.log`).
- Persona E2E is NOT passed yet. Earlier runs had ambiguous selectors (type/domain same text, title in select and timeline, duplicate currency summary) and incorrect test setup. Employee all-day meeting correctly left no slot; use a realistic timed EventForm. Freelancer test bypassed actual CTA and omitted project query; production QuickAddHost already passes context correctly, do not alter production for this test error.
- Capture agent is fixing persona tests to use actual project CTA and assert preselection, timed meeting, scoped readback. Run mobile first; then tablet/desktop after passing. No pnpm process currently running.
- CUA manually verified English Today/employee guide/capture preview and accessible labels. Restore synthetic QA account to Thai, reset viewport, leave Today tab deliverable. `auditTab` currently closing unsaved English capture; observe fresh state.
- Remaining: finish persona E2E, preserve screenshots, final impacted lint/unit/type verification for last copy/test changes, fill QA report and checklist with actual evidence, update this handoff.

## Agents and ownership

- `/root/capture_workflow`: QuickCapture plus capture/persona E2E.
- `/root/planning_workflow`: DailyPlanForm, TimeBlockForm, workflow-suggestions, Today and minimal Calendar wiring, v2-planning E2E.
- `/root/role_workflow`: role-workflow, WorkflowGuide, Plan wiring, workflowGuide locale namespace, role-workflow E2E.
- Parent: integration review, serialized checks, browser QA and reports.

## Environment / evidence notes

- Existing development server: localhost:3000; local Supabase and Mailpit only. Do not restart the user's server without a concrete need.
- Browser binding `browser` id 2, tab `auditTab` id 1; localhost Today; synthetic local employee QA account. CUA must refresh documentation after compaction, then reuse bindings. Reset viewport override when finished.
- E2E screenshot outputs are under `test-results`; copy selected evidence to a durable docs path before later Playwright runs clear that folder.
- No production deployment or live engagement measurement. Role simulation is not a study with real users; responsive Chromium is not physical iPad Safari validation.
- Memory used: MEMORY.md lines 242–248, rollout 01a0d937-80ee-75d0-8506-7058b21e46f4. Final response needs the required memory citation block.
