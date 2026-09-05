# Tracking Log

Record of implementation work on this project. See `CLAUDE.md` for the workflow rules this log follows.

Each entry:
- **Date**
- **Task**
- **Files changed**
- **Reason**
- **Result**

---

## 2026-09-05

- **Task**: Add a `.gitignore` file to the project.
- **Files changed**: `.gitignore` (new)
- **Reason**: Repo had no `.gitignore` yet; stack is Next.js/TypeScript with Supabase env vars, so build artifacts, `node_modules`, and secrets needed to be excluded before any real code lands.
- **Result**: Added standard Next.js/TypeScript ignores (`node_modules/`, `.next/`, `out/`, `.env*`, `*.tsbuildinfo`, etc.), plus `.gitnexus/` (local gitnexus index) and common editor/OS files (`.DS_Store`, `.vscode/`, `.idea/`).

## 2026-09-05

- **Task**: วิเคราะห์ `docs/kemtit-full-scope.md` และ `docs/kemtit-ui-design-system.md` แล้วเขียนแผนดำเนินการ POC (ยังไม่ implement — รอรีวิว)
- **Files changed**: `docs/implementation-plan.md` (new), `tracking-log.md`
- **Reason**: ต้องมีแผนที่เรียงตาม dependency จริง, รายการคำถาม/ข้อขัดแย้งระหว่าง 2 เอกสารให้เจ้าของโปรเจกต์ตัดสินใจ, และประมาณการเวลาที่สมจริงก่อนเริ่ม Milestone 1
- **Result**: แผนมี 3 ส่วน — (1) สรุปความเข้าใจ 10 บรรทัด, คำถาม 19 ข้อ (Q1-Q19) ที่ต้องตัดสินใจ, ความเสี่ยงเทคนิค 16 ข้อ (R1-R16); (2) M0 setup + M1-M6 milestones, ลำดับ component, จุดหยุดทดสอบ user 3 จุด (CP0-CP2), ประมาณ 7.5-9 สัปดาห์ (6-7 ถ้าใช้รายการตัด); (3) ส่วนที่ควรตัด/ประเมินต่ำไป/dependency ภายนอก + ข้อเสนอนอก scope + 3 สิ่งที่ต้องตัดสินใจก่อนเริ่ม — ยังไม่มีโค้ดใด ๆ ถูกสร้าง; รอการอนุมัติแผนก่อนเริ่ม M0/M1

## 2026-09-05 (รอบ 2)

- **Task**: รับ POC Decisions จากเจ้าของโปรเจกต์ (3 ข้อ: กฎ goal/schema, LINE+cron, รายการตัด) → ปรับ `docs/implementation-plan.md` เป็น v2 และแก้เอกสารต้นทางให้ตรง
- **Files changed**: `docs/implementation-plan.md` (เขียนใหม่ v2 + ภาคผนวก A บันทึก Decisions + ภาคผนวก B รายการไฟล์ M0), `docs/kemtit-full-scope.md` (§7 Flow A ข้อ 4-5 และ Flow C ข้อ 1-2, §12 แถว POC + footnote, §13 แถว POC/Dev), `docs/kemtit-ui-design-system.md` (§8.4 ติดป้าย POC/MVP), `tracking-log.md`
- **Reason**: Decisions มีลำดับความสำคัญสูงกว่า full-scope/design-system เมื่อขัดกัน จึงต้องทำให้ทั้ง 3 เอกสารเล่าเรื่องเดียวกันก่อนเริ่ม M0
- **Result**: POC = 2 widget fixed, `goal_kind` metric/execution, `task_completions`, LINE push เฉพาะ overdue (1/วัน) + goal สำเร็จ, GitHub Actions `*/5` + pg_cron fallback, ปฏิทิน วัน/สัปดาห์/เดือน; ตัด SalesVsGoal/ShopChecklist/DailyLife/digest/offline queue/WidgetPicker · ประมาณการใหม่ 7-9 สัปดาห์ (เป้า 6-7 ต้องใช้คันโยกตัดเพิ่มที่ระบุใน §2.7) · ยังไม่มีโค้ด — M0 รอยืนยันรายการไฟล์ในภาคผนวก B · จุดที่ยังเปิด: เวลาสแกน overdue 08:00, นิยาม streak รวม task เดี่ยว, ข้อความ template

