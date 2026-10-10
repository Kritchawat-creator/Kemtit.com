# Full-system connected Google Chrome QA — current continuation

> Repair update: the findings below are historical reproductions. See [REPAIR-STATUS.md](REPAIR-STATUS.md) for the implemented fixes, verification evidence, and remaining test boundaries.

Date: 10 October 2026, Asia/Bangkok. **Status: in progress; full goal remains active.**

Latest confirmed findings: QA-01–QA-18. QA-18 concerns a locked interval being reported as a time collision by the legacy Calendar editor. QA-17 concerns skipped occurrences presented as completed in Today and the daily print page. QA-15 concerns indistinguishable recurring occurrences after a valid move; QA-16 concerns automatic dissolution of a one-member source group contrary to the approved contract. Neither finding claims deleted task records. See [COMPLETION-AUDIT.md](COMPLETION-AUDIT.md) for the consolidated acceptance gaps.

Objective: exercise every page and function through Google Chrome, verify behavior against its purpose, identify bugs, and prepare a repair plan. This report does not narrow that objective to the modules exercised below.

## Evidence boundary

- Current main checkout and local runtime at `http://localhost:3000`; connected installed Chrome, existing local Kemtit QA account.
- The preceding goal turn made progress: main-project planner implementation and browser/persistence/PDF evidence were delivered. It did not establish full-system completion.
- Historical full-system results are preserved at `../full-system-2026-10-08/QA-REPORT.md`. They cover an older checkout and must not be presented as a fresh complete run after the planner changes.
- Current planner evidence is at `../life-planner-delivery-2026-10-09/DELIVERY.md`. Its 659 unit/component passes, 16 local integration cases and successful build are supporting evidence, not substitutes for browser interaction.
- This continuation changed only QA documentation/evidence and clearly named local QA records. No application code, production data, provider permissions, security settings or deployment changed.
- Browser input observations, visible reloads and source inspection are separated below. No direct database readback was performed in this continuation.

## Executed current-state cases

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| FIN-01 | Entered negative expense -10 and clicked Save. Native input validation rejected it (`min=0.01`, invalid); no corresponding row appeared. | Pass |
| FIN-02 | Saved `QA 1010 — ค่าอุปกรณ์` expense 125.50. Reload retained the exact row and expense total. | Pass |
| FIN-03 | Saved `QA 1010 — รายรับทดสอบ` income 1000.75. Reload showed income 1000.75, expense 125.50 and net 875.25. | Pass |
| FIN-04 | Saved October budget 500.25. Reload showed remaining 374.75. | Pass |
| FIN-05 | Created `QA 1010 — บิลรายเดือน`, 249.90, monthly, due 10 October. Calendar week and selected-day detail displayed the same bill and amount. | Pass |
| FIN-06 | Marked that bill paid. Reload showed one paid October bill and one due 10 November bill, each 249.90. Expense became 375.40, net 625.35, remaining budget 124.85. | Pass |
| FIN-07 | Created finance metric goal `QA 1010 — เงินออมทดสอบ`, target 10000 THB. Set total to 2500.50, then 3000.25; reload retained 3000.25 and 30%, not their sum. | Pass |
| INS-01 | Clicked all seven Insights tabs: Overview, Productivity, Time, Finance, Goals, Routine and Life Balance. All rendered their respective content. | Pass for navigation/rendering |
| INS-02 | Finance report matched 1000.75 income, 375.40 expense, 625.35 net, 124.85 remaining from 500.25 budget; paid bill count 1 and due count 0 for October. | Pass |
| INS-03 | Goals report before the later sales-goal creation showed 3 active goals and 10% average, consistent with 0%, 0%, and 30% goals. Routine showed today 0/1 and week 1/4. Time showed 2 blocks totaling 60 minutes. Life Balance explained its item-count basis rather than claiming a life-quality score. | Pass for observed fixture state |
| INS-04 | Productivity called the three tasks “due this week”; Tasks separately showed planned dates and no deadline for these tasks. | Fail: QA-02 |
| INS-05 | Thai Overview/Time displayed `1h` and `30m`; source formatter always returns English suffixes. | Fail: QA-03 |
| REC-01 | Created `QA 1010 — ตรวจงานประจำวัน` for 10 October, daily, 15 minutes, no deadline. It appeared in Today. Checked completion; reload showed Today 1/3 and removed this completed occurrence from suggested unfinished priorities. | Pass for create/current-day completion |
| REC-02 | After that completion and a fresh navigation, weekly Productivity still reported 1 completed of 3 (33%), unchanged from before the daily task existed. Source explicitly excludes all recurring tasks. | Fail: QA-01 |
| SALES-01 | Followed empty Sales CTA, explicitly chose numeric measurement, created `QA 1010 — ยอดขายเดือนตุลาคม`, target 5000 THB. Sales displayed that goal. | Pass; default choice concern noted below |
| SALES-02 | Added an entry using +500 then +1000. Input became 1500; save/reload showed entry #K0045, 1500 THB and 30% progress. | Pass |
| SALES-03 | Edited #K0045 to 1250.25 and note `QA 1010 — แก้ยอดขายเป็นทศนิยม`. Reload retained both. | Pass |
| SALES-04 | Updated the total to 2000.50. Reload showed 40% and a separate adjustment #K0046 of +750.25, preserving the original 1250.25 entry. | Pass |
| SALES-05 | Both Add/Edit entry dialogs expose an unnamed amount spinbutton; DOM inspection showed empty id, no aria-label, and no associated labels. | Fail: QA-04 |
| EVENT-01 | Created Kemtit-only blocking event `QA 1010 — นัดตรวจแผน`, 10 October 09:00–09:30. List displayed its time and source. | Pass |
| EVENT-02 | During edit, used ArrowDown in native datetime input to make end 9 October, before start 10 October. Save displayed `เวลาสิ้นสุดต้องหลังเวลาเริ่ม` and retained the form. Restored day with ArrowUp. | Pass |
| EVENT-03 | Renamed to `QA 1010 — นัดตรวจแผนแก้ไข`, saved, reloaded: new title and original 09:00–09:30 persisted. | Pass |
| INBOX-01 | Created `QA 1010 — งานจากกล่องเข้า`, Growth, unscheduled. Reload retained it; “วางวันนี้” removed it from Inbox and showed it in Today with planned 10 October and no deadline. | Pass |
| TASK-01 | Added two subtasks, completed the first, moved it below the second, renamed the second. Reopened after reload and verified order, names and completion. | Pass |
| ARCH-01 | Archived that task, restored through Archive, reopened detail: planned date, Growth domain, subtask order and completion survived. | Pass |
| CAP-01 | Quick Capture parsed a note; closed without confirmation and verified no note was created. Reopened and confirmed; one note appeared. | Pass |
| NOTE-01 | Edited note to `QA 1010 — โน้ตแก้ไขและเก็บคืน`, archived, restored, then previewed conversion and selected Growth before confirmation. Note retained “แปลงเป็นงานแล้ว”; Tasks search returned one matching planned task with no deadline. | Pass |
| PROJ-01 | Seller access to Projects redirected to Sales. Temporarily changed local QA role to Freelancer and verified the Projects navigation. | Pass |
| PROJ-02 | Created a project linked to the QA sales goal, target 31 October; renamed it; added a 45-minute task and completed it. Reload retained 1/1 and 100%. | Pass |
| ARCH-02 | Archived/restored the project. Name, goal, target date, task completion and 45 minutes survived. Restored original Seller role, saved and reloaded. | Pass |
| SET-01 | Google/Outlook connection controls were disabled with unavailable-provider explanation; LINE remained unlinked. No provider authorization or notification setting changed. | Pass for unavailable states only |
| FEED-01 | Opened Feedback: five topic choices, submit disabled until one selected, no extra fields. Submitted one local QA “พบข้อผิดพลาด”; thank-you appeared. | Pass for flow; QA-05 for duplicate copy |
| UPD-01 | Opened Updates from its distinct entry point; empty published-release state rendered. No detail record was available. | Pass for empty state only |
| RES-01 | Rescue proposed four 30-minute tasks after the 09:00–09:30 blocking event. Confirmed; free minutes changed 450→330 and unscheduled 120→0. Reload retained all four placements. | Pass for apply/persistence |
| RES-02 | Undo was visible immediately after apply; after reload it disappeared, replaced by disabled “ยังไม่มีรายการที่ต้องย้าย”. | Fail: QA-06 |
| RES-03 | Created a separate 15-minute QA task through Quick Capture, applied 11:30–11:45, then immediately clicked Undo. Free minutes reverted 315→330; unscheduled 0→15. Reload retained this reverted state and all four earlier placements. | Pass for immediate Undo |
| CAP-02 | Task text containing “วันนี้ 15 นาที” defaulted to historical 30 minutes; explicitly edited duration to 15 in preview, confirmed. Rescue and Calendar unscheduled list showed the 15-minute task. | Pass for editable task capture; parser limitation below |
| CAP-03 | Text `จ่ายค่า QA ทดสอบบันทึกด่วน 42.75 บาท วันนี้` initially classified as Task. Manually selected Expense; parsed 42.75 and 10 October, confirmed, reloaded Finance. Exactly one row; expenses 418.15, net 582.60, budget remaining 82.10. | Pass for corrected expense capture |
| CAP-04 | `บิล QA บันทึกด่วน 88.50 บาท พรุ่งนี้` classified as Bill, due 11 October, one-off, 88.50. Confirmed/reloaded: one unpaid bill; expense total stayed 418.15. | Pass |
| CAP-05 | `QA ดื่มน้ำทุกวัน` classified as daily Habit. Edited suggested domain to Health and target to 7; confirmed. Life showed the habit, weekly denominator 11 (existing 4 + 7), and a separate daily history row; reload retained it. | Pass |
| CAP-06 | `เป้าหมาย QA อ่านหนังสือบันทึกด่วน` classified as Goal, Growth, October. Confirmed and revisited after reload; exactly one card was present. | Pass |
| CAP-07 | `นัด QA บันทึกด่วน พรุ่งนี้ 14:00` initially classified as Task. Manually selected Event; preview showed only date. Confirmed and reloaded event list: 11 October all-day. A second unsubmitted preview using recognized `นัดหมาย ... 14:00` also omitted time. | Fail: QA-07 |
| CAP-08 | Expense with no amount showed explanation and disabled confirmation. Filling -1 and 0 also kept confirmation disabled. Closed without saving. | Pass |
| REC-03 | 11 October occurrence began incomplete while 10 October was complete. Completed 11 October (1/2), reloaded, then unchecked it. Returned to 10 October and verified its occurrence remained checked. | Pass |
| MOB-01 | At 390×844, opened mobile drawer and navigated to Inbox; drawer closed. Opened Quick Capture from bottom navigation, expanded details, edited the note title, saved and reloaded. Exactly one `QA 1010 — โน้ตจากมือถือ` remained. | Pass |
| MOB-02 | At 360×800, opened User menu, switched to English, closed with Escape and opened Quick Capture. Expense without amount showed English error and disabled confirmation; screenshot showed usable dialog bounds. Closed without saving, restored Thai and reset viewport. | Pass for these controls only |
| NATIVE-01 | Retried native Chrome accessibility access after the user's unlock message. The OS again reported the Mac locked. | Unavailable; no native-drag pass claimed |
| GOAL-01 | Added weekly child `QA 1010 — เป้าย่อยอ่านบทแรก` under the captured monthly goal; parent and Growth domain were preselected. Added a linked task; completing it changed child 0/1→1/1 and 100%, and parent to 100%. Reload retained parent progress and child link. | Pass |
| GOAL-02 | Renamed parent to `QA 1010 — เป้าหมายแม่แก้ไข`, archived it, restored through Archive. Reopening retained name, 100%, child and completed task. | Pass |
| TASK-02 | Completed filter showed three one-off tasks; combined search `อ่านหนึ่งบท` returned one. Switching that search to active yielded an empty state. All filter displayed active and completed groups. | Pass for these combinations |
| TASK-03 | Overdue filter initially returned zero. Editing the QA 15-minute task to planned/deadline 9 October plus notes produced exactly one overdue row. Cleared deadline and restored planned 10 October; overdue returned zero. | Pass |
| TASK-04 | Planned 10 October / deadline 9 October was rejected with generic `วันที่ไม่ถูกต้อง`. Equal dates saved. | Validation observed; cross-flow policy/wording follow-up |
| REV-01 | Navigated to 27 September–3 October; filled three empty review fields, saved/reloaded, and read back all exact values. Original 4 October review was preserved in storage. | Pass for save/reload |
| REV-02 | That earlier week showed habit target 0/11 despite both QA habits starting 9–10 October. | Fail: QA-08 |
| REV-03 | Navigated from saved 27 September review to 4 October via Next Week. Heading/stats changed, but three form fields still contained September review values. Reload restored the previously saved October values. Did not save while stale. | Fail: QA-09 |
| REV-04 | Retested the recurring task offered by carryover, selected its preview and confirmed. Captured the explicit toast `งานที่ทำซ้ำยังเลื่อนเฉพาะครั้งนี้ไม่ได้ เพื่อไม่ให้กระทบวันอื่น`. Deselected it afterward; no review text was saved. | Guard rejection verified; not successful recurring carryover |
| REV-05 | Selected the one-off 15-minute task, reviewed its preview, confirmed carryover. It left the source week; Today 11 October detail showed planned 11 October and no deadline. Reload retained exactly one instance. | Pass |

