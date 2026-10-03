# Layout and grid audit — 2026-10-02

## Reference and scope

The user confirmed `/prototype` as the styling reference. This audit compares the production shell with its default Modern Minimal theme and checks actual connected Chrome rendering on the local app.

Viewport widths: **1800, 1440, 1151, 1024, 768, 390, 360px**. The 1151px case specifically exercises the expanded desktop sidebar with narrow content cards.

The route matrix contains **168 requested-route/viewport combinations**, plus a separate Today baseline. Every matrix case had zero document horizontal overflow and no visible text-bearing grid child below 48px wide. These broad measurements are screening checks; visual review identified the Inbox flex-row issue that a grid-only detector would miss.

| Requested screen | Views checked | Coverage note |
| --- | --- | --- |
| Today, Inbox, Tasks | Main views | Existing seller account data |
| Plan | Year, month, week | Each view at all seven widths |
| Calendar | Month, week, day, event list | Each view at all seven widths |
| Goals | List and existing goal detail | Detail checked at all seven widths |
| Finance, Life, Insights, Settings | Main views | Includes empty sections in this account |
| Work sales | Main view | Seller account |
| Reviews, Rescue, Archive, More | Main views | Existing account state |
| Work projects | List and empty-task detail | Separate employee QA account; both routes checked at all seven widths with Playwright |
| Entries, Dashboard | Redirect to sales and Today | Aliases, not additional distinct screens |

An existing Today task detail sheet was opened at 360px without saving changes. Its bounds were 0–360px with zero document overflow; controls were visually readable. The sheet was closed and the temporary browser viewport override was reset.

## Confirmed bugs and fixes

### Large unused column space

The user supplied a Today screenshot and explicitly required all pages to avoid this layout. A second connected-Chrome density sweep covered the main route matrix at the normal 1800px viewport. Today reserved three independent columns whose content heights were **392, 834, and 1380px**, leaving approximately **988px** of unused vertical space beneath the shortest stack. This is a separate structural problem from the collapsed Workflow guide text.

Today now uses content-sized, indivisible cards in a balanced column flow: one column through 1150px, two from 1151px, and three from 1440px. At 1800px the overall card area decreased from 1380px to approximately 989px, and the longest unused column tail decreased from 988px to approximately 328px. Remaining differences are bounded by indivisible card heights rather than reserved groups of cards. Card DOM/tab reading order matches the visual column-major flow; no card is split across columns. The guide's nested bottom margin is overridden within Today so sibling spacing stays 16px.

Connected Chrome checked Today with all/work/life scopes across all seven widths: 21 combinations, zero document overflow and zero split cards. Mobile uses a single vertical stream with unchanged card order.

The other inspected desktop page grids had no comparable thousand-pixel column imbalance in this account state. Settings had a 243px column-height difference; Calendar and Finance differences were approximately 93–112px. A more detailed Life measurement identified a second sparse-state issue: its goals section occupied 622px while its heading and empty message occupied only 100px; it shared a row with a 622px habits form. With no life goals, the page now puts the compact goals message above the habits card. Connected Chrome at all seven widths measured the goals section at approximately 112px with a 16px gap and zero page overflow. The populated-goals layout is preserved.

An isolated employee-role project fixture exposed 476px of unused space beneath an empty task panel in project detail. Empty-task project details now stack the existing aside and task section with a 16px gap, while populated details retain their grid. The new project regression passed list and detail at all seven widths; at 1800px the empty detail panel had zero unused tail. A one-card project list had a 337px tail next to its create form; no source change was made to that list.

### Shared sidebar Quick Capture containment

The user pointed out the sidebar's Quick Capture control. Connected Chrome confirmed that its button was approximately 258px wide inside a 239px parent, extending about 19px beyond the parent. Opening the Quick Capture dialog succeeded; no content was submitted.

A separate control-containment sweep checked 23 requested URLs at all seven widths (161 cases). The same shared sidebar overhang was the only detected main/sidebar button or form-control parent-boundary violation above 3px. It repeated at the three expanded-sidebar widths on every requested route. Mobile drawer and collapsed-sidebar states are checked separately by regression tests.

The footer's implicit grid track was expanding to the button's intrinsic width. The shared Sidebar footer now has an explicit single `minmax(0,1fr)` track and a zero minimum width; the sidebar variant of `QuickAddMenu` also has explicit minimum/maximum width containment. Connected Chrome now measures both button and parent at 239px with zero overhang. The complete 161-case control sweep was repeated after the fix and found zero violations. Description ellipsis is intentional; full accessible dialog copy is retained.

### Today workflow guide

The original viewport-based two-column breakpoint applied inside a narrow sidebar card. At 1800px viewport width, its grid tracks were `0px 319.594px`; the narrative collapsed into vertical letters. At 1440px the first track was also zero.