## 2026-09-05 (รอบ 3 — Milestone 0)

- **Task**: M0 — scaffold โปรเจกต์ + tooling + design token + migration แรก ตามแผน v2 และ 7 ข้อแก้ไขของเจ้าของโปรเจกต์ (branch `feat/m0-scaffold`)
- **Files changed**:
  - scaffold/tooling: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (allowBuilds: supabase), `next.config.ts` (next-intl plugin), `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs` (boundaries + hex + a11y), `.prettierrc`, `.prettierignore`, `.nvmrc` (22), `.env.example` (7 ตัวแปรตาม Decision + `NEXT_PUBLIC_LINE_OA_BASIC_ID`), `netlify.toml`, `components.json`, `vitest.config.mts`, `vitest.setup.ts`, `playwright.config.ts`, `.storybook/{main.ts,preview.tsx}`, `.github/workflows/ci.yml`
  - src: `src/styles/globals.css` (token ครบชุด + alias shadcn + ล้าง default ของ Tailwind), `src/styles/theme.ts`, `src/app/{layout.tsx,page.tsx,icon.svg}`, `src/i18n/request.ts`, `src/types/next-intl.d.ts`, `src/messages/th.json`, `src/lib/{utils.ts,utils.test.ts,env.ts,env.server.ts,env.test.ts}`, `src/components/ui/{button.tsx,button.stories.tsx}`, `public/.gitkeep`
  - supabase: `supabase/config.toml` (site_url, otp_expiry 600, template magic_link), `supabase/migrations/20260905133043_user_profiles.sql`, `supabase/templates/magic_link.html`, `supabase/.gitignore`
  - แก้ไข: `.gitignore`, `README.md` (ส่วน "เริ่มพัฒนา" รวมขั้นตอน Supabase 2 project / Resend SMTP / Netlify / LINE / GitHub), `AGENTS.md` (Next ใส่ block `nextjs-agent-rules` เองตอน dev — ใส่ล่วงหน้าให้ tree สะอาด; ส่วน gitnexus ไม่แตะ), `docs/implementation-plan.md` (sync ชื่อโฟลเดอร์ `shared-services/`, `NEXT_PUBLIC_APP_URL`, migration timestamp, กฎ lint)
- **Reason**: ตั้งฐานให้ M1 เริ่มเขียน feature ได้ทันทีโดยไม่ต้องย้อนแก้ tooling — ทำตาม 7 ข้อ: (1) migration ใช้ `supabase migration new` timestamp (2) trigger `handle_new_user` + RLS + column-level grant ในไฟล์เดียว (3) `lib/env.ts` validate แบบ lazy แยก client/server และข้ามเมื่อ `CI=true` (4) กฎ `no-restricted-imports` กัน modules import กันเอง และกัน `@supabase/*` ใน modules/shared-services/components (5) `.env.example` ครบทุกตัว (6) next-intl without routing (7) CI ไม่รัน Playwright
- **Result**: `pnpm lint` / `typecheck` / `test` (6 tests) / `build` (CI=true) / `build-storybook` ผ่านทั้งหมด; `next start` render หน้าไทย `lang="th"` ฟอนต์ Plex Thai theme-color ถูกต้อง · สิ่งที่ต่างจากรายการที่ยืนยัน: ใช้ `src/app/icon.svg` แทน `public/favicon.ico` (convention ของ Next), ใช้ package `cn` ของ shadcn แทน clsx+tailwind-merge เพราะ CLI v3 generate `import { cn } from "cn"`, ไม่ได้ติดตั้ง `eslint-plugin-boundaries` (ใช้ `no-restricted-imports` ตามที่ขอ), ใส่ block ของ Next ใน `AGENTS.md` · ทดสอบ migration บน Postgres 17 จริงใน Docker (จำลอง role anon/authenticated/service_role + `auth.users` + `auth.uid()`): apply ผ่าน, trigger สร้าง profile 2/2, RLS เห็นเฉพาะของตัวเอง, update แถวคนอื่นได้ 0 แถว, update `subscription_tier`/`line_user_id` จาก authenticated ถูกปฏิเสธ, anon อ่านไม่ได้, `updated_at` ขยับ, cascade delete ทำงาน — สคริปต์ทดสอบอยู่นอก repo (scratchpad) ยังไม่ได้เพิ่มเป็น `pnpm db:test` · GitHub Actions CI run แรกบน branch ผ่าน (lint/typecheck/test/build) · Storybook แจ้ง chunk > 500kB (เป็น runtime ของ Storybook เอง ไม่ใช่ของแอป) · button ของ shadcn สูง 36px ยังไม่ถึง 44px ตาม Design §10 — ปรับตอน M1 พร้อม primitives ที่เหลือ · รอเจ้าของโปรเจกต์: สร้าง Supabase 2 project + Resend SMTP + Netlify + LINE + GitHub secrets แล้ว `pnpm exec supabase link` + `pnpm db:push`