### Settings, events and navigation continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| SET-02 | Changed QA profile name, saved/reloaded and read it back. Restored `บัญชีทดสอบ Kemtit`, then reloaded to verify. | Pass |
| SET-03 | Saved break 12:00–13:00 using native time-field keyboard input. Reload retained it; Rescue 10 October free time fell from 330 to 270 minutes. Cleared both time segments, saved and restored 09:00–17:00 with no break. | Pass |
| SET-04 | Saved work hours 09:00–08:00; reload retained them. Source supports overnight intervals, so this is not an invalid-range defect. Restored 09:00–17:00 and verified. | Pass for persistence; next-day explanation is a UX follow-up |
| SET-05 | Toggled all five notification preferences and verified after reload; restored original switches `[true,false,false,false,false]` and verified again. LINE remained unlinked; no delivery was invoked. | Pass for preferences only |
| EVENT-04 | Turned off blocking for the all-day QA event on 11 October. Rescue showed 480 free minutes; restored blocking. No Rescue proposal was applied. | Pass |
| EVENT-05 | Changed the same all-day event to 09:00–09:30, saved/reloaded and read it back; restored all-day. Edited its title then cancelled; original title remained. | Pass |
| EVENT-06 | Navigated to November empty state and back to October; both original events returned. Opened permanent-delete confirmation and cancelled; target remained. | Pass |
| EVENT-07 | After explicit action-time user approval, permanently deleted only `นัด QA บันทึกด่วน พรุ่งนี้ 14:00` on 11 October. Reload showed only the separate 10 October QA event. Rescue 11 October showed 480 free minutes and 60 unscheduled minutes. | Pass; `evidence/event-delete-reload.png` |
| NAV-01 | `/dashboard` resolved to `/today`; `/entries` resolved to `/work/sales`, with matching visible headings. | Pass for default redirects; query preservation unverified |
| NAV-02 | At 768×1024, clicked all eight More links and verified target headings/URLs: Inbox, Calendar, Goals, Reviews, Life, Finance, Sales and Settings. Returned to More after each. Viewport subsequently reset. | Pass for these navigation controls |
| NATIVE-02 | Following the unlock reply, initial native access still reported locked. Later access succeeded. A native file picker opened on the QA Inbox card and the project-owned `public/icons/icon-512.png` was selected, but the foreground Chrome window changed before authoritative upload completion. Card remained 0/5. No native drag was executed. | Incomplete; no upload/drag pass claimed |
| UPLOAD-01 | Connected Chrome filechooser was reached (`multiple=true`), but `setFiles` failed because the extension lacks file-URL access. No extension permission was changed. Native fallback is described above. | Tool limitation, not an application defect |

The native `time` inputs also require committed keyboard changes: `fill()` alone was reverted by React, and clearing only the hour left a partial invalid native value. Clearing hour and minute produced a valid empty value. These observations are automation constraints, not application regressions.

### Habits, goals, shell and recurrence continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| HAB-01 | Marked `QA ดื่มน้ำทุกวัน` complete on 10 October. Weekly total changed 1/11→2/11; reload retained 2/11 and History's 10 October cell announced completion. Unmarked it and reloaded: total returned 1/11; original walking completion on 9 October remained. | Pass for completion, reversal and persistence |
| HAB-02 | Whitespace-only title kept Add disabled. With a synthetic title, target 8 and duration 0 each failed native validation when Add was clicked. Reload showed only the original two habits; no validation fixture was saved. | Pass |
| HAB-03 | Compared completed and incomplete habit button DOM. Both retained the same action label with no `aria-pressed`, checked state, or state-specific name; only visual styling changed. History separately exposes the completed state. | Fail: QA-10 |
| SHELL-01 | Opened Notifications; unlinked-LINE menu item navigated to Settings. No connection or delivery was initiated. | Pass for this state |
| SHELL-02 | Collapsed desktop sidebar, verified expanded=false, reloaded and waited for hydration: collapse persisted. Expanded it again, restoring original appearance. | Pass |
| GOAL-03 | Clicked Work filter: only the work sales goal remained. Clicked Personal Life: five life-domain goals remained, excluding sales. | Pass |
| GOAL-04 | Standard goal form rejected empty title with required error, then rejected numeric target 0 with explicit positive-number error. Closed without saving. | Pass |
| REC-04 | Edited existing daily QA task to Weekly; saving with no days displayed `เลือกอย่างน้อย 1 วัน`. Selected Saturday, saved/reloaded/reopened: Weekly and Saturday pressed=true persisted, all other days false. | Pass |
| REC-05 | Weekly Saturday task was absent from Today 11 October, present under Completed on 10 October. Restored Daily, saved/reloaded: detail showed Daily; Today 11 October showed its unchecked occurrence again. Original completion was preserved during the recurrence edit. | Pass; `evidence/recurrence-restored-daily.png` |

Life currently exposes creation and daily completion controls, but no habit edit/archive control was present in its visible UI. Do not claim an edit flow was tested. Goal list has domain filters but no visible month-navigation control; period navigation belongs to Plan. These are inventory clarifications, not unexecuted passes.

### Calendar scheduling continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| CAL-01 | Used the timeline resize control for the Inbox QA task: start remained disabled at 11:00; changed end to 11:45 with committed keyboard input, confirmed and reloaded. Both timeline list and TaskCardBoard read back 11:00–11:45. | Pass for accessible resize flow, not mouse dragging |
| CAL-02 | Used the timeline move dialog to propose 09:00–09:15 on 10 October. Confirmation was rejected with explicit blocking-event overlap error; dialog stayed open. | Pass |
| CAL-03 | Changed that proposal to 10:00–10:15, overlapping the note task. Confirmation was rejected with unavailable-time error. Restored 11:00–11:30, confirmed and reloaded. | Pass |
| CAL-04 | Used the separate lower-list Edit Time control on the same task, with 09:00–09:15. Save succeeded and reload retained the overlap with the 09:00–09:30 blocking event. Returned the task to 11:00–11:30 through the timeline dialog and verified reload. | Fail: QA-11; `evidence/calendar-inline-overlap-reload.png` |
| CAL-05 | Cancelled the Inbox task's time block. It disappeared from the timeline, returned to Unscheduled, and free minutes rose 330→360. No Restore control was exposed in the visible calendar. Rebooked the same task for 11:00–11:30 and reloaded; exactly one active interval and the corresponding card time returned. | Pass for cancellation/rebooking; not proof of same-record restoration |

No visible lock/unlock control was present in either timeline scheduling dialog or lower-list edit form. Locked-row behavior still needs a controlled fixture; it was not tested by these actions. The native gesture matrix remains open. Cancellation has a recovery-discoverability concern: `TimeBlockActions` contains a Restore branch but cancelled rows disappear from this view; rebooking is possible, but is not equivalent to restoring the cancelled record.

### Authentication guards and missing-record continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| AUTH-01 | Opened `/login` on canonical localhost while signed in. Redirected to `/today` with Today headings. Opened `/` and observed the same destination. Original QA session remained intact. | Pass for authenticated guards |
| AUTH-02 | Opened `/register` and all four onboarding routes on localhost with completed QA profile. Each redirected to `/today`. | Pass for completed-profile guards; not the onboarding creation flow |
| AUTH-03 | Used the separate 127.0.0.1 host in a new connected Chrome tab. `/` redirected to `/login`. `/today`, `/finance`, `/settings` and all four onboarding routes redirected to Login with the exact encoded requested pathname in `next`. No protected page content was rendered in these checks. | Pass for these unauthenticated page guards; not an API/RLS audit |
| AUTH-04 | Alternate-host Login and Registration rendered, but tested client controls (language, show password, recovery, submission) did not reach authoritative changed states, including after a reload. Input observations did not establish committed validation. Canonical localhost correctly redirects the existing session, preventing a direct signed-out comparison. | Inconclusive; do not count wrong-password, validation or recovery as passed/failed application cases |
| UPD-02 | Opened `/updates/00000000-0000-4000-8000-000000000000`. Displayed localized not-found state; clicked its return link and reached Today. No published release was created. | Pass for missing-record recovery |

Remaining auth work requires a working fresh session on the canonical origin with known local QA credentials, followed by current login/OTP and onboarding interaction. The existing fixture's password was not reset, no credential or extension security permission was changed, no Google authorization was attempted, and no registration/recovery email was confirmed in this continuation. Alternate-host inertness is an unresolved test-environment/browser observation, not a confirmed production-auth defect. The not-found page also exposes nested main landmarks and uses the older dashboard return wording; record these for accessibility/copy review without conflating them with successful route recovery.

### Finance planning continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| FIN-08 | Set the existing finance QA goal to Investment and monthly target 500; saved and reloaded. The card retained Investment and `3,000.25 / 500`. Cleared the monthly target, selected Saving, saved/reloaded: progress remained 3,000.25 and the monthly denominator disappeared. | Pass for plan persistence and clearing; final category explicitly Saving |
| FIN-09 | Before FIN-08, entered monthly target 500.50 and clicked Save. Native input validation reported step mismatch (`min=1`, `step=1`); no saved change was observed. | Decimal restriction observed; product/UX follow-up, not a confirmed new defect |

Finance exposes record date inputs, but no visible month-navigation control was present on the current route. Clearing the monthly target did not restore the original unset finance category: the final category is explicitly Saving. Income 1000.75, expense 418.15, net 582.60 and goal progress 3000.25 stayed unchanged. This was local goal metadata, not a financial transaction.

### Plan navigation and date-picker continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| PLAN-01 | Switched Month to Year, advanced to 2027 empty state, returned to current 2026, opened October, then the 4–10 October week. Corresponding headings, URLs and retained QA goal progress matched each selection. | Pass |
| PLAN-02 | Selected Life scope in that week: work sales goal disappeared. Opened the QA parent goal, then its return link. URL returned to the exact week/date/scope (`view=week&date=2026-10-04&scope=life`). | Pass for direct goal return |
| PLAN-03 | Clicked Add Task on 5 October. Form prefilled intended date 5 October. Opened date picker, pressed ArrowRight from selected 5: focus moved to 6 October; Enter selected 6 and closed the picker. Closed the task form without saving. | Pass for contextual date and this keyboard path |
| PLAN-04 | Opened Weekly Calendar from Life-scoped 4–10 October Plan. Calendar retained `view=week&date=2026-10-04&scope=life`. Selected 10 October in Timeline; URL and selected-day content changed to 10 while retaining week/life. | Pass |

The Add Task form opened from Life scope still defaults to Work. This is a UX follow-up: users can create an item outside the current filter unless they change the domain. No new task was saved in PLAN-03, so no invisible-record result is claimed.

