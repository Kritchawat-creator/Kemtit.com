# Sidebar consolidation — 2026-10-08

Status: implemented and verified. See `docs/qa/sidebar-consolidation-2026-10-08/QA-REPORT.md` for Chrome results and screenshots.

## Decision

Use one left-sidebar entry for each distinct page. Preserve the page-local view selectors and every existing route. Keep the All / Work / Life scope controls because Today actually filters records by scope.

| Existing entries | Destination / behavior | Change |
| --- | --- | --- |
| Plan + Year / Month / Week | `/plan` with `view`; the page already exposes all three horizons | Keep one Plan link |
| Calendar + Day / Week / Month | `/calendar` with `view`; the page already exposes all three views | Keep one Calendar link |
| Insights + Overview / Productivity / Time / Life balance | `/insights` with `tab`; the page already exposes seven report tabs | Keep one Insights link |
| Workspace + Inbox | Both link to `/inbox` | Keep Inbox; show Tasks and the role-specific work page directly |
| Routine + Life | Both link to `/life` | Keep Life and Reviews as separate destinations |

The fully expanded navigation has 22 links for general accounts, 23 for professional/seller accounts. The result should contain 10 or 11 unique page links respectively. These counts exclude the brand home link, scope controls, Quick Add and footer Settings. The former default collapsed groups hid several distinct destinations; the new menu makes those destinations directly accessible even in icon-only mode.

Order: Today, Inbox, Tasks, Projects (professional) or Sales (seller), Plan, Calendar, Goals, Finance, Life, Reviews, Insights.

## Preserve

- Inbox and Tasks remain distinct: capture/review versus the task library.
- Plan and Calendar remain distinct: goal horizons versus scheduled events/time blocks.
- Life and Reviews remain distinct: habits versus weekly reflection/carry-over.
- Existing filters, data, permissions, work-mode selection, profile display, task badge, Quick Add and Settings.
- All/Work/Life controls, mobile drawer destinations and bottom navigation.
- Direct URLs and page-local Year/Month/Week, Day/Week/Month and Insights tabs.

## Impact and verification

GitNexus repository: `Kemtit.com`, current checkout `/Users/kritchawatpattharawiwatkul/Documents/Kritchawat-Projects/Kemtit.com`; index refreshed at 2026-10-08T15:34:15Z before this change. `Sidebar` upstream impact is LOW: ShellFrame directly, AppShell and AppLayout indirectly, two affected flows. `hrefMatches` upstream impact is LOW. Local Next.js navigation documentation was read before implementation.

Test translated labels, unique destinations, every work mode, matching active page on query/nested routes, badges and icon-only accessibility. In installed Google Chrome, click destinations and page-local view controls, collapse/expand the sidebar, check responsive containment and smoke-check the mobile drawer. Preserve earlier QA reports; save this change's evidence under a separate directory.
