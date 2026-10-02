# Today: priorities before schedule

Status: draft for review. Production implementation requires approval of this mockup.

## Preview

Open [preview.html](preview.html) directly in a browser. The page is self-contained and uses the IBM Plex Sans Thai font files already bundled with the project. It contains synthetic data only; its controls change local preview state and do not call the app, API, calendar, or database.

The preview switcher shows three cases: three selected priorities (including a completed task), no priorities selected, and no open tasks. The picker permits up to three user-selected tasks; it does not rank or assign tasks automatically. Checkboxes, priority ordering, adding a sample task, and the disclosed forms are local demonstrations.

## Layout decisions

- The first content block is **3 งานสำคัญวันนี้**. A visible edit/select control opens the picker in both selected and unselected states. A user can complete or reorder chosen items there. A completed selected task remains visible so the focus list does not silently change when progress is recorded.
- The neutral schedule follows the priority block. It distinguishes task time blocks from calendar events. Adding a time block is available in a disclosure so its task link and start/end controls remain discoverable without making the initial screen taller.
- Other due and overdue tasks appear after the schedule. Capacity, routines, notes, the monthly goal, and a due-bill attention item stay available in a compact full-width support grid below the operational sections.
- Desktop uses two independently sized columns for priorities and schedule, then places remaining tasks and the support grid at full width. The support grid has three columns on wide screens and two on tablet; phone uses one column. At tablet and phone widths the operational reading order is priorities, schedule, then remaining tasks. The layout has no fixed-height content cards or decorative left rails.
- Main task and schedule titles use 14px type, controls have touch-sized targets, keyboard focus is visible, and form fields respond to narrow screens. The page uses the current neutral purple visual language.

## Product behavior represented

The production Today route is `src/app/(app)/today/page.tsx`. Its daily-plan data includes persisted `top_priorities`, available minutes, and notes. `src/components/domain/DailyPlanForm.tsx` already lets a user choose up to three task IDs. Today currently presents due/overdue/completed task groups rather than a separate priority projection; the proposed first section uses those stored IDs to make that existing choice visible.

When implementing this layout, resolve selected IDs against the day's task rows instead of inventing priorities. Keep selected completed rows visible and checked. Let the user explicitly remove them or choose replacements. Keep unselected and overdue work available below the schedule. The existing form only offers open tasks as new choices, so preserving a completed selection should not require making completed tasks newly selectable.

The current `src/components/domain/TimeBlockForm.tsx` supports a title, optional task or occurrence link, and start/end times. The schedule mock distinguishes those blocks from calendar events, and its disclosure keeps the manual time-block path reachable. Capacity and calendar values in the mock are illustrative sample values, not a claim about the signed-in account.

## Review notes

- Review at 1440 × 900, 768 × 1024, and 390 × 844. The root Chrome pass reviewed the first desktop render and requested the visible priority editor, same-row checkboxes, and full-width support grid; those corrections are now in this draft. Recheck all three viewports before approval.
- All names, task titles, durations, schedule entries, capacity values, routine state, goal progress, bill, and date are synthetic examples. The banner remains visible in every viewport.
- Quick Capture, route links, and forms are represented for discoverability. Their preview actions show an explanation and never navigate or write data.
- Keep production changes behind the separate implementation and review gate. This folder contains only the design artifact and its notes.