### Card groups and native interaction continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| GROUP-01 | Selected the Inbox and converted-note QA cards. Selection automatically exposed group controls; Create stayed disabled until a name was entered. Created `QA 1010 — กลุ่มตรวจการ์ด`. Reload retained exactly these two members and their 11:00–11:30 / 10:00–10:30 schedules. | Pass for button alternative and persistence |
| GROUP-02 | Undo appeared after creation but was absent after reload. The group remained intact. Source `TaskCardBoard` keeps `lastOperationId` only in component state; persistent pending-operation recovery is separate. | Observed recovery limitation; explicit post-success reload Undo contract follow-up |
| GROUP-03 | Renamed group to `QA 1010 — กลุ่มเปลี่ยนชื่อ`, verified it, then immediately clicked Undo. Original title returned and survived reload, with both members/times unchanged. | Pass for rename and immediate Undo |
| GROUP-04 | Dissolved the group: both cards moved to Ungrouped, group disappeared, Undo was enabled. Immediate Undo restored group and both members. Reload retained the restored group. | Pass; `evidence/card-group-restored-reload.png` |
| GROUP-05 | Selected the ungrouped 15-minute QA task, chose the existing group and added it. Reload retained three members, including its original 11 October planned date and notes. Selected only that task and removed it; reload retained the original two-member group and the removed task under Ungrouped. | Pass for add/remove and persistence |
| PHOTO-01 | Expanded image management on the existing two-photo reading card. Moved the first photo later; both cover representations changed to the other image, and reload retained the new loaded cover. Repeated the swap to restore the original cover, then verified it loaded after another reload. Compared DOM image path identities without storing signed URLs in evidence. No image was added or deleted. | Pass for ordering, first-image cover and restoration |
| MOB-03 | At 360×800, closed/reopened the QA group, opened Inbox task detail and verified planned date/no deadline/11:00–11:30. Detail bounds and scroll width were exactly 360px. Changed priority Normal→High, saved/reloaded, then restored Normal and verified another reload; schedule remained unchanged. | Pass for these mobile controls; `evidence/mobile-card-detail.png` |
| MOB-04 | At 360px, searched `งานจากกล่องเข้า`: one matching card appeared within its group. Cleared search: both original members returned. Stable document width was 360px. Filtered header said `1 งาน` although the group has two total members; scope wording needs UX review. | Search/filter pass; `evidence/mobile-card-group-filter.png` |
| TAB-01 | At 768×1024, document width was 768px. Enter on group toggle hid both articles and exposed expanded=false; Enter again restored two articles. Captured evidence and reset viewport. | Pass for viewport/keyboard controls, not physical touch; `evidence/tablet-card-group.png` |
| NATIVE-03 | User brought the QA tab forward. Native screenshot/AX then identified Kemtit correctly, but coordinate scrolling, AX-target scrolling and a fresh Chrome app binding all failed with tool `noWindowsAvailable`. No pointer gesture reached the app. | Tool limitation; no drag/resize/dwell result |
| UPLOAD-02 | Opened the native file picker on the empty Inbox QA card. Selected project `public/icons/icon-512.png` by AX and direct path; Open stayed disabled. Cancelled the picker and read back card 0/5. No browser/iCloud permission was changed. | Inconclusive upload; no successful new photo claimed |

The user's request to bring Chrome forward is fulfilled, not pending. Native pointer dispatch still fails despite usable screenshots/AX. Do not ask the user to unlock again as if that were the same problem. The picker also showed an iCloud permission-repair banner; this is context, not a proven cause of disabled Open. No repair was attempted. The earlier extension file-URL restriction remains unchanged.

Retained new QA fixture: `QA 1010 — กลุ่มตรวจการ์ด` contains only Inbox QA and converted-note QA tasks, both with their original schedules. This is a deliberately retained test group; it is not a restoration of the pre-test ungrouped state. No task or image was deleted. Evidence: `card-group-reload.png`, `card-group-restored-reload.png`.

The initial width read immediately after changing to 360px was transiently 393px. Subsequent stable expanded/collapsed and filtered measurements were 360px with no main element overflowing; this is not recorded as a responsive defect. PHOTO-01 restored original image order; GROUP-05 restored pre-test membership; MOB-03 restored Normal priority. Physical touch and native drag remain separate gaps.

Filtered-group wording follow-up: `renderGroup` counts the filtered `tasks` list, whereas group-wide Dissolve uses the complete member snapshot. Consider explicit “showing 1 of 2” and clear group-action scope. No filtered Dissolve was executed in this continuation; its full-member reach is source evidence, not a new browser reproduction. GitNexus context resolved `renderGroup`, but retained line numbers were older than the current source; current file contents were inspected directly afterward.

### Automation observation, not an application bug

`fill()` on the `datetime-local` input changed the DOM value without committing the React-controlled value; a later text edit reset it. The initial invalid-time attempt therefore saved the original valid time and cannot establish validation behavior. The subsequent keyboard-driven case above did commit the value and verified the error. Do not count the initial fill as either a passed validation test or an application defect.

## Additional canonical-session and print checks

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| AUTH-05 | Opened an isolated Chrome Incognito window at canonical `localhost:3000/login`. Empty submission displayed invalid-email and required-password messages. `qa-invalid` remained rejected; syntactically valid `qa-validation@example.invalid` removed the email error and focused the still-required password. No password entered or authentication request success claimed. | Pass for observed validation |
| AUTH-06 | Show password changed the empty secure field to a normal text field and renamed the control to Hide password; toggled back. Opened recovery and observed its email-code explanation and Back control, then returned. No recovery email requested and no credential changed. | Pass for controls/navigation only |
| AUTH-07 | Switched isolated Login to English: headings, field labels, error message and recovery/registration controls changed to English. Followed Create an account. Empty submission displayed display-name required, invalid email and minimum-eight-character password messages. Did not enter a new credential, create an account, accept terms or start Google OAuth. | Pass for these locale/registration-validation branches |
| NATIVE-04 | Native AX click/typing worked in the isolated Login window. Clicking that agent-created window's Close control timed out; later AX read/rebind also timed out. Closure is therefore unverified. Main normal Chrome QA tab remained authenticated and interactive via DOM. | Native cleanup/dispatch limitation; not an application bug |
| PRINT-01 | Current daily report for 10 October includes four unfinished tasks, three completed tasks (including the daily occurrence), the 09:00–09:30 event and four restored time blocks through 11:30. Matched Today; return link retained exact date/scope. Document width equalled viewport width (1800). | Pass for screen report/current fixtures; no new PDF export |
| PRINT-02 | Current weekly report spans 4–10 October, lists all seven days, previous Friday blocks and Saturday's completed recurrence/event/four blocks, excluding the next-day unscheduled fixtures. Return link retains 10 October/all. Document width equalled viewport width (1800). | Pass for screen report/current fixtures; print pagination still uses earlier evidence |

Evidence: `evidence/auth-recovery-form.png`, `evidence/auth-register-required.png`, `evidence/daily-print-current-fixtures.png`, `evidence/weekly-print-current-fixtures.png`. Canonical validation now has direct evidence; AUTH-04's alternate-host observation remains historical and inconclusive. The isolated language change did not alter the existing Thai QA session. No extension permissions were changed; the file-URL-access question is still pending. Native pointer gestures remain unverified.

## Today planning and Settings validation continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| TODAY-01 | Moved Exercise below Reading through the accessible Down button. Reload retained Reading → Exercise → Inbox. Moved Exercise back up and reloaded: original order returned. | Pass for reorder/persistence; native drag not tested |
| TODAY-02 | Expanded the priority selector: three selected items and the fourth disabled. Unselected Inbox and selected Note; reload retained Exercise → Reading → Note. Reversed the replacement and reloaded: original three/order returned. | Pass for maximum-three UI guard and replacement/persistence |
| TODAY-03 | In daily-plan settings, -1 minute failed native range validation. Saved 420 minutes plus `QA 1010 — ตรวจการบันทึกแผนรายวัน` for 10 October; reload retained both. After the isolation test below, restored 450 minutes/empty note and verified another reload. | Pass for validation, same-day persistence and visible-value restoration |
| TODAY-04 | With the saved 10 October note visible, clicked Next Day. Heading/date became 11 October and budget became 480, but the note still showed the 10 October text. Reload on 11 October showed the actual empty note. Clicked Previous Day: heading became 10 October but fields retained 480/empty; reload restored its actual 420/QA note. No Save was clicked in either stale state. | Fail: QA-12 |
| TODAY-05 | Expanded Today scheduling, chose Unlinked and entered whitespace-only title. Submit was disabled and the existing five timeline entries remained unchanged. Reload discarded the unsaved form. | Pass for blank-title guard only |
| SET-06 | Entered whitespace-only display name and clicked Save Name: localized required error appeared. Deselected the only focus topic: context Save became disabled. Reload retained original QA name and Work focus. | Pass for these validation branches |

Evidence: `today-stale-date-note.png`, `today-correct-date-note-reload.png`, `today-plan-restored.png`. Priority membership/order were restored, but the formerly suggested priorities are now explicitly saved priorities; this is not restoration of the initial unsaved-suggestion state. The plan now has an explicitly saved 450-minute budget and empty note. No record for 11 October was saved by these checks. Existing task statuses, schedule intervals and profile settings were preserved.

## Inbox, goal-period and mobile date-picker continuation

| Case | Action and authoritative visible result | Result |
| --- | --- | --- |
| TODAY-06 | Opened Today scheduling on 10 October: Exercise, 11:30–12:00. Navigated to 11 October with Next Day while form remained open. Inputs changed to the recurring QA task's 11 October occurrence, 09:00–09:15. No schedule was submitted. | Pass for this sibling form's date reset; not affected by reproduced QA-12 path |
| INBOX-02 | Whitespace-only new task kept Save disabled. Expanded additional options, entered `QA 1010 — กล่องเข้าสำคัญสูง`, selected Health and High, saved/reloaded: exactly one unplanned row retained Health/High. | Pass |
| INBOX-03 | In that row's date picker, selected 12 October. This immediately moved the task to the plan and emptied Inbox; no second confirmation button was required. Tasks search after reload returned exactly one Health/High task, intended date 12 October, no deadline. Detail matched the list. | Pass for future-date planning/persistence |
| GOAL-05 | Opened Add Child from the existing monthly QA parent, then changed Weekly→Year. Form normalized start to 1 January and hid the parent selector. Saved `QA 1010 — เป้ารายปีจากการเปลี่ยนช่วงเวลา`; Goals listed it under Year, and detail/reload showed 2026 through 31 December, 0%, no children. Original monthly parent's sole child and 100% remained. | Pass for period conversion/year creation |
| GOAL-06 | From the new annual goal, Add Child defaulted to Monthly/1 October/Growth and selected that annual parent. Navigated calendar across year boundary and chose 1 January 2027: parent became None and the form explained no upper goal overlaps this period. Closed without saving. | Pass for UI candidate filtering/date normalization; server rejection was not exercised |
| GOAL-07 | Archived the newly created annual QA goal. Reload retained Archived state; goal has no children/tasks. No permanent deletion occurred. | Pass for annual-goal archive persistence |
| FIN-10 | At 390×844, opened transaction date picker: bounds 37–287px, document width 390px. ArrowLeft from selected 10 October focused 9 October; Enter selected it and closed the picker. Opened Bill Due Date independently at 10 October; Escape closed it without altering that date. No record saved. Reload retained income 1000.75, expenses 418.15, net 582.60, remaining 82.10. Reset viewport. | Pass for these mobile date/keyboard/cancel paths; not physical touch |

Retained fixtures: Health/High task `QA 1010 — กล่องเข้าสำคัญสูง`, planned 12 October, no deadline or time block; archived annual goal `6bca31bd-55ac-49bf-9fa9-3351701794f6`. The out-of-year child was not created. Screenshots: `inbox-high-priority-planned-reload.png`, `goal-year-period-reload.png`, `goal-year-archived-reload.png`, `mobile-finance-date-picker.png`. Confirmed findings remain QA-01–QA-12; no additional bug is asserted by this batch.

## English mobile, wizard and calendar continuation

All cases below used connected Chrome at 360×800. This is viewport evidence, not physical touch-device certification.