## 2026-09-05 (รอบ 4 — Milestone 1: Foundation, Auth OTP, Onboarding ขั้น 1-2) — branch `feat/poc`

- **Task**: M1 ตามแผน v2 — Supabase clients + proxy, auth email OTP, profile/persona, app shell, onboarding ขั้น 1-2, Supabase local สำหรับทดสอบ end-to-end
- **Files changed**: `src/lib/supabase/{server,client,admin}.ts`, `src/proxy.ts`, `src/lib/{date,format}.ts` (+ tests), `src/core/shared/result.ts`, `src/core/auth/{schema,actions}.ts`, `src/core/profile/{personas,schema,onboarding,queries,actions}.ts` (+ onboarding test), `src/modules/seller/persona.ts`, `src/app/(auth)/{layout.tsx,login/*,onboarding/persona/*}`, `src/app/(app)/{layout.tsx,dashboard,goals,calendar,settings}/page.tsx` (placeholder), `src/app/{layout,page}.tsx`, `src/components/layout/*` (AppShell, BottomNav, Sidebar, TopBar, UserMenu, QuickAddMenu, Fab, PageHeader, OnboardingSteps, QuickAddHost), `src/components/domain/EmptyState.tsx` (+ story), `src/components/ui/*` (shadcn primitives 20 ตัว, button ปรับ touch target ≥44px บนมือถือ, `form-i18n.tsx`), `src/messages/th.json`, `src/types/database.ts` (generate จาก local), `supabase/config.toml` (ปิด studio/realtime/storage/edge/analytics สำหรับ local, email_sent 100), `e2e/{helpers,onboarding.spec}.ts`, `playwright.config.ts`
- **Reason**: เจ้าของโปรเจกต์สั่ง "ทำให้จบ end to end" — ใช้ Supabase local (Docker) + Mailpit เพื่อทดสอบ OTP/RLS จริงโดยไม่ต้องรอบัญชี hosted; ข้อความ error จาก action เป็น key ใน `errors.*` ของ th.json (ห้าม hardcode ไทยใน core)
- **Result**: E2E `onboarding.spec.ts` ผ่านบน mobile-chrome: สมัครด้วย OTP จริง → เลือก seller → ถูกพาไป `/onboarding/first-goal` (สร้างใน M2) · lint/typecheck/23 unit tests ผ่าน · `.env.local` ชี้ local (ไม่ commit) · สิ่งที่รู้: shadcn `sonner` ดึง `next-themes` มาด้วย (ยังไม่ทำ ThemeProvider), `t()` แบบ dynamic key ต้อง cast เป็น union ของ key

## 2026-09-05 (รอบ 5 — Milestone 2: Goals, Cascade Engine, Progress, Onboarding ขั้น 3) — branch `feat/poc`