`WorkflowGuide` now uses a named container query. It stacks below 40rem of actual card width and keeps two columns in a sufficiently wide Planner card. Connected Chrome passed all seven widths after the fix. The 1800px narrative column measured approximately 335px instead of zero.

### Inbox task row

At 1151px, the original desktop flex row let the date and action controls squeeze the title column to approximately **22px**. The title became a vertical stack of characters despite zero document overflow.

`InboxList` now switches the row at 42rem of actual list width and the action controls at 26rem. Connected Chrome title widths after the fix were approximately 515, 271, 465, 353, 232, 324, and 302px at the seven widths respectively. Both row and document overflow were zero.

## Styling comparison

### Repeatable acceptance checks

For subsequent UI changes, inspect the affected production routes against `/prototype`, including empty and populated content where available. Check both page overflow and child-to-parent containment: a page can have zero horizontal overflow while a title collapses or a sidebar button protrudes.

- Preserve the shared page insets: 12px through 380px, 16px through 760px, and 24px above 760px. Mobile bottom clearance reserves space for navigation.
- Use the existing spacing scale. Card streams use 16px gaps; wide page grids may use 24px gutters. Avoid nested margins doubling those gaps.
- Keep the default outer card radius at 14px. Distinguish outer cards from nested controls, badges, and decorative shapes.
- Let content determine height. Compare sparse and populated states; avoid stretching empty panels to match a tall adjacent form. Balanced card columns may leave a tail bounded by an indivisible card, but must not reserve a mostly empty column for a group.
- Verify text, buttons, form controls, and graphics against their immediate container, including expanded/collapsed sidebar and mobile drawer states. Use container width for nested layouts.
- Recheck navigation/dialog open and close behavior, reading order, and narrow-screen controls after layout changes.

### Extended device screening

A follow-up connected-Chrome pass checked the same 23 requested URLs at **320px and 2560px** (46 additional route/width combinations). All 2560px cases had zero document overflow and no collapsed text-bearing grid cells. At 320px the calendar's day/week/month toolbar exposed a new overflow; other cases had zero document overflow. The settings email truncation, screen-reader-only review headings, and a decorative goal-list offset are intentional and excluded.

Quick Capture was opened and closed without submitting at **320 × 568** and **768 × 600**. The dialog and its controls stayed within the viewport; document overflow was zero. The phone dialog was 320px wide and about 362px tall; the tablet dialog was 512px wide and about 309px tall.

The calendar range navigation previously required a 312.51px unbroken row inside the 296px mobile content area. It now wraps the Today action below the date navigation when needed. The previous/next controls retain their size and date text can wrap. Connected Chrome replayed day/week/month at 320px after the change: zero document overflow and no overflowing toolbar containers.

The prototype default uses a pale background, white surfaces, `#e4e7ec` borders, purple primary color, and 14px card radius. Production shell padding was consistent across the audited routes: 24px desktop, 16px intermediate/mobile, and 12px at the smallest width. Most audited cards matched the 14px radius and border color.

The follow-up repaired two additional inconsistencies:

- Finance's starter panel and goal cards now use the default prototype's 14px outer radius instead of 18px. Existing form padding remains on the shared 4px spacing scale.
- Goal detail's fixed 224px dial overflowed its 212.33px inner box at 1151px. Its width is now bounded by its container while preserving a square aspect ratio and the existing 196/224px maximum sizes. Connected Chrome verified all nine widths from 320 to 2560px: no dial containment violation or document overflow. At 1151px both dial dimensions and its parent width measured 212.33px.

The mobile navigation drawer was also opened at 320 × 568: it measured 296 × 568px, its menu area scrolls vertically (319px viewport / 575px content), and document overflow was zero. The drawer was closed without navigating or saving.

Together, the original and extended screening cover **216 requested-route/width combinations**: 23 requested URLs and one goal detail at nine widths. Alias redirects remain counted as requested URLs, not additional distinct pages. Employee project fixtures, Today scope variations, sidebar states, and dialog checks are additional targeted coverage.

Intentional account-email/heading truncation, screen-reader-only text, and decorative negative margins were excluded from bug counts.

## Verification and boundary

Production files changed:

- `src/app/(app)/today/page.tsx`: balanced card flow and matching reading order.
- `src/app/(app)/life/page.tsx`: compact empty-goals composition.
- `src/app/(app)/work/projects/[id]/page.tsx`: compact empty-task composition.
- `src/components/inbox/InboxList.tsx`: container-based row/action breakpoints.
- `src/components/planning/WorkflowGuide.tsx`: container-based guide grid.
- `src/components/layout/QuickAddMenu.tsx`: sidebar button width containment.
- `src/components/layout/Sidebar.tsx`: constrained footer grid track.
- `src/app/(app)/goals/[id]/page.tsx`: proportionally contained goal dial.
- `src/components/finance/FinanceStarterGuide.tsx`, `src/app/(app)/finance/page.tsx`: consistent 14px outer panel radius.
- `src/components/domain/CalendarNav.tsx`: contained range toolbar with wrapping Today action on narrow screens.

