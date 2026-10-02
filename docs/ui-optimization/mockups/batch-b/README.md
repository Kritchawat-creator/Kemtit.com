# Batch B mockups — Today and Quick Capture

Status: approved, implemented, and visually verified.

## Review boards

- [Today](today.png)
- [Quick Capture — input state](capture-input.png)
- [Quick Capture — proposal and confirm state](capture-proposal.png)
- [Editable preview source](preview.html)

Each board shows the required Desktop **1440 × 900**, Tablet **768 × 1024**, and Mobile **390 × 844** viewports.

## Design decisions

- Today keeps the task area first, followed by the neutral schedule and supporting capacity, routine, and finance cards.
- The mobile order is greeting and date, Quick Capture entry, a short summary, the actionable Today focus, schedule, and support.
- Mobile content blocks and form fields span the available content width; the Quick Capture domain and date fields stack vertically.
- Quick Capture opens the existing universal capture flow. Continue prepares a proposal; the user reviews and edits fields before saving.
- The capture example is visibly annotated as a user-entered flow. The Today board uses truthful first-day empty states and contains no invented tasks, amounts, times, or progress.
- Capacity is described without invented minute counts or a fabricated progress bar.
- Empty schedule and support cards use text as well as icons, and primary actions stay visible without hover.

## Reproduce

From the repository root, run `node docs/ui-optimization/mockups/batch-b/render.mjs`. This writes the three board PNGs next to the preview source. Shared board styling is in `board.css`; the preview uses the project's bundled IBM Plex Sans Thai font files.

## Source behavior represented

- Today empty state and task creation entry are based on `src/app/(app)/today/page.tsx` and `src/components/domain/QuickTaskInput.tsx`.
- Universal capture route, responsive dialog/sheet, inferred proposal fields, and confirmation copy are based on `src/components/layout/QuickAddHost.tsx`, `src/components/domain/QuickCapture.tsx`, and `src/components/ui/responsive-dialog.tsx`.
- The proposal example uses the existing parser behavior for `ส่งรายงานพรุ่งนี้` on 23 September 2569: Task, editable title, and proposed due date 24 September 2569. It is not a seeded production record.

Production screenshots and responsive checks are documented in [Batch B visual QA](../../qa/batch-b/README.md). The implementation keeps the existing capture server action and canonical item flows.