| Case | Actual interaction and observation | Result |
| --- | --- | --- |
| MOB-05 | Switched to English; Finance rendered English controls and retained income 1000.75, expense 418.15 and net 582.60. Document width was 360px. | Pass for this populated mobile view |
| INS-06 | English Overview and Time rendered at 360px; report tab strip scrolled inside its own 334px container (612px content), with no document overflow. Time showed six blocks, 3h total and 30m average. Neither of these views exposed a time-range picker. | Pass for tested layout/metrics; no nonexistent range control claimed tested |
| GOAL-08 | Opened Life's optional Study example. In the three-step wizard selected Quarter, advanced to preview, went Back twice, edited goal and first-step titles, and advanced again. Quarter and edited task text survived. Confirmed one goal plus one task, then reloaded detail: 1 October–31 December and one linked task planned 17 October persisted. | Pass for wizard Back persistence, explicit confirmation and quarter creation |
| GOAL-09 | Opened Edit on the new quarterly goal. Period selector offered only Year/Month/Week, with none selected; date hint still identified the quarter. Saved unchanged and reloaded: quarter and linked task survived. | Fail: QA-13; not data loss |
| REV-06 | English mobile review displayed the existing 4 October text. Selected one carryover checkbox: button enabled; deselected: disabled. No carryover or review save performed. | Pass for these mobile controls |
| CAL-06 | Opened Schedule on the new quarter task, unchecked date-only and inspected start/end controls at 360px. Cancelled: task retained planned 17 October with no time block. Dialog fit viewport. | Pass for mobile scheduling cancellation |
| CAL-07 | Switched Calendar to Month and selected 12 October; Day heading and URL matched that date and document stayed 360px wide. Added `QA 1010 — Calendar note for 12 October`, saved/reloaded. Previous Day had no note; Next Day restored the single note. | Pass for selected-date note persistence/isolation |

Evidence: `mobile-en-finance.png`, `mobile-en-insights-time.png`, `quarter-goal-edit-missing-period.png`, `quarter-goal-preserved-reload.png`, `mobile-en-review.png`, `mobile-en-schedule-dialog.png`, `mobile-en-calendar-month.png`, `mobile-en-calendar-note-date.png` in `evidence/`.

Retained fixtures: active quarterly goal `a27b2473-5388-4f7b-8758-121f638617fb` (`QA 1010 — Quarterly study goal`), its unfinished Growth task `QA 1010 — First study step for quarter` planned 17 October without a block, and the 12 October calendar note. Thai was restored and viewport override reset. No app source or tests changed.

### Compatibility routes and reference-page smoke

| Case | Actual interaction and observation | Result |
| --- | --- | --- |
| NAV-03 | Opened `/dashboard?date=2026-10-12&scope=life`; settled URL was `/today?date=2026-10-12&scope=life` and Today displayed 12 October with the Health QA task. | Pass for date/scope preservation |
| NAV-04 | Opened `/entries?date=2026-10-12&scope=life`; settled URL was `/work/sales`, displaying the existing 2000.50 total and both entries. Source confirms unconditional redirect; architecture documents the alias but does not establish a query-preservation contract. | Redirect verified; parameter dropping observed, not classified as a defect |
| REF-01 | Opened `/prototype`; it rendered the isolated visual demo with five design directions, “Demo data only” and “no production data” disclosures. No demo edit was performed. Returned to production `/tasks`. | Reference smoke only; not app-functional QA |

## Project validation and tablet/mobile continuation

| Case | Actual interaction and observation | Result |
| --- | --- | --- |
| PROJ-03 | Temporarily changed QA role Seller→Freelancer. At 768×1024, whitespace-only project name disabled Create; whitespace-only existing name disabled Save. Restored the unsaved name before continuing. Project list document width equalled 768px. | Pass for blank-name guards/tablet list |
| PROJ-04 | Add Task from project detail preselected the correct project and Work domain. Empty task submission showed required-title error. With a title, 0 and 1441 minutes were rejected and the form stayed open, but displayed a generic retry message instead of bounds. Cancelled without creating that invalid fixture. | Validation rejects invalid values; fail QA-14 for error guidance |
| PROJ-05 | Created `QA 1010 — ตรวจระยะเวลา 30 นาที` from project Add Task. Save/reload retained one task, planned 10 October, project link and 30 minutes; project changed from 1/1 and 45 minutes to 1/2 and 75 minutes. | Pass for standard duration/project persistence |
| PROJ-06 | Cleared project's optional goal and target date, saved/reloaded: No linked goal and no Target Date summary, while both tasks/progress/workload remained. Restored the original sales goal and 31 October, saved/reloaded: both returned. | Pass for nullable-field persistence/restoration |
| PROJ-07 | At English 360×800, project page width was 360px. Opened the new task's Edit form: correct project, planned date and 30-minute duration; dialog bounds 0–360px with scrollWidth 360. Invalid edit to 0 showed the English generic retry message. Cancel/reload retained 75-minute project total. | Layout/cancel pass; QA-14 reproduced in English |
| PROJ-08 | Activated Archive Task with Enter on the new 30-minute task. Observed Archived toast and Undo; reload showed project back to 1/1, 100%, 45 minutes. Archive listed that exact task with Restore. Original completed 45-minute task remained. | Pass for keyboard archive/persistence |

Archive observation boundary: earlier semantic-click attempts closed the detail dialog but did not produce a verified archive; the task still appeared after reload and was absent from Archive. Keyboard activation then succeeded with an explicit toast and persisted recovery record. The discrepancy remains an interaction investigation; do not label the earlier clicks successful or infer a database defect. Main task-library detail exposed Edit/Close but no Archive control; card view likewise did not supply an alternative archive control in the inspected state.

Duration observation boundary: DOM native validity reports stepMismatch for 30 because the input uses min=1/step=5. The form has noValidate and its application schema accepted/saved 30. This is not evidence that 30-minute tasks are blocked. Align native input stepping with the supported integer-minute contract as a follow-up.

Evidence: `tablet-task-duration-error.png`, `tablet-project-restored-fields.png`, `mobile-en-task-duration-error.png`, `mobile-en-project-after-task-archive.png`. The first project screenshot precedes task archiving and shows 1/2; the later mobile screenshot shows restored 1/1. Retained extra fixture is the archived 30-minute task, recoverable through Archive. Project goal/date/name/description are restored. Original Seller role, Work focus and Thai language were restored and verified after reload; viewport reset. No source code, tests, credentials or provider settings changed.

## Rescue capacity, repeated confirmation and concurrent-calendar continuation

| Case | Actual interaction and observation | Result |
| --- | --- | --- |
| RES-04 | Opened Rescue for 11 October with original 09:00–17:00 hours: 480 free / 60 unscheduled minutes. Preview explicitly left the recurring 15-minute occurrence unplaced because it lacks an occurrence-linked block; proposed only the two one-off tasks. | Pass for visible recurring restriction/explanation; no proposal applied |
| RES-05 | Temporarily saved 09:00–09:15 work hours and verified reload. Rescue showed 15 free / 60 unscheduled / 45 unplaced; proposed only the one-off 15-minute task at 09:00–09:15. The 30-minute task remained unplaced with continuous-slot explanation. Followed Open Calendar without confirmation: scheduled time remained zero and all three tasks remained unscheduled. | Pass for partial-fit preview and leaving without applying |
| RES-06 | Temporarily saved 09:00–09:05. Rescue showed 5 free / 60 unscheduled / 60 unplaced. No placements were proposed and the no-moves button was disabled. Restored 09:00–17:00 and verified end time 17:00 after reload; 10 October Calendar again showed 330 free, 30 event and 120 scheduled minutes. | Pass for no-fit guard and settings restoration |
| CAP-09 | Entered `โน้ต QA 1010 — ยืนยันซ้ำสองครั้ง` in Quick Capture; preview identified Note. Double-clicked Confirm. After dialog closed and Calendar reloaded, Notes increased 2→3 and exactly one matching note appeared. | Pass for this UI double-submit path; not a direct server-replay/idempotency test |
| CAL-08 | Opened the same Inbox task's 10 October 11:00–11:30 move dialog in two Chrome tabs before saving either. First tab saved 11:30–12:00 and reload verified it. Stale second tab proposed 12:00–12:30, still showing the old selected block interval; confirmation was rejected with `ช่วงเวลานี้ไม่ว่างแล้ว เลือกเวลาอื่น` and dialog remained open. Reload of first tab still showed 11:30–12:00. Cancelled/closed secondary tab, then restored 11:00–11:30 through a fresh dialog and verified reload. | Pass for preventing this stale-tab overwrite; generic conflict guidance is a UX follow-up |

Evidence: `rescue-partial-capacity-preview.png`, `rescue-no-fitting-task.png`, `capture-double-submit-one-note.png`, `calendar-stale-tab-rejected.png`. No Rescue proposal was applied in this batch. Work hours, existing four schedule intervals, locale and role are restored; the schedule record's version has advanced through the two legitimate moves, so this is visible-value restoration rather than database-version rollback. One additional synthetic note remains on 10 October. The secondary Chrome tab was closed; the main QA session remains available.

Lock-fixture boundary: current Calendar exposed move/resize/edit/cancel controls but no lock toggle. Graph search plus the current TimeBlockForm/TimeBlockActions and TimelineBoard inspection found locked-state handling but no lock-creation control in those inspected forms. A locked-block browser case still requires a controlled fixture; absence of a UI toggle is not a passing locked-state test.

## Midnight boundary, Plan context and route-layout matrix

| Case | Actual interaction and observation | Result |
| --- | --- | --- |
| CAL-09 | On the quarterly goal's unscheduled 30-minute task, unchecked date-only and entered 23:45–00:15. Preview explicitly showed 10→11 October and explained that this view supports only within-day blocks. Confirmation was disabled. Cancel/reload retained the task's original planned 17 October with no block. | Pass for UI cross-midnight guard and no silent shortening/date change |
| PLAN-05 | At 768px, Month overview's empty Family-area Add Goal opened a form with Family checked, Month checked and 1 October. Closed without saving. Switched to Week: the route used the entry point's 1 October anchor (27 September–3 October). At 360px the empty-day cards stacked and document width remained 360px. | Pass for domain/month prefill, cancellation and tested weekly layout |
| NATIVE-05 | Fresh native Chrome acquisition reported the Mac locked and automatic unlock unavailable. Requested manual unlock/front Chrome through the asynchronous question. DOM-based connected-Chrome work remained available. | Native gestures/print UI still unavailable; no pass inferred |
| LAYOUT-01 | Sequentially opened 16 primary routes in TH and EN at 360×800, 390×844, 768×1024 and 1440×900. Each rendered an H1 and nonempty main content; document scrollWidth equalled viewport width in all 128 observations. Recorded one viewport screenshot per observation. | Pass for measured route rendering/document width only |

LAYOUT-01 routes: `/today`, `/inbox`, `/tasks`, `/plan`, `/calendar`, `/goals`, `/finance`, `/life`, `/work/sales`, `/reviews`, `/insights`, `/rescue`, `/archive`, `/updates`, `/more`, `/settings`. Existing Seller profile and default route/view state were used. The empty Updates state is still empty-state evidence; dynamic details, auth/onboarding, Projects under other roles, print pagination and conditional dialogs are not covered by this matrix.

Authoritative matrix: `evidence/layout-matrix.json`, with route, locale, viewport, measured document width, rendered H1 and main-text length. Screenshot naming: `evidence/layout-{th|en}-{360|390|768|1440}-{route}.png` (slashes replaced by hyphens). These 128 screenshots were captured, not all manually visually reviewed. Visual inspection in this batch covered English Today at 360px, Thai Finance at 768px, English Calendar at 1440px and the Thai empty-week Plan at 360px; observed controls/cards fit their respective layout. No claim is made that every control in every screenshot was activated or that viewport emulation certifies touch hardware.

Other evidence: `calendar-midnight-guard.png`, `mobile-plan-empty-week.png`. No schedule or goal was created by these boundary/context tests. Language restored to Thai and viewport reset after the matrix. The native-unlock question remains pending; main QA tab retained.

## Confirmed findings and repair plan

### QA-01 — P2: weekly productivity silently omits recurring work

