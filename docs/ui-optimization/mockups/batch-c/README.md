# Batch C mockups — Inbox and Tasks

Status: approved, implemented, and visually verified.

## Review boards

- [Inbox capture, list, and Undo](inbox.png)
- [Tasks list and responsive task details](tasks.png)
- [Editable preview source](preview.html)

Each board shows Desktop **1440 × 900**, Tablet **768 × 1024**, and Mobile **390 × 844** viewports.

## Design decisions

- Inbox follows Title → Domain → Save. Priority remains under “ตัวเลือกเพิ่มเติม”.
- Inbox rows show user-provided title, domain, priority, plan date, and Plan Today action. Delete stays secondary and the Undo state remains above mobile navigation.
- Tasks uses compact search and filters with grouped, readable rows; it does not turn every task into a card.
- Task detail presents planned date, deadline, and recurrence with separate labels. The same detail state becomes a full-width bottom sheet on mobile.
- Content cards, form fields, and mobile actions use the full available content width and stack vertically.
- Sample titles and dates are annotated as illustrative layout examples, not seeded production data.

## Reproduce

From the repository root, run `node docs/ui-optimization/mockups/batch-c/render.mjs`. The script writes two PNG boards beside the preview. It reuses the shared Batch B board styling and the bundled IBM Plex Sans Thai fonts.

## Source behavior and route contract to resolve

- Inbox capture and rows follow `src/components/inbox/InboxCapture.tsx`, `src/components/inbox/InboxList.tsx`, and `src/app/(app)/inbox/page.tsx`.
- Tasks details follow the existing `TaskList` responsive dialog/sheet behavior and current Undo actions.
- Current `src/app/(app)/tasks/page.tsx` redirects to `/inbox?view=planned`, while `InboxPage` does not read `view` and `getInboxTasks()` returns only tasks whose status is `inbox`. Batch C production work must resolve that route behavior while preserving the canonical Task ID.

Batch C production may begin after Batch B is complete. Resolve the `/tasks?view=planned` route contract without changing canonical Task identity.