- **Task**: M2 ตามแผน v2 + POC Decisions 1.1/1.2/1.4 — schema goals/tasks/task_completions/domain_events, cascade engine, progress rollup, หน้าเป้าหมาย (list/detail), onboarding เป้าแรกจาก template ของ seller
- **Files changed**: `supabase/migrations/20260905154811_goals_tasks.sql` (4 ตาราง + RLS + trigger ตรวจ owner ของ parent/goal/task + index), `src/types/database.ts` (regen), `src/core/domain/{domains,periods,progress,recurrence,streak}.ts` (+ tests), `src/core/events/{types,emit}.ts`, `src/core/goals/{schema,queries,actions,candidates}.ts`, `src/core/tasks/schema.ts`, `src/core/profile/actions.ts` (+ `completeOnboarding`), `src/modules/seller/template.ts` (+ test), `src/components/domain/{DomainTag,DomainSelect,ProgressBar,ProgressRing,StatTile,PaceBadge,PeriodLabel,PeriodSwitcher,DatePicker,GoalCard,GoalCascadeTree,GoalForm,UpdateValueForm,Celebration}.tsx` (+ stories GoalCard/Progress/DomainTag), `src/components/ui/responsive-dialog.tsx`, `src/hooks/use-is-mobile.ts`, `src/components/layout/QuickAddHost.tsx` (เปิด GoalForm จาก `?new=goal[&parent=]`), `src/app/(auth)/onboarding/first-goal/{page,first-goal-form,actions,schema}.ts(x)`, `src/app/(app)/goals/{page.tsx,[id]/page.tsx,[id]/goal-detail-actions.tsx}`, `src/app/(app)/layout.tsx` (ส่ง parentCandidates), `src/lib/format.ts` (+ `formatThaiYear`, "บาท" = สกุลเงิน), `src/messages/th.json`, `e2e/{helpers,onboarding.spec,goals.spec}.ts`
- **Reason**: ทำตาม Decision — `goal_kind` metric/execution ห้ามผสม, progress เป็น pure function (`computeProgress` ตาม snippet + `buildProgressIndex` bottom-up), template = เป้าเดือน metric บาท + week execution ที่ทับเดือน + task ตัวอย่าง 1 ตัว/สัปดาห์; ช่วงลูกใช้กฎ overlap; ตาราง `domain_events` ย้ายมา M2 เพื่อ emit `goal.created`/`onboarding.completed` ได้ทันที
- **Result**: E2E ผ่านทั้ง 2 flow บน mobile-chrome (onboarding เต็ม → เห็นเป้าเดือน + 5 week goal → อัปเดตยอด 25,000/50,000 → 50%; สร้างเป้าสุขภาพผ่านปุ่มเพิ่ม → เห็นใน filter ชีวิตส่วนตัว) · unit 43 tests · build ผ่าน · บั๊กที่เจอและแก้: ไฟล์ `"use server"` ห้าม export Zod schema (กลายเป็น server reference), client component ห้าม import จากไฟล์ `server-only` (แยก `candidates.ts`), `FormControl` ต้องครอบ input ตรง ๆ ไม่ใช่ div · ยังไม่ทำ: task ซ้ำใน execution progress (ตัดสินไม่นับ — บันทึกใน progress.ts), seed.sql (E2E สร้างข้อมูลเองผ่าน UI)

## 2026-09-05 (รอบ 6 — Milestone 3: Tasks, Recurring, Completion History, Undo) — branch `feat/poc`