- Reproduction: note Productivity 1/3; create the daily QA task for 10 October; complete its occurrence in Today; reload; return to Productivity. It remains 1/3 although Today confirms completion.
- Cause confirmed after graph lookup: `getWeekTaskStats` in `src/core/tasks/queries.ts` filters `recurrence_rule IS NULL` and counts only task-level completion. Its source comment calls this a POC limitation, but the user-facing metric has no such qualification.
- Plan: define the weekly work-item cohort consistently with planner date/occurrence contracts; include non-recurring tasks and actual recurring occurrences once each. Preserve original occurrence identity after rescheduling, completed state per occurrence, owner/origin/archive/deletion filters and planned-date versus deadline distinction. Reuse that contract in Insights and Reviews instead of adding a separate dashboard-only total.
- Verification: mixed one-off/daily/weekly fixtures; moved occurrence, cancellation, completion/uncompletion, week boundary, archived and wrong-owner data; exact browser before/after/reload comparisons. Also audit streak and life-balance counting, which were not established by this reproduction.

### QA-02 — P2: report describes planned work as deadline work

- Reproduction: Productivity says `จาก 3 งานที่ครบกำหนดในสัปดาห์นี้`; Tasks shows no deadline for the corresponding planned tasks.
- Source: `insights.productivity.ofTasks` in both locale catalogs; weekly query uses legacy `due_date`. This conflicts with the visible separation of planned date and deadline.
- Plan: settle the cohort in QA-01 first, then label it accurately in both languages. Use explicit deadline fields only for deadline metrics. Do not fix the label by changing real task deadlines.
- Verification: a planned task without deadline, a deadline outside the planned week, date-only tasks, and a moved recurring occurrence should yield correct counts and wording in TH/EN.

### QA-03 — P2: Thai time report uses hard-coded English units

- Reproduction: open Thai Insights Overview/Time with two 30-minute blocks. Values read `1h` and `30m`.
- Source: `formatDuration` at the bottom of `src/app/(app)/insights/page.tsx` unconditionally returns `h`/`m`; graph identified its page callers.
- Plan: use existing localized duration formatting where appropriate, or locale-catalog values for minutes/hours. Keep number formatting and accessible text consistent.
- Verification: 0, 30, 60 and 90 minutes in TH/EN, including narrow screens; do not assert only catalog completeness.
- Additional reproduction: Thai Reviews displays `3h` for 4 October week and `0m` for 27 September week. Its local `formatMinutes` has the same hard-coded suffix pattern. Include Reviews in the same localized-formatting repair.

### QA-04 — P2: sales entry amount has no accessible name

- Reproduction: open Sales Add Entry or Edit. The amount spinbutton has no accessible name, although `จำนวน` appears visually.
- Source: `EntryForm.tsx` places a wrapper `div` immediately inside `FormControl`, so the generated form-control id/ARIA props target the wrapper instead of its nested Input. Runtime DOM confirms the input has no id or associated labels.
- Plan: put FormControl directly around the Input, leaving the unit decoration in an outer positioned wrapper; preserve amount parsing, refs, presets and error association. Check similar monetary controls for the same composition mistake without refactoring unrelated forms.
- Verification: `getByRole('spinbutton', {name: localizedAmount})` must uniquely locate Add and Edit controls in TH/EN; keyboard entry, presets, validation messages, save and reload must still pass.

### QA-05 — P3: Feedback thank-you description appears twice

- Reproduction: select one topic, submit, inspect success dialog. `บันทึกความคิดเห็นของคุณแล้ว` appears on two visible lines.
- Source: `FeedbackHost.tsx` passes `feedback.successDescription` as dialog description and repeats it in the success body. Both runtime paragraphs had nonzero visible bounds.
- Plan: retain one visible confirmation and the accessible dialog description, preserving the strict one-topic submission flow and existing idempotency behavior.
- Verification: TH/EN desktop/mobile success dialog contains one visible description, correct accessible description, and usable close controls.

### QA-06 — P2: Rescue loses its Undo control after reload

- Reproduction: confirm a proposal, observe Undo, reload. Applied placements persist, but no Undo control remains.
- Source: `RescueReview.tsx` keeps a random operation ID and `applied` flag only in component state. Reload creates a new ID and resets the flag; no eligible operation is read back.
- Plan: expose the latest eligible user-bound operation and its server-confirmed Undo eligibility after reload/navigation. Preserve conflict detection and original snapshots; do not recover an unverified operation solely from client storage.
- Verification: apply→reload/navigation→Undo restores original placements; changed-after-apply conflicts remain safe; replay and another user's operation are rejected. Verify immediate Undo separately from reload recovery.
- Fixture note: the four 10 October QA placements remain applied. Undo was **not** executed for this operation. Earlier 9 October blocks were not rechecked here, so this case does not claim they were moved or removed.

### QA-07 — P2: Quick Capture silently turns timed event text into an all-day event

- Reproduction: enter `นัด QA บันทึกด่วน พรุ่งนี้ 14:00`, select Event, confirm. Reload Events: title still contains 14:00, but scheduling says all-day on 11 October. Recognized `นัดหมาย QA ตรวจเวลา พรุ่งนี้ 14:00` also produces a preview with only the date and no all-day disclosure.
- Source: graph context identified QuickCapture and its confirmation path; `CaptureProposal`/`ConfirmCapturePayload` contain only the event date, no time fields. The preview neither displays an all-day mode nor offers time editing.
- Plan: make all-day versus timed scheduling explicit in the preview. Parse supported time formats and allow start/end editing; if time cannot be understood, require clarification before creating an all-day event. Preserve one canonical event and request idempotency. Keep dates/time zones consistent with EventManager.
- Verification: TH/EN 14:00, time ranges, missing end, date-only input, midnight/day boundary, invalid range, manual type override, save/reload and correct calendar placement. No second event was saved for the recognized-keyword preview.
- Cross-page impact: 11 October Today treated this all-day event as using all 480 working minutes. Incorrect all-day conversion therefore affects availability, not just display.

### QA-08 — P2: historical habit targets include habits not started yet

- Reproduction: open Reviews for 27 September–3 October. It reports `0/11` habit completions against target, although the 30-day history marks those dates as before the two QA habits began (9 and 10 October).
- Source: `getHabitWeekStats` in `src/core/habits/queries.ts` selects all currently active habits and sums `target_per_week` without considering creation/start dates relative to the requested range. Only completions are date-filtered.
- Plan: define an effective-date cohort for historical weekly targets, excluding habits that had not started by the period. Align History, Reviews and Insights. Decide explicitly how partial start weeks and later archive/target changes are represented; do not silently rewrite historical targets from today's configuration.
- Verification: no habits in period; starts before/during/after the week; daily versus weekly cadence; later archive/target edits; Bangkok date boundary. This browser reproduction proves the before-start defect, not every historical-edit case.

### QA-09 — P1: changing review week retains the previous week's editable text

- Reproduction: save distinct text in week 27 September; use Next Week to open 4 October. Heading and metrics identify 4 October, but all three editable fields still display the September text. Reload shows the actual previously saved October text.
- Risk: pressing Save in the stale form can replace the selected week's record with another week's content. The overwrite was not performed; the stale UI and submit path establish the risk.
- Source: `WeeklyReviewForm` initializes three `useState` fields from `initial` once, while `ReviewsPage` reuses it without a `weekStart` key. Submission uses the new `weekStart` with retained local field state. Selected carryover IDs also live in component state and need reset when the week changes.
- Plan: bind form state to the selected week (for example keyed mounting), and define handling for unsaved edits on navigation. Keep refreshes after save from unexpectedly discarding same-week edits. Reset selected carryover items and show the record belonging to the heading before allowing save.
- Verification: two weeks with different saved text, a blank week, next/back navigation, browser Back/Forward, unsaved edits, save/reload isolation, and selected carryover items across navigation. Test via client navigation, not only full reloads.

### UX observations requiring follow-up

- Empty Sales “set this month's goal” opens the generic form with outcome measurement selected and no currency. The finance equivalent preselects a numeric money goal. Evaluate a metric/THB default for the Sales entry point; do not silently change the generic goal form default.
- Sales empty ledger asks the user to start from a field “on the right”, but the rendered entry point is a link opening a dialog. Update only after checking responsive variants.
- Calendar week overview lists both a task and its linked time block. This was observed, but the duplicate presentation needs visual/purpose review before classifying it as a data-duplication defect.
- Capture classifier misses common `จ่ายค่า ...` and `นัด ...` phrases; explicit kind correction works. Explicit task duration `15 นาที` is retained in the title but preview uses historical duration instead. Add representative language cases and either parse supported values or disclose the limitations. These observations are separate from the confirmed event-time loss above.
- Goal parent progress correctly rolls up to 100%, but the same panel displays `0/0 งาน` because it counts only directly attached tasks. Clarify direct work versus child progress so the successful roll-up is understandable.
- Task form rejects a planned date after its deadline with generic “invalid date”. Compare this policy with Calendar/Rescue/carryover conflict handling before deciding whether to alter validation; improve the explanation regardless.
- Review carryover offers a daily recurring task already completed for the source date without an occurrence selector. Its current query reads master tasks rather than occurrence state. REV-04 now confirms the explicit recurring-occurrence guard rejection. Explain eligibility before the confirmation step, or expose occurrence selection; do not treat the rejected master-task move as a completed carryover.

### QA-10 — P2: habit completion button does not expose its current state

- Reproduction: in Life, complete the water habit and reload. History reports completion and the weekly total rises, but the toggle remains named `ทำเครื่องหมาย QA ดื่มน้ำทุกวัน`, without `aria-pressed` or a checked state. Its check SVG is hidden from accessibility. Uncompleting restores the total but leaves the same accessible button semantics.
- Source after graph query: `src/components/habits/HabitList.tsx`, `HabitList`, selects visual variant and strikethrough from `habit.done` but supplies no semantic state to the button. The completion toast is transient and does not explain persisted state after reload.
- Plan: expose a persistent toggle state (for example `aria-pressed={habit.done}` with a stable localized name), retain keyboard activation and failure feedback, and verify both states in Thai/English. Avoid changing the completion storage contract to solve a presentation defect.
- Verification: browser and component tests for initial incomplete, completed after save/reload, reversal, keyboard activation and server failure preserving prior state; confirm History and weekly total remain consistent. Actual screen-reader speech was not tested; this finding is based on rendered accessibility/DOM semantics.

### QA-11 — P2: lower-list time editor bypasses calendar-event overlap checks

- Browser reproduction: a local blocking event reserves 10 October 09:00–09:30. Moving the Inbox QA task to 09:00–09:15 through TimelineBoard is rejected. Editing the same interval through lower-list `แก้เวลา` saves it successfully; reload retains the overlap. The test interval was subsequently returned to 11:00–11:30.
- Source after graph query/context: `TimeBlockActions.save` calls `updateTimeBlock`, which invokes `update_time_block_atomic`. The current migration definition in `20260927142000_active_counted_time_block_conflicts.sql` checks overlap with active time blocks but does not check `calendar_events`. The newer card-scheduling RPC in `20261009173000_task_card_schedule_atomic.sql` checks blocking calendar events. This explains the two visible outcomes; no claim of live database-function introspection is made.
- Plan: apply one scheduling-conflict policy at the persistent transaction boundary across legacy edit/create/restore and card scheduling. Preserve owner checks, expected version, locked rows, data-origin filters, occurrence identity and date synchronization. Keep adjacency allowed; exclude nonblocking/cancelled events correctly. Evaluate Rescue and linked-task moves for the same missing boundary; those are audit targets, not additional browser-confirmed failures.
- Verification: repeat the exact same interval through each UI entry point; event versus time-block overlap, adjacent intervals, nonblocking/cancelled events, cross-day events, stale version and wrong-owner cases. A rejected request must leave time, title, task planned date and version unchanged. Show localized error without closing the form.

### QA-12 — P1: Today daily-plan form retains another date's values

