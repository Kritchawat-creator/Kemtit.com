# Batch A mockups — Navigation and common shell

Status: approved and implemented for Batch A. Production QA screenshots are in [the Batch A QA report](../../qa/batch-a/README.md).

## Review boards

- [All four boards (PDF)](batch-a-mockups.pdf)
- [App shell and primary navigation](01-app-shell-navigation.png)
- [Page Header and compact Planner segments](02-page-header-compact-segments.png)
- [Page Header and horizontally scrollable Insights tabs](03-page-header-scrollable-tabs.png)
- [Secondary route active state across breakpoints](04-secondary-route-navigation.png)
- [Design philosophy](design-philosophy.md)

Each board includes the required **Desktop 1440 × 900**, **Tablet 768 × 1024**, and **Mobile 390 × 844** artboards.

## Plan checks represented

- Navigation active state uses a subtle surface, icon, and typography; no colored left stripe.
- Tablet Rail prioritizes Today, Plan, Inbox, Calendar, Insights, and More.
- Mobile keeps Today / Plan / + / Insights / More, with More active on secondary routes.
- Planner retains the current Year / Month / Week route selector; Today is a separate shortcut.
- Insights tabs may scroll horizontally while the page body stays within the viewport.
- The Tablet segmented control shows a keyboard focus ring.
- Empty states contain no invented personal records or financial values.
- Thai labels and the current IBM Plex Sans Thai assets are used.

The implementation plan requires approval of each relevant mockup batch before production implementation begins. Batches A–C are implemented; Batches D–G remain staged for mockups and approval.