Regression files: `e2e/inbox-tasks.spec.ts`, `e2e/role-workflow.spec.ts`, `e2e/life-layout-density.spec.ts`, `e2e/today-layout-density.spec.ts`, `e2e/project-layout-density.spec.ts`, `e2e/sidebar-layout.spec.ts`. This report, `tracking-log.md`, and the linked screenshots record the evidence.

- Workflow guide unit regression: 4 passed.
- Workflow guide responsive Playwright regression: 1 passed, covering Today and wide Planner geometry.
- Scoped ESLint: passed.
- Production webpack build: passed.
- Final TypeScript check: passed after the build regenerated conflicting local generated types.
- Final full unit suite: 481 passed, 9 skipped.
- Focused responsive Playwright regressions: 6 passed (Inbox, Life, Projects list/detail, Workflow guide, Today density, and Sidebar). Today density covers three scopes at all seven widths; the other responsive specs also exercise their width matrices.
- Added tests assert readable title bounds, card containment, unsplit cards, document overflow, compact empty-state height, DOM/visual order, and balanced card tails. The Inbox regression waits for the existing shell padding transition rather than reloading after viewport changes.
- The Sidebar regression checks expanded/collapsed navigation, both mobile drawer triggers, and Quick Capture open/close from sidebar, TopBar, and BottomNav without submitting content. Its initial locator failure was fixed to inspect a background trigger via DOM while Radix makes it inaccessible during a modal. The rerun passed.
- GitNexus pre-edit impacts were LOW for WorkflowGuide, InboxList, and Sidebar; QuickAddMenu was HIGH and its four direct callers were reviewed before the sidebar-only change. Route impacts were UNKNOWN; framework entry points and route references were confirmed with text searches. The final index contains 8,239 nodes / 693 flows. Whole-diff detection returned 18 changed indexed symbols and 39 affected processes across 10 tracked files, aggregate CRITICAL. Route contexts and the diff were reviewed; queries, actions, authorization, and data contracts are unchanged. New untracked test/report files are not represented by those changed-file counts.

Follow-up checks after the goal, finance, and calendar changes:

- Production webpack build, TypeScript, scoped ESLint, and diff whitespace checks passed.
- CalendarRangeNav impact was LOW, with CalendarPage and its story as direct callers. FinanceStarterGuide impact was LOW with FinancePage as its caller. GoalDetailPage and FinancePage were UNKNOWN as framework route entries, confirmed by text search.
- Refreshed GitNexus index: 8,263 nodes / 695 flows. Whole tracked diff: 14 files / 50 indexed symbols / 50 affected processes, aggregate CRITICAL. The new source changes are CSS class changes; queries, actions, and authorization remain unchanged.
- New desktop-width regression assertions require main/header content to clear the expanded sidebar before screenshots, avoiding false positives during the shell padding animation.
- Calendar responsive Playwright regression passed: one scenario with 24 view/width combinations, usable range controls, and previous/next/Today navigation at 320px. Navigation expectations follow each control's destination because month navigation normalizes to month boundaries.
- Finance/goal responsive Playwright regression passed with the sidebar-offset guard: one scenario checks populated Finance goal panels and the detail dial at all nine widths. Both corrected 1151px screenshots were visually reviewed. Together with the six earlier focused scenarios, eight responsive regression scenarios passed.

Screenshots use isolated local QA fixtures:

- [Today at 1800px](layout-grid-2026-10-02/today-1800.png)
- [Today at 1151px](layout-grid-2026-10-02/today-1151.png)
- [Inbox at 1151px](layout-grid-2026-10-02/inbox-1151.png)
- [Life at 1800px](layout-grid-2026-10-02/life-1800.png)
- [Project detail at 1800px](layout-grid-2026-10-02/project-detail-1800.png)
- [Populated Finance at 1151px](layout-grid-2026-10-02/finance-goal-1151.png)
- [Goal dial at 1151px](layout-grid-2026-10-02/goal-detail-dial-1151.png)
- The Today screenshots also show the repaired sidebar. Separate sidebar-test captures showed the page loading skeleton, so they were excluded from review evidence.

This is a layout audit of the rendered states above, not certification of every function, every role, every dialog, dark mode, populated financial states, or hosted production deployment. No user records were changed during connected Chrome inspection. Regression fixtures use separate local QA accounts. No commit, push, or deployment was performed for this repair.