- Reproduction: save 420 minutes and a distinct note on 10 October, reload, then navigate with Next Day. The page says 11 October but keeps the 10 October note. Reload shows 11 October's empty note. Navigate Previous Day: the 10 October form shows 480/empty until reload restores 420/the saved note.
- Risk: Save combines the newly selected date with stale local fields, potentially replacing that day's budget/note. No cross-day overwrite was executed; both navigation directions and reload comparisons were observed directly.
- Source: graph query/context resolved `DailyPlanForm` and its caller `TodayPage`. Current source initializes `notes`, `availableMinutes`, and `budgetEdited` once; the budget-only synchronization condition handles changed defaults for an untouched unsaved plan, but does not reset all fields when `planDate` changes. `TodayPage` renders the form without a date key. `submit` passes the new `planDate` with retained state to `saveDailyPlanSettings`, whose upsert is keyed by user/date. GitNexus index timestamp is 9 October 16:25 UTC; source files were read directly to verify the current implementation rather than rely on retained index line numbers.
- Plan: bind form state to selected-date identity, define unsaved-change behavior on date navigation, and preserve same-date manual budget edits when availability refreshes. Reset note, budget edit flag and default-budget tracking together for a new date. Audit sibling date-bound forms for the same issue without assuming they also fail.
- Verification: two saved days with different notes/budgets, a new unsaved day, Next/Previous and browser Back/Forward, a cleared note, unsaved edits, in-flight save/date navigation, and same-day availability refresh. Confirm Save modifies only the intended date and reload reproduces its values. Existing component coverage tests same-date refresh/manual-edit behavior, but does not exercise changed `planDate`; no tests were run or modified in this audit.

### QA-13 — P2: quarterly goal created by wizard has no matching edit-period choice

- Reproduction: use Study starter, select Quarter, confirm goal and first task, then open the resulting goal's Edit form. Year/Month/Week are the only period radios and all are unchecked; Quarter cannot be selected. Saving without changing the period preserves 1 October–31 December after reload.
- Source: graph context resolved `GoalForm` and its `PeriodSwitcher` dependency. `GoalForm` supplies no options override; `PeriodSwitcher` defaults to `POC_PERIOD_TYPES` (year/month/week), while the wizard offers the full period enum. The old `periods.ts` comment intentionally limited the POC; the current delivery plan section 5 describes both wizard and direct form paths but does not explicitly resolve this period mismatch.
- Plan: align supported goal periods across wizard, direct creation and editing. At minimum render the stored period as an available, selected option so existing quarterly goals remain understandable and editable. Decide allowed new-goal periods explicitly; do not broaden every shared PeriodSwitcher consumer by changing its global default without impact analysis. Preserve period normalization, parent compatibility and linked task identity.
- Verification: create through wizard and reopen/edit each supported period, unchanged save, switch away/back, reload, date boundaries and parent candidates. Include TH/EN at mobile/desktop widths. Day has the same source-level option mismatch but was not created in this browser case; do not count it as a separate confirmed reproduction.
- Evidence: `evidence/quarter-goal-edit-missing-period.png` and `evidence/quarter-goal-preserved-reload.png`.

Additional copy follow-ups: English singular counts displayed `1 days`, `1 tasks`, and `1 sub-goals`; Calendar on selected 12 October retained “Today's schedule”/today-note wording. The note itself was correctly isolated by date. Treat these as wording issues rather than evidence of incorrect stored dates.

### QA-14 — P2: invalid task duration is presented as a temporary system failure

- Reproduction: project Add Task, enter a title and duration 0 or 1441, submit. The duration field displays `เกิดข้อผิดพลาด ลองอีกครั้งในอีกสักครู่`. In English Edit Task, duration 0 displays `Something went wrong. Try again in a moment.` The form stays open and invalid changes are not persisted. A valid 30-minute creation succeeds and survives reload.
- Impact: users are told to retry rather than correct a known invalid value. This is an error-message defect, not a failure of the bounds check or evidence of a server outage.
- Source: GitNexus query/context resolved `TaskForm` and `FormMessageI18n`; current source confirms `taskFormSchema.estimatedMinutes` uses `.int().min(1).max(1440)` without localized error keys. `FormMessageI18n` maps any unrecognized message to `errors.generic`. Unlike title/recurrence checks, these Zod failures therefore fall through to generic retry copy.
- Plan: provide explicit localized keys for noninteger, minimum and maximum duration failures (or one clear integer/range message) and keep the optional empty value supported. Keep schema and input bounds/step consistent; retain server validation. Audit other numeric fields using the shared message renderer separately rather than assuming they all fail.
- Verification: create/edit in Thai and English with blank optional duration, 1, 30, 45, 1440, 0, 1441 and fractional values; invalid input identifies how to correct it, preserves entered fields, focuses/announces the error and writes no record. Valid save/reload retains exact duration. Check mobile and tablet layouts.
- Evidence: `evidence/tablet-task-duration-error.png`, `evidence/mobile-en-task-duration-error.png`.

### QA-15 — P2: moved recurring occurrence is indistinguishable from the destination day's own occurrence

- Reproduction: schedule the existing daily QA task's 11 October occurrence for 09:00–09:15, then use Calendar's move dialog to move that block to 12 October. Reload confirms no block on 11 October and one on 12 October. Today on 12 October correctly contains two occurrences, but both task rows display exactly the same title, Daily badge and domain, with identical checkbox and detail-button accessible names. Neither row identifies its original date. In contrast, the scheduling select distinguishes the moved occurrence with `(2026-10-11 → 2026-10-12)`.
- Evidence: the rendered checkbox IDs share the same task ID but end in `2026-10-12` and `2026-10-11`, both unchecked. The original 11 October task row is absent at the source date; the completed 10 October occurrence stays checked. This proves distinct UI occurrence identities and date-local movement, not accidental duplicate task creation. No ambiguous checkbox was toggled.
- Impact: a user choosing which occurrence to complete or open cannot identify the intended one from the row or its accessible name. Screen-reader users face the same ambiguity.
- Source: GitNexus context resolved `TaskRow` and its `TaskList` caller in Kemtit.com (index timestamp 9 October 16:25 UTC, lower-bound graph with one callable-value boundary). Current files were read directly: `TaskRow` renders title/recurrence badge and tests `item.date !== today`, but does not display `item.occurrenceDate`; its checkbox/open accessible names contain only the task title. `TaskList` passes `occurrenceDate` to completion/reschedule actions, so the action identity exists even though the row does not explain it.
- Plan: show localized original-date context for moved occurrences, such as “moved from 11 October”, and include it in checkbox/detail-button accessible names. Retain the original occurrence key and independent completion. Never merge these rows or mutate the recurrence rule to eliminate the visual ambiguity. Review priority selection/reordering with multiple occurrences of one task separately; this reproduction does not establish a priority mutation defect.
- Verification: one normal and one moved occurrence on the same day; two different source occurrences arriving together; independent completion/reversal after reload; move back; TH/EN, 360px and keyboard/screen-reader names. Source date and selected date must remain distinguishable while preserving scheduling/due-date contracts.
- Evidence: `evidence/recurring-indistinguishable-today.png`, `evidence/recurring-occurrence-moved-oct12.png`.

### QA-16 — P2: moving a member automatically dissolves a one-member source group

- Contract: `docs/plans/2026-10-09-task-cards-calendar-groups.md`, F6, explicitly retains groups with one member to prevent unexpected layout changes; only empty groups should be removed automatically, or a group explicitly dissolved.
- Reproduction: original `QA 1010 — กลุ่มตรวจการ์ด` contained Inbox and converted-note cards. Created a temporary target group from the High Health and quarterly-goal cards. Selected only Inbox, chose the target, and clicked Add to Group. Reload showed three target members; the original source group was gone and the unselected note card was Ungrouped. All task dates and schedules survived. This is a group/membership contract defect, not task loss.
- Source: GitNexus query/context located the group action/query/component flow. Direct reading of migration `20261009170000_task_cards_calendar_groups.sql` confirms its create/add source-group cleanup and remove branch use `count(*) <= 1`, clear remaining membership and delete the group. This matches the browser behavior. The live database function body was not independently read; the migration text alone is not asserted to prove deployment state.
- Plan: in a forward migration, retain singleton groups during create/add/remove and delete only empty source groups. Preserve locking, ownership, versions, operation snapshots and Undo; explicit Dissolve remains supported. Review current tests for an obsolete singleton-dissolution expectation rather than changing tests merely to obtain green results.
- Verification: 3→2, 2→1 and 1→0 moves/removals; create a new group using a member of an existing two-card group; cross-group moves; explicit Dissolve; successful and stale Undo. Confirm group identity/title/order are retained at one member and task identity/photos/schedule/goal/project remain unchanged after reload.
- Evidence: `evidence/group-singleton-auto-dissolved.png`.
- Fixture recovery: after reload the original operation's Undo was no longer exposed (GROUP-02). Recreated the original title with the same two tasks using the normal Create Group action. This is a new group record, not same-ID restoration; task records and their 10:00–10:30 / 11:00–11:30 schedules were retained. The temporary group was explicitly dissolved after the independent conflict test.

### QA-17 — P2: skipping an occurrence counts it as completed in Today and daily print

- Reproduction: on Today for 13 October, opened the daily QA task and chose “ข้ามครั้งนี้”. After reload, the headline changed from 0/1 to “ทำแล้ว 1 จาก 1 งาน”. Under “เสร็จแล้ว”, the row still had an unchecked checkbox and the explicit “ข้ามครั้งนี้แล้ว” badge. The daily print link for the same date/scope showed the task under “เสร็จแล้ว” with a checkmark and no skipped label.
- Impact: skipping work is presented as having completed it; the printed report removes the only visible distinction. This reproduction covers the screen print route, not an exported PDF or the weekly print route.
- Source: after GitNexus context inspection, current `src/core/domain/dayplan.ts` was read: the `done` bucket includes items where `done || skipped`. Today uses the bucket length for its completed metric and renders that bucket under the completed heading. The shared bucket semantics must be reconciled with presentation before changing either independently.
- Plan: distinguish completed and skipped occurrences in summary counts, sections and print markers. Keep skipped occurrences out of active work while retaining their history; define an explicit display for a day with no eligible active/completed work. Audit other consumers of this shared bucket without claiming they reproduce the bug until tested.
- Verification: skip, complete and reverse completion for one occurrence; reload; neighboring-day independence; a moved occurrence; TH/EN Today and daily/weekly print. Assert that skipped work never receives a completed checkmark or contributes to the completed count. Define and test the denominator separately.
- Evidence: `evidence/recurring-skipped-counted-done.png`, `evidence/print-skipped-under-completed.png`.
- Recovery: used the normal checkbox to complete the skipped 13 October occurrence, reloaded, then unchecked it and reloaded. Today returned to 0/1 with one active unchecked row and no skip badge. The 14 October occurrence remained unchecked. This restores visible task state through a completion/reversal sequence; it does not erase operation history.

## Remaining full-scope work

### QA-18 — P2: legacy Calendar editor misreports a locked interval as an overlap

- Setup: created one clearly labelled task and linked locked block only for the existing local QA account, 11 October 16:00–16:30. Loopback-only database setup was guarded and recorded in `evidence/locked-fixture.json`; no other account or application code was changed.
- Reproduction: Timeline correctly disables the block with the label “ช่วงเวลานี้ถูกล็อกและย้ายไม่ได้”. The lower schedule list still exposes Edit Time. Submitted 16:30–17:00 through that form with Enter; toast said “ช่วงเวลานี้ชนกับช่วงเวลาที่มีอยู่แล้ว”. The original interval remained 16:00–16:30. Task detail's Tomorrow shortcut instead correctly says “ช่วงเวลาที่เชื่อมกับงานนี้ถูกล็อกอยู่ กรุณาปลดล็อกก่อนเลื่อนงาน”.
- Authoritative readback after the edit and Rescue tests: the locked block was still active, locked, version 1 and at its exact original start/end. This is incorrect diagnostic guidance and inconsistent controls, not a lock bypass or lost data.
- Source: GitNexus context for `updateTimeBlock` identifies `TimeBlockActions.save` as its caller. Current action maps a null RPC result to `timeBlockConflict`; the legacy component renders only overlap or generic errors. The migration's atomic-update guard returns without an ID for a locked row, stale version or inactive row. The source explains why distinct failures can collapse into overlap; only the locked-row case was reproduced here.
- Plan: preserve the atomic guard and ownership checks while returning distinct locked/stale/inactive/overlap outcomes. Expose locked state consistently in the lower list and avoid offering an apparently usable time editor for a locked block. Do not silently unlock or move it. Verify any intentional unlock workflow separately.
- Retest: locked/unlocked block editing, true overlap, stale version, inactive block, TH/EN corrective guidance, calendar and task-detail consistency. Assert unchanged interval/version on every rejected write.
- Evidence: `evidence/locked-calendar-edit-rejected.png`, `evidence/locked-task-reschedule-rejected.png`.