- **Task**: M3 ตามแผน v2 + Decision 1.3 — task CRUD, recurring subset, `task_completions`, ติ๊ก/ยกเลิก, เลื่อนวัน, ลบแบบ undo, goal.completed สำหรับ execution goal
- **Files changed**: `src/core/domain/dayplan.ts` (+ test: ประกอบงานของวัน/ค้าง/เสร็จ และงานของ goal), `src/core/tasks/{schema,queries,actions}.ts`, `src/components/domain/{TaskRow,TaskList,TaskForm}.tsx` (+ TaskRow stories), `src/components/layout/QuickAddHost.tsx` (`?new=task[&goal=&date=]`), `src/app/(app)/goals/[id]/page.tsx` (ใช้ TaskList), `src/messages/th.json` (tasks.*), `e2e/tasks.spec.ts`
- **Reason**: task ซ้ำใช้ `task_completions` ต่อวัน (BKK) ส่วน task เดี่ยวใช้ `completed_at`; occurrence ของ task ซ้ำที่ผ่านไปไม่ถือว่า "ค้าง"; ติ๊กแล้วเช็ค execution goal และแม่ขึ้นไปถึง 100% ครั้งแรก → `completed_at` + `goal.completed` (Design §8.5: undo toast 5 วิ แทน confirm)
- **Result**: E2E 4 flow ผ่านบน mobile-chrome (เพิ่มงานให้ week goal → ติ๊กครบ → toast "ทำได้แล้ว" + 100%; task ซ้ำทุกวัน ติ๊ก/ยกเลิก คงอยู่หลัง reload) · unit 46 · บั๊กที่เจอ: E2E ต้องรอ response ของ server action ก่อน reload (optimistic UI) และ radio ของ Radix ที่ sr-only ต้องคลิกผ่าน label · ยังไม่ทำ: story ของ TaskList (import server action → `server-only` พังใน Storybook — ใช้ TaskRow story แทน), swipe/long-press (Q6 ใช้ Sheet)

## 2026-09-05 (รอบ 7 — Milestone 4: Dashboard คงที่ 2 widget) — branch `feat/poc`

- **Task**: M4 ตาม Decision 3 — dashboard layout คงที่: `GoalProgressWidget` (เป้าหลักเดือนนี้) บนสุด + `TodayTasksWidget` (งานวันนี้ + streak), widget registry ที่ app layer, skeleton, empty state ภายใน widget
- **Files changed**: `src/components/widgets/{WidgetShell,WidgetSkeleton,GoalProgressWidget,GoalProgressPanel,TodayTasksWidget}.tsx` (+ stories WidgetShell/GoalProgressPanel), `src/app/(app)/dashboard/{registry.ts,page.tsx}`, `src/core/tasks/queries.ts` (+ `getStreak`), `src/components/domain/TaskList.stories.tsx`, `.storybook/{main.ts,preview.tsx,mocks/*}` (alias mock `server-only`/`next/cache`/`next/headers`/supabase server + NextIntlClientProvider decorator), `src/messages/th.json` (widgets.*), `e2e/dashboard.spec.ts`
- **Reason**: Design §8.4 — widget แรกบนสุดคือ goal หลักเดือนนี้ (metric ก่อน execution), empty state ภายใน widget พร้อม CTA; registry แยกจาก core เพื่อให้ MVP เติม react-grid-layout/dashboard_layouts จุดเดียว; streak แสดงเพื่อให้ metric §14 ข้อ 2 มองเห็นได้จริง
- **Result**: E2E 5 flow ผ่าน (dashboard: 0% → อัปเดตยอด 50% จาก widget, เพิ่มงานจาก widget แล้วติ๊ก → "ทำต่อเนื่อง 1 วัน") · Storybook build ผ่านรวม story ของ TaskList/GoalProgressPanel ที่ import server action (ผ่าน alias mock) · lint 0 error · ยังไม่วัด bundle ตาม R8 (ไม่มี Recharts แล้ว จะวัดด้วย Lighthouse ใน M7)

## 2026-09-05 (รอบ 8 — Milestone 5: Domain events, Cron, LINE) — branch `feat/poc`

