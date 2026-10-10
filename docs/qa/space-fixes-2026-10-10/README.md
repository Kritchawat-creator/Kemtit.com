# Layout fixes — 10 October 2026

Implemented the seven findings in [the original review](../space-review-2026-10-10/README.md). This report records local verification; production publication is verified separately against the deployed commit.

## Changes

1. Calendar event/bill context uses natural height, so flex shrink cannot hide its contents.
2. Month overview uses a compact 20rem column only when its container can accommodate it. TimelineBoard uses its own container width, allocates readable tray space, and places scheduling actions below the title. Photos stack above titles in narrow cards.
3. Removed the outer month pane scroller. The timeline retains its time-grid scroller; a sibling task scroller exists only when the board has room for two columns. Positioned time-block rows contain their screen-reader labels, eliminating document overflow from those labels.
4. Plan year/month/week navigation precedes the goal overview. Each life area initially shows one goal, with a native, translated disclosure for the remaining goals. Goal detail links preserve selected date and scope.
5. Grouped and ungrouped task cards align to their own content height, retaining existing reading order and drag/drop handlers. Grid rows still accommodate the tallest card; this is not a masonry redesign.
6. Today renders two metric columns when there are two metrics. With three metrics, the last spans the narrow-screen row. Main panels no longer stretch to match their neighbour.
7. Rescue header, date, calendar action, back link and content share one centered 768px maximum-width container.

## Browser verification

Connected Chrome, existing local seller QA account. Ten views at 1440×1000, 1151×900, 768×1024, 390×844 and 360×800: **50 unique cases**.

Views: Calendar month/week/day; Today current and 4 October; Rescue; Plan year/month/week; Tasks card mode.

- No document horizontal overflow in all 50 cases.
- Document height and body height differ by less than 1px in all 50 cases; the former 788px blank mobile calendar tail is gone.
- Calendar month event/bill context is about 133.6px tall, formerly 0px.
- Month tray title width: 1440px screen 69px → 208.9px; 360px screen 111px → 194px.
- Today without a daily plan: two equal 556px metrics use the 1124px desktop content area. Tablet with a daily plan: third metric spans the full 720px row.
- Rescue header and both content sections share x=470 and width=768 at 1440px.
- A no-photo task card previously stretched to 456.8px is now 160px, including its 158px content and borders. The neighbouring photo card keeps its cover and detail content.
- Monthly goal overview height is about 805px rather than 1450px on desktop. Period navigation appears before it.
- Manually opened and closed the three remaining goals on mobile; all three original links remain accessible with date/scope return context.
- Manually opened the mobile schedule dialog and pressed Escape. It closed and restored focus to the scheduling button without saving a mutation.

See [measurements.json](measurements.json), [specific-checks.json](specific-checks.json), and matching PNG/DOM text files. Representative results: [Calendar](./_calendar_view_month_date_2026_10_10_scope_all-1440.png), [Rescue](./_rescue-1440.png), [Plan](./_plan_view_month_date_2026_10_10_scope_all-1440.png), [Task cards](./_tasks_mode_cards_view_planned-1440.png).

## Automated verification

- Expanded relevant Vitest run: **138/138 tests, 21/21 files passed**, with `--maxWorkers=2`; see [vitest.log](vitest.log).
- Includes scheduling/undo, group operations, planning/rescue, and new tests for additional-goal disclosure and conditional Today metric content.
- The first unrestricted parallel run had one timeout in the existing RescueReview Undo test (137 passed). That unchanged test passed 5/5 in isolation, followed by the full relevant 138-test pass with two workers. This is recorded rather than presenting the first run as clean.
- Typecheck and targeted ESLint results are stored alongside this report.
- `git diff --check` passed.

GitNexus pre-edit impacts were inspected for the affected symbols. Shared Calendar/Planner components carried HIGH impact; page entrypoints with UNKNOWN callers were verified through Next.js route conventions and source references. Pre-commit analysis reports 15 touched symbols and 66 affected flows, **Critical** aggregate risk, without partial/truncated flags; see [gitnexus-changes.json](gitnexus-changes.json). The change remains presentation-only: no API, schema, authorization or scheduling mutation contract changes.

## Limits

This is scoped layout and interaction regression testing, not every application function or production authentication. Responsive sizes were tested in Chrome, not physical iPad/Safari. Native mouse/touch dragging was not repeated in this browser round; existing drag/drop component tests passed. Natural empty time slots and unequal grid-row tails may remain where they represent actual data/layout structure. Unrelated existing untracked files were preserved.