Priority Undo continuation (TODAY-07): an initial toast expired before activation. Subsequent semantic-click attempts did not visibly reverse the saved order and are inconclusive for physical mouse behavior. From a fresh reload, moved Exercise up, activated the visible Undo with Enter, then reloaded: Reading → Exercise → Inbox was restored, establishing keyboard Undo persistence for that operation. Finally moved Exercise up without Undo and reloaded to restore the baseline Exercise → Reading → Inbox. Evidence: `evidence/priority-undo-restored.png`. Native mouse activation and stale priority Undo remain unverified; no additional confirmed bug is asserted from the click discrepancy. GitNexus context for `DailyPriorityList` and current source were inspected read-only; no source edits or new automated test run.

The following is a continuation queue, not an assertion these areas fail:

1. Calendar event local creation/edit/all-day/availability/range/cancel/approved-delete paths now have EVENT-01–07 evidence. Remaining provider/error/concurrency branches need distinct results; do not repeat completed cases solely because this queue previously listed them.
2. Native task/card drag, card-group dwell and resizing remain unavailable to verify through the current pointer mapping. Accessible move/resize/group/Undo paths have separate evidence; CAL-08 now covers one stale-tab conflict. Locked-block and server-failure fixtures still need controlled setup; do not mark native gestures passed from component tests.
3. Quick Capture's seven create branches and a Note double-submit path (CAP-09) have current browser results. Direct server replay and interrupted/failed response recovery remain separate fixture-dependent checks. Task recurrence edit/restore and next-day independence already have evidence; reconcile exact cases before adding remaining search/filter tests.
4. Projects create/edit/task/progress/archive/restore, Note/Task recovery, Rescue apply/immediate Undo and Feedback success now have current evidence. Finish remaining variants, Settings/profile/security, Updates populated/detail states and shell/mobile navigation beyond the two viewport cases above. Reconcile older action ledgers with changed files; retain both versions of evidence.
5. Auth/onboarding/root/redirect routes and permission/error states in a separate safe session; keep the current QA account session available.
6. LAYOUT-01 now covers rendering/document width for 16 primary routes × TH/EN × 1440/768/390/360 (128 observations). Remaining responsive work concerns dynamic detail/role/auth states, conditional interactions, 200% browser zoom and physical gestures; do not rerun the completed default-route width matrix without a change or new concern.
7. Provider-dependent Google/Outlook/LINE paths require current availability verification. Do not weaken browser protections or invoke global cron against existing users. Hosted deployment remains distinct from local QA.
8. Reconcile every route and control against an explicit executed/failed/unavailable/not-executed ledger before completion; compile the final prioritized fix plan and retest criteria.

The Sales permanent-delete action uses database DELETE and has no normal recovery path in the inspected code. Its final destructive confirmation has not been executed in this continuation; complete the reviewable test setup before requesting action-time authorization if that branch is needed. No permanent deletion was attempted.

## Prioritized implementation sequence after audit

1. **Prevent cross-period content replacement (QA-09, QA-12):** reset or remount week-bound review and date-bound daily-plan state. Verify client-navigation/save isolation for both before lower-priority polish; preserve same-period manual edits during refresh.
2. **Preserve scheduling intent (QA-11, QA-07, QA-06, QA-18):** close the inconsistent calendar-event overlap boundary, make event time/all-day explicit, restore eligible Rescue Undo after reload, and distinguish locked-block rejection from overlap in the legacy editor. These affect the user's ability to trust and recover a schedule. Keep canonical event writes, request IDs, ownership and conflict checks intact.
3. **Make summaries truthful (QA-01, QA-02, QA-08, QA-17):** define the shared weekly task/occurrence and effective habit cohorts first, then change queries and labels together. Separate skipped from completed work in Today and print. Verify moved, recurring and not-yet-started items against Today, Reviews and Insights.
4. **Align grouping and goal-period contracts (QA-16, QA-13):** preserve singleton source groups and verify their Undo snapshots with a forward migration; resolve the old POC/new wizard option mismatch and ensure a stored quarterly period is visibly selected and editable. Keep these separate implementation changes with scoped regressions.
5. **Repair accessibility/localization (QA-04, QA-03, QA-10, QA-14, QA-15):** bind amount labels, expose habit toggle state, distinguish moved recurring occurrences visibly and accessibly, localize duration units and explain invalid task durations with corrective guidance. Retest amount validation/presets, duration boundaries, completion reversal and narrow-screen rendering in both languages.
6. **Remove duplicate confirmation (QA-05):** preserve accessible dialog description and one-topic Feedback flow while rendering the message once.
7. **Separate UX follow-ups:** broaden common-language capture recognition and explicit duration handling, reconcile duplicated task/block display, improve Sales entry-point wording/defaults, English singular counts and selected-date Calendar headings. Confirm expected behavior before expanding contracts.

For each implementation batch: run scoped GitNexus impact before editing, add behavioral regression coverage, run the appropriate tests, repeat the actual Chrome reproduction with save/reload, then record pass/fail evidence. A finding closes only after its reproduction passes; no fixes are claimed by this report.

## Evidence and retained test fixtures

Screenshots in `evidence/`: finance-paid-reload, insights-productivity-date-label, insights-time-th-units, recurring-complete-today, recurring-omitted-insights, sales-entry-reload, event-edit-reload.

Additional screenshots: task-restored-subtasks, note-converted-task-search, project-restored, feedback-thanks, rescue-applied, rescue-reload-no-undo. Retained fixtures also include the restored Inbox task/subtasks, converted note and task, restored project `ff022e30-8958-413c-9a17-7d5c384b2450` with its completed task, one local Feedback submission and the four Rescue placements. Original Seller role was restored; profile focus and scope were unchanged.

Additional capture fixtures: 15-minute task (planned 10 October, not time-blocked after immediate Undo), 42.75 expense, 88.50 unpaid one-off bill due 11 October, daily Health habit target 7, Growth goal for October, and the 11 October all-day event whose title contains 14:00. Evidence: `capture-event-time-lost.png`, `capture-event-preview-no-time.png`. Creating the new bill did not mark it paid.

Mobile evidence: `mobile-capture-note-reload.png`, `mobile-en-capture-validation.png`; one clearly named mobile note remains. The 11 October recurring task was returned to incomplete; its 10 October completion remained. Language is Thai and viewport override is reset. Physical touch hardware and native mouse dragging remain unverified.

Latest retained state: captured parent goal `5224636d-a8c0-4c49-9f18-c3f0cb084e2c` renamed to `QA 1010 — เป้าหมายแม่แก้ไข` and restored; child `37a64d03-6677-4487-a113-fb36ddc5eeb3` and its completed task yield 100% parent progress. A review for week 27 September was added; original 4 October review remains unchanged. The 15-minute task now has planned date **11 October** after successful carryover, no deadline, and QA notes; this supersedes its earlier fixture date. Additional evidence: goal-parent-progress, goal-restored-progress, tasks-deadline-filter, review-before-habits-start, review-stale-week-form, review-correct-week-after-reload, review-carryover-task-date.

Local QA account retains the clearly named finance transactions/budget, monthly bill pair, daily recurring task, finance metric goal (`a85f41cd-89f1-4dc0-8612-da119e696a7a`), sales metric goal (`0f83e832-a369-40da-92fe-b10440649918`), sales entries #K0045/#K0046 and calendar event. Preserve these fixtures for the next cross-page and regression checks. They are test inputs, not real business activity.

No code fix, test rerun, commit or deployment is claimed for this continuation. Findings are ready for implementation after the remaining audit, with scoped impact analysis required before code edits.

Latest fixture correction: EVENT-07 permanently removed the 11 October all-day capture event after explicit user approval; its earlier retained-state entry above is historical. Habit completion and task recurrence changes from this continuation were restored; the daily QA task is again Daily, with 10 October completed and 11 October incomplete. No app code was changed.

Calendar fixture update: CAL-05 cancelled the previous Inbox QA time-block record and rebooked that task into a new active 10 October 11:00–11:30 interval. Visible schedule and card are restored, but this is not same-record Undo. Evidence: `evidence/calendar-card-restored.png`.

## Role and starter continuation

- ROLE-01: selected Employee in Settings, saved and reloaded. Work navigation changed to Projects; monthly Plan guidance referred to deliverables and appointments. Projects retained the single existing QA project. No project was created by this role change.
- ROLE-02: selected Student, saved and reloaded. The work-specific sidebar entry was absent and monthly guidance referred to assignments/exams. Existing Work focus remained selected. Direct navigation to the already known Projects route still rendered its existing project; this records planning-context behavior, not an established authorization defect. Seven existing goal links remained. Evidence: `evidence/student-plan-guidance.png`.
- ROLE-03: restored Seller, observed the saved-context toast and Seller selection. Subsequent Life/Goals navigation displayed Seller and Sales again. Focus/scope were preserved; no app source changes were made.
- GOAL-10: opened Life's optional Work example through its visible link. The three-step wizard prefilled Work, Month starting 1 October, the suggested work outcome, and a first task planned for 17 October. Step 3 explicitly disclosed one goal plus one task and no write until confirmation. Left through Goals navigation without confirming, reloaded, and observed the same seven existing goal links with no suggested Work goal added. This is a preview/leave-without-save pass, not a Work-starter creation pass. Evidence: `evidence/work-starter-preview.png`.
- NATIVE-06: after the user's latest confirmation that Chrome was in front, a fresh native Chrome binding still reported the Mac locked. No pointer action was dispatched and no drag result is claimed. The connected Chrome DOM remained operational. This tooling result does not contradict the user's observation of their screen; it establishes only that native control remains unavailable to this session.

This continuation adds no confirmed defect beyond QA-01–QA-14. Native drag, new upload and the explicitly listed conditional branches remain open; the audit is not full-system completion.

## Report controls and Sales deletion preparation

- INS-07: inspected the five remaining report surfaces (Productivity, Finance, Goals, Routine, Life Balance) through their visible navigation links and current rendered content. These surfaces expose report navigation but no main-content action buttons. Finance now shows income 1,000.75, expense 418.15, net 582.60, remaining budget 82.10 and one paid/one unpaid October bill. Goals shows five active/two completed, average 14% (30% + 40% + three zero-progress goals divided by five). Routine shows today 0/2 and week 1/11. This closes discovery of additional report action buttons; existing QA-01–03/08 findings and fixture-dependent metric cases remain unchanged. No unseen date/filter/export control is claimed tested.
- SALES-06: Add Entry rejected both -1 and 0 with the corrective message `ต้องเป็นตัวเลขมากกว่า 0`; no invalid row was submitted successfully. Correcting the amount to 1.25 and adding note `QA 1010 — ทดสอบลบยอดขายเฉพาะรายการนี้` created exactly one visible entry, #K0047, dated 10 October. Reload retained it and increased the sales total from 2,000.50 to 2,001.75. This is synthetic local test data. Evidence: `evidence/sales-delete-fixture-awaiting-approval.png`.
- SALES-07: at 360×800, opened #K0047 Edit, changed amount to 999 and note to a distinct cancellation marker, then pressed Escape. The dialog closed; reload retained the original 1.25 and original note. Dialog bounds were x=0/right=360 and document width=360. Viewport override was reset. Evidence: `evidence/mobile-sales-edit-before-cancel.png` (unsaved intermediate state, not a persisted amount).
- SALES-08 pending: requested action-time permission to permanently delete only #K0047. The browser policy requires confirmation for irreversible deletion. No delete button was clicked in this continuation. If approved, verify disappearance after reload and restoration of 2,000.50 total while #K0045/#K0046 remain. Do not reuse approval for the earlier Calendar QA event for this different record.

Retained-state update: #K0047 currently remains pending permission, so the current Sales total is 2,001.75. Earlier 2,000.50 baseline statements describe the state before this isolated deletion fixture. No source edits, automated test runs, commit or deployment were performed.

## Mobile event form and occurrence movement