- **Task**: M5 ตาม Decision 2 — ผูก LINE ด้วยรหัส 6 ตัวผ่าน webhook, processor ของ `domain_events`, job สแกนงานเลยกำหนด (1 event/user/วัน), push เฉพาะ overdue + goal สำเร็จ, GitHub Actions cron, หน้าตั้งค่า
- **Files changed**: `src/core/ports/{notifier,ai-suggestion}.ts`, `src/core/profile/{line,line.test,admin,line-actions}.ts`, `src/core/tasks/admin.ts`, `src/core/events/admin.ts`, `src/shared-services/notifications/line/{signature,url,client,notifier,messages}.ts` (+ tests), `src/shared-services/events/{processor,run}.ts` (+ test 5 กรณี), `src/shared-services/jobs/{scan-overdue,run}.ts` (+ test), `src/lib/http/cron-auth.ts`, `src/lib/env.server.ts` (LINE token ว่าง = dry-run), `src/app/api/{cron/process-events,cron/scan-overdue,line/webhook}/route.ts`, `src/app/(app)/settings/{page,display-name-form,line-link-card,notify-switch}.tsx`, `.github/workflows/{cron-events,cron-scan-overdue,keepalive}.yml`, `src/messages/th.json` (settings.*, line.*), `.env.example`, `e2e/line.spec.ts`
- **Reason**: shared-services ห้ามแตะ Supabase ตรง (Decision M0 ข้อ 4) → core เปิด admin repo (`core/{events,profile,tasks}/admin.ts`) และ port `Notifier`; processor/scan job ฉีด dependencies เพื่อ unit test ได้; ไม่มี LINE OA จริง → `DryRunNotifier` log แทนส่งและบันทึก `notification.sent dryRun=true` สลับเป็นของจริงเมื่อใส่ `LINE_CHANNEL_ACCESS_TOKEN`; ทุกลิงก์ใน LINE ต่อ `openExternalBrowser=1` (R3); cron ต้องมี bearer (R7)
- **Result**: E2E 6 flow ผ่าน — flow LINE: ขอรหัสในตั้งค่า → webhook ที่ signature ผิดได้ 401 / ถูกได้ 200 และหน้าตั้งค่าเปลี่ยนเป็น "เชื่อมแล้ว" → สร้าง task ค้างเมื่อวาน → `/api/cron/scan-overdue` สร้าง event → `/api/cron/process-events` ส่ง (dry-run) → ยกเลิกการเชื่อม · unit 58 · ยังไม่ทดสอบกับ LINE จริง (ต้องมี channel ของเจ้าของโปรเจกต์) · workflow cron ข้ามตัวเองถ้าไม่มี secret `CRON_BASE_URL`/`CRON_SECRET` · ไม่มี migration ใหม่ (คอลัมน์ line_*/notify มีตั้งแต่ M0, domain_events ตั้งแต่ M2)

## 2026-09-05 (รอบ 9 — Milestone 6: ปฏิทิน วัน/สัปดาห์/เดือน) — branch `feat/poc`

- **Task**: M6 ตาม Decision 3 — ปฏิทิน 3 มุมมอง (ตัดมุมมองปี) สัปดาห์เริ่มอาทิตย์ task เป็นจุดสี domain + ชื่อ แตะวัน → มุมมองวัน (TaskList เดียวกับแดชบอร์ด)
- **Files changed**: `src/core/domain/calendar.ts` (+ test), `src/components/domain/{CalendarNav,CalendarWeek,CalendarMonth}.tsx` (+ Calendar stories 4 state), `src/app/(app)/calendar/page.tsx`, `src/messages/th.json` (calendar.*), `e2e/calendar.spec.ts`
- **Reason**: ใช้ลิงก์ `?view=&date=` แทน state ฝั่ง client เพื่อให้ SSR/back-forward ทำงานและไม่ต้อง fetch ซ้ำ; เดือนดึงช่วง grid (อาทิตย์แรก–เสาร์สุดท้าย) ครั้งเดียวแล้วกระจาย occurrence ของ task ซ้ำด้วย pure function
- **Result**: E2E ปฏิทินผ่าน (งานที่เพิ่มปรากฏใน สัปดาห์/เดือน/วัน, เลื่อนสัปดาห์และกลับวันนี้) · unit 63 · มือถือ: สัปดาห์เรียงเป็นวัน เดือนเป็น grid จุดสี