- EVENT-08: at 360×800, opened the existing 10 October event editor. Checked All Day: date-only controls appeared with both dates 10 October. Unchecked it: original 09:00–09:30 returned. Input edges stayed within x=29–331 and document width stayed 360. Changed the title, pressed Cancel, reloaded: the original event title and 09:00–09:30 persisted. No event save/delete was performed. Evidence: `evidence/mobile-event-edit-toggle.png`.
- REC-06: created one linked 11 October 09:00–09:15 block for the daily QA task through Today's scheduling form. Moved it to 12 October using Calendar's accessible move control; reload verified source empty/destination one block. Today showed the original 12 October occurrence and the moved 11 October occurrence with separate DOM identities. 11 October had zero rows for that task while moved; 10 October retained its completed occurrence. Functional date movement passed; row identification failed as QA-15.
- REC-07: moved the same interval back to 11 October, then cancelled the newly created QA block through the existing lower-list Cancel control. Reload showed no active 11 October interval. Today 11/12 October each again showed exactly its own unchecked daily occurrence. The earlier 10 October completion was not edited. This restores visible schedule/occurrence state, not database version/history rollback: the cancelled block and operation history may remain.

Viewport was reset to normal desktop. Sales #K0047 approval and native/upload limitations remain pending. No application code was changed.

## Cross-group movement and stale Undo

- GROUP-06: selected two ungrouped cards (High Health planned 12 October; quarterly first-step planned 17 October), created `QA 1010 — กลุ่มปลายทางชั่วคราว`, then moved only the scheduled Inbox card from its original group into this target. Reload showed the three target members and Inbox's original 11:00–11:30 schedule. Source singleton was unexpectedly dissolved: QA-16. Recreated the original group title and membership through UI; both original task schedules remained.
- GROUP-07: renamed the temporary group in tab A to `QA 1010 — Undo ก่อนแก้แท็บสอง`; in fresh tab B renamed it again to `QA 1010 — ชื่อใหม่จากแท็บสอง`. Tab A retained its earlier operation's Undo. Clicking it did not overwrite the newer name; repeating that same stale Undo exposed the explicit message `งานหรือกลุ่มนี้เปลี่ยนไปจากอีกหน้า โหลดข้อมูลใหม่ก่อนเลิกทำ`. Reload in both tabs retained tab B's name and two members. This is a pass for stale rename-Undo conflict protection, not all possible group conflict types. The brief uncertain-operation panel while the request was in flight was not treated as a persistent error. Evidence: `evidence/group-stale-undo-rejected.png`.
- GROUP-08: closed tab B and explicitly dissolved the temporary group. Reload retained only the recreated original QA group with Inbox and Note at their original times; High Health and quarter cards were Ungrouped again. Evidence: `evidence/group-members-restored-new-group-record.png`.

Current group title/member/schedule layout matches the pre-test layout, but the original group ID was replaced during recovery from QA-16. Source code was only inspected; no fix or automatic test rerun is claimed.

## Task-detail rescheduling shortcuts

- REC-10: opened the 11 October daily occurrence and clicked Tomorrow. Source row disappeared after reload; 12 October showed its own occurrence and the moved occurrence, with DOM checkbox identities ending `2026-10-12` and `2026-10-11`. Both remained unchecked. This repeats QA-15's identification problem, not a new bug.
- REC-11: selected the moved row by its inspected DOM occurrence identity, then clicked Next Week. Confirmation explicitly said 19 October. Reload at 19 October retained its normal occurrence and the original 11 October occurrence. The dialog showed planned date 19 October, Daily recurrence and no deadline. The shortcut advances the occurrence's current scheduled date by seven days. Ordinary users still cannot identify the moved row by visible/accessible name (QA-15); DOM disambiguation is test tooling, not a UX workaround offered to users.
- REC-12: opened Choose Date on that same occurrence, opened the calendar and selected 11 October. Reload at 19 October left only the normal 19 October occurrence. Reload at 11 October showed exactly its original unchecked occurrence. No time block was created and no recurrence rule was edited. Operation history/version changes remain.
- TASK-05: on 11 October, opened the one-off 15-minute task `f0432880-fdcd-4957-be27-2ddff939a952`, clicked Next Week and received 18 October confirmation. Reload/open at 18 October showed planned date 18 October and no deadline.
- TASK-06: from that 18 October view, Tomorrow moved it to 19 October. Reload retained the same task checkbox ID, unchecked status and no deadline. This verifies behavior relative to the selected day in Today; it does not establish every caller's date context.
- TASK-07: used Choose Date/calendar to return it to 11 October. Reload at 19 October showed no row for this task; reload at 11 October restored the original task ID, unchecked status, alongside the recurring and long-title fixtures. Neither operation created a new task or time block in the observed UI.

Evidence: `evidence/recurrence-shortcut-week-move.png` (intermediate destination), `evidence/task-shortcuts-restored.png` (restored 11 October). Graph query/context for `TaskList` preceded current source inspection; context reports lower-bound callers with one callable-value boundary. The component uses occurrence identity for recurring writes, and advances `selected.date` for recurrence shortcuts; the one-off branch advances its `today` prop. No source change, automated test run or new confirmed defect in this continuation. Browser remains on restored 11 October.

## Isolated locked-block fixture

- CAL-10: locked timeline move control disabled, no resize handle for that block; task reschedule rejected with explicit locked guidance. Legacy lower-list editor rejected the write but reported overlap: QA-18. Repeated submissions captured the transient toast; early screenshots alone did not establish its wording.
- RES-07: Rescue preview retained the locked 16:00–16:30 commitment, placed the two eligible one-off tasks at 09:00–09:30 and 09:30–09:45, and explained why the unanchored daily occurrence could not be placed. Applied through Chrome: free time became 405 minutes, locked time stayed unchanged. Immediate Undo and reload restored the pre-apply preview/free-time state. Database readback confirmed locked block version 1 and unchanged interval. Evidence: `evidence/rescue-locked-block-retained.png`.
- Fixture cleanup: unlocked only the newly created block through guarded local setup access, then used Calendar Cancel and task Archive through Chrome. Final readback: block cancelled/unlocked/version 2; task archived with `deleted_at = null`. Final reload removed the fixture from Today. An early reload during archive completion still showed the row; a redundant archive returned a generic error because the first archive had completed. This timing observation is not counted as another confirmed bug. Evidence: `evidence/locked-fixture-cleaned-up.png`. No permanent deletion occurred; cancelled/archived fixture and operation history remain.
- Updates feasibility: operations documentation and query/schema show releases are shared across approved users; only read markers are per account. A published fixture cannot be restricted to the main QA account using the current release contract. No announcement was inserted or published in this continuation. Failure/lost-response browser cases remain separate from this locked-data fixture.

## Unpublished Updates fixture and failure-test boundary

- UPD-03: prepared one unpublished synthetic local draft, ID `cf18a5f0-477f-4a96-8fc6-4068d2713a96`, version `qa-local-20261010-browser`, with matching TH/EN New/Improved/Fixed test items. `published_at` is null. Chrome `/updates` continued showing no updates; its exact direct detail URL rendered Not Found. Existing-row draft protection is now tested separately from the earlier nonexistent-ID case. Evidence: `evidence/updates-draft-fixture.json`, `evidence/updates-draft-hidden.png`.
- Requested permission to publish that exact local fixture temporarily, test populated/read/unread/locale behavior, then return it to draft. This is pending because the current schema shares announcements with every approved local account. No publication or read acknowledgement occurred.
- Observed a development-console error on the direct draft URL: React/Next component performance measurement reported a negative timestamp for `UpdateDetailPage`; the Not Found page still rendered. Other captured warnings came from the EverBee Chrome extension and are not attributed to Kemtit. The development-only measurement error has not been reproduced in a production build and is a diagnostic note, not a confirmed application data defect. The Not Found page contains nested main landmarks; record for the shared error-page accessibility follow-up without inferring a navigation failure.
- Capability inspection returned only `viewport` for the current Chrome session. The supported API has no network routing/offline switch. Native DevTools control is unavailable under NATIVE-06. Controlled lost-response/failed-read/failed-write tests therefore remain unexecuted; no shared server/database disruption or unsupported browser control was used as a substitute.

## Rescue concurrent write and Feedback rejection

- RES-08: tab A retained the 11 October Rescue preview placing the long-title task at 09:00–09:30 and the 15-minute task at 09:30–09:45. In tab B, created unlinked `QA 1010 — จองเวลาระหว่างรอยืนยันแผน` at 09:00–09:30 through Today's scheduling form and reloaded to verify it. Submitted tab A's unchanged preview: localized rejection `ข้อมูลเปลี่ยนระหว่างการตรวจสอบ ลองสร้างแผนใหม่ก่อนยืนยัน` appeared. Tab B reload still showed only its new interval, with neither proposed task interval partially applied. Reloading Rescue produced a fresh proposal at 09:30–10:00 and 10:00–10:15, respecting the new commitment. Pass for this apply-time schedule-concurrency case. Evidence: `evidence/rescue-concurrent-preview-rejected.png`.
- RES-09: cancelled only the new unlinked interval through Calendar; returned to Today and verified no scheduled intervals for 11 October. Closed the extra QA tab. Cancelled fixture/history remains; no permanent deletion. Evidence: `evidence/rescue-concurrency-cleaned-up.png`.
- FEED-02: selected only the Error topic and submitted in the local QA account; Thanks appeared, still with the previously recorded duplicate copy (QA-05). Immediately reopened and submitted the same topic as a new request. The form displayed `ส่งความคิดเห็นไปแล้วเมื่อไม่นานนี้ ลองใหม่อีกครั้งภายหลัง`, retained Error with `aria-checked=true`, and did not show a false success. Closed the dialog without retrying. Read-only local database verification at 03:15 UTC found exactly one submission since 03:13:03 UTC: `9edec729-5297-4148-adef-65cd273a05e8`, topic `error`, created 03:14:27 UTC. Pass for one-minute quota rejection and preserved selection; not proof of same-request replay, daily quota or network-loss recovery. Evidence: `evidence/feedback-rate-limit.png`.

These are new executed conditional cases, not reruns of the default layout matrix. One additional account-bound synthetic Feedback row remains. No new defect, application change, automated test rerun or release publication is claimed. The prepared Updates publication permission, Sales deletion permission and upload/native/auth/provider/device boundaries remain unresolved.

NATIVE-07 / dependency revalidation: a fresh native Chrome binding still reports Mac locked; connected Chrome again advertises only viewport. No gesture, print or network-failure action was dispatched. The next continuation after RES-08/09 and FEED-02 yielded no new functional result and is the first consecutive dependency-impasse turn, not a completed audit or a live-process wait. Pending user questions were not duplicated. See the completion audit for the exact remaining dependencies.


## Resumed browser QA: Work starter confirmation and Life recovery

- GOAL-11: followed Life → Work starter, edited the goal to `QA 1010 — ยืนยันชุดเริ่มต้นด้านงาน` and the first task to `QA 1010 — งานแรกจากชุดเริ่มต้นด้านงาน`. Step 3 disclosed one goal and one task; confirmed once. The resulting goal `7151da18-b8ce-439d-932f-3b8ce0c84683` displayed Work, October 2026 ending 31 October, and exactly one linked incomplete task dated 17 October. Reload preserved this result. Opening the task detail confirmed planned date 17 October, no deadline, and the correct goal link. Evidence: `evidence/work-starter-created-reload.png`. This closes the previously unexecuted Work-starter creation path; it does not establish same-operation replay or server-failure behavior.
- LIFE-RECOVERY-01: initial navigation to `/life` rendered the route error boundary. Browser logs recorded `getActiveHabits` / `QueryError: queryFailed` and a goals-list failure. Clicking the visible retry button restored the populated Life page, including both existing habits, without restarting services or changing data. Both local application and database gateway ports were listening when checked. The original failure cause remains unknown; record observed recovery, not a newly confirmed defect or a controlled network-failure pass.
- Native Chrome acquisition still returns a lock error despite the user's confirmation that the Mac is unlocked. Chrome extension interaction works. This remains a tooling-status discrepancy; no native drag or upload result is claimed.

Retained local fixture: the new Work goal and its one linked task remain active for review. This adds one active goal and one incomplete planned task to previous metric baselines. No source fix, test-suite run, commit or deployment occurred in this continuation.
