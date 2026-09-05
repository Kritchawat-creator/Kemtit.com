# Kemtit — Implementation Plan (POC) — v2

- **วันที่**: 2026-09-05 (v1 = วิเคราะห์ + แผนเสนอ · v2 = ปรับตาม **POC Decisions 2026-09-05** ดูภาคผนวก A)
- **สถานะ**: หลักการอนุมัติแล้ว — M0 รอยืนยันรายการไฟล์ก่อนสร้าง
- **ลำดับความสำคัญของเอกสารเมื่อขัดกัน**: ภาคผนวก A (POC Decisions) > เอกสารนี้ > `docs/kemtit-full-scope.md` (*Scope*) > `docs/kemtit-ui-design-system.md` (*Design*)
- **ขอบเขต**: POC ตาม Scope §11 หลังรายการตัดใน Decision 3

---

## ส่วนที่ 1 — วิเคราะห์เอกสาร (จาก v1 พร้อมสถานะการตัดสินใจ)

### 1.1 สรุปความเข้าใจ (10 บรรทัด)

1. Kemtit คือ PWA planner ภาษาไทย ที่รวม "เป้าธุรกิจ" กับ "ชีวิตส่วนตัว" ไว้ในระบบเดียว ผ่าน Goal Cascade (ปี → ไตรมาส → เดือน → สัปดาห์ → วัน) และ task เป็นหน่วยปฏิบัติการเล็กสุด ทุก goal/task ติด 1 ใน 6 life domain
2. Stack ตัดสินใจแล้ว: Next.js App Router + TypeScript บน Netlify, Supabase (Postgres + RLS, Auth email OTP, Storage), Zod validate ทุก input, Tailwind CSS v4 + shadcn/ui, next-intl (`messages/th.json`), Serwist สำหรับ PWA
3. Architecture = modular monolith: `core/` (goals, tasks, shared kernel) / `modules/*` (persona ละหนึ่ง module) / shared services (notifications, billing) — `modules/*` ห้าม import กันเอง คุยผ่าน `core/ports` หรือ `domain_events` เท่านั้น
4. Side effect (LINE, billing) ไม่ทำใน request หลัก แต่เขียนแถวลง `domain_events` แล้วให้ cron (GitHub Actions → Route Handler) มาประมวลผลเป็น batch เล็ก ๆ แล้ว mark `processed_at`
5. Dashboard = widget registry กลาง + layout ต่อ user (react-grid-layout บน desktop, stack แนวตั้งบนมือถือ) — POC ใช้ layout คงที่ 2 widget
6. Persona แรก (beachhead) = Seller — ใน POC เหลือ template เป้ายอดขายรายเดือน (metric goal) + week goal ลูก; widget/ตารางเฉพาะ seller เลื่อนไป MVP
7. UX หลัก: mobile-first บังคับ, bottom nav 4 แท็บ + FAB, onboarding 3 ขั้นจบใน 90 วินาที (OTP → เลือก persona → goal แรกจาก template), ทุกการลบใช้ undo toast ไม่ใช่ confirm
8. Design system: brand lavender + semantic token (component ห้ามใช้ hex ดิบ), IBM Plex Sans Thai line-height ≥1.7, radius ใหญ่กว่าปกติ, เงาสี brand, motion เฉพาะตอบสนอง user, ข้อความทั้งหมดผ่าน i18n, ตัวเลขผ่าน formatter, DoD 9 ข้อต่อ component
9. Admin ใน POC/MVP = Supabase Studio; วัดผล POC ด้วย 3 metric (สร้าง goal แรกได้เองใน session แรก, ทำ task ต่อเนื่อง 7 วัน, อธิบายความต่างจาก Notion/Griply ได้) — ทุกการตัดสินใจตัด scope ยึด 3 ข้อนี้
10. ตั้งใจไม่ทำ: AI (เปิด port `core/ports/ai-suggestion.ts` ไว้แต่ไม่ implement), native app, LINE Login, admin UI, หลายภาษา, dark mode UI จริง, drag-drop, custom theme, mascot/gradient/glassmorphism

### 1.2 คำถามจาก v1 และสถานะ

สถานะ: **✅ ตัดสินแล้ว** (อ้าง Decision ในภาคผนวก A) · **🟡 ยังเปิด — ใช้ข้อแนะนำเป็นสมมติฐาน** (แจ้งแล้ว ถ้าไม่ทักถือว่ายอมรับ)

| # | คำถาม | สถานะ / ผลลัพธ์ |
|---|---|---|
| Q1 | "fixed layout" หมายถึงอะไร | ✅ D3: คงที่จริง ไม่มีย้าย/เพิ่ม/ลบ, ไม่มี `WidgetPicker`, ไม่มีตาราง `dashboard_layouts` ใน POC; Design §8.4 ติดป้าย MVP แล้ว |
| Q2 | widget ชุดไหนใน POC | ✅ D3: 2 widget — `GoalProgressWidget` (goal หลักเดือนนี้) + `TodayTasksWidget`; ตัด `ShopChecklistWidget`, `DailyLifeWidget` และ (โดยนัย) `SalesVsGoalWidget` — ยอดขายแสดง/อัปเดตผ่าน `GoalProgressWidget` ในฐานะ metric goal |
| Q3 | ปฏิทินใน POC | ✅ D3: **วัน/สัปดาห์/เดือน** (ตัดเฉพาะมุมมองปี) — มากกว่าที่ v1 แนะนำ (สัปดาห์เท่านั้น) กระทบเวลา +1.5-2 วัน ดู §2.7 |
| Q4 | recurring + ประวัติเสร็จ | ✅ D1.3: ตาราง `task_completions` ตาม schema ในภาคผนวก; recurring ใช้ `task_completions` เท่านั้น, task เดี่ยวใช้ `tasks.completed_at`; UI recurrence = ทุกวัน / ทุกสัปดาห์ (เลือกวัน) เก็บเป็น RRULE subset (🟡 ส่วน subset เป็นสมมติฐาน) |
| Q5 | offline write queue | ✅ D3: ตัด — banner อ่านอย่างเดียว |
| Q6 | swipe / long-press | 🟡 ไม่ได้ระบุใน Decision — ใช้ "แตะแถว → Sheet มีปุ่ม ติ๊ก/เลื่อนวัน/ลบ" swipe เป็น polish ถ้าเหลือเวลา |
| Q7 | persona picker ตอนมี persona เดียว | 🟡 ไม่ได้ระบุ — โชว์ 4 card, seller เท่านั้นที่กดได้, log `persona.viewed` |
| Q8 | กฎ progress | ✅ D1.1-1.2: คอลัมน์ `goal_kind` (`metric`/`execution`), metric ไม่นับ task, execution = ค่าเฉลี่ยของ child goal แต่ละตัว + อัตราส่วน task ตรงทั้งก้อน (น้ำหนักเท่ากัน), pure function `core/domain/progress.ts` ไม่ใช้ trigger; 🟡 "ตกเป้า" (สี warning) = % จริง < % เวลาที่ผ่านไป − 10 จุด เป็นสมมติฐาน; 🟡 `goal.completed` ยิงครั้งเดียวเมื่อถึง 100 ครั้งแรก ไม่ reopen |
| Q9 | ระดับ cascade + auto cascade | ✅ D1.4: onboarding = metric goal ระดับเดือน + week goal ลูก (execution) 4-5 ตัว + task ตัวอย่าง 1 ตัว/สัปดาห์; ไม่สร้าง year goal; Scope §7 Flow A แก้แล้ว; 🟡 quarter/day ยังอยู่ใน enum แต่ไม่โชว์ใน form (สมมติฐาน) |
| Q10 | ตารางยอดขายรายวัน | ✅ (โดยนัยจาก D1.1 "current_value ที่ user กรอกเอง" + D3) **ไม่มี** `seller_sales_entries` ใน POC — ไม่มีประวัติยอดขายรายวัน/กราฟแท่ง; CSV import (Phase 2) จะต้องเพิ่มตารางตอนนั้น |
| Q11 | LINE ส่งอะไร | ✅ D2.2: ตัด daily digest; push เฉพาะ (a) task เลยกำหนด ≤ 1 ข้อความ/user/วัน รวมทุก task (b) goal สำเร็จ 100% ทันที; 🟡 เวลาสแกน overdue = 08:00 Asia/Bangkok (สมมติฐาน) |
| Q12 | ผูก LINE | ✅ D2.1: รหัส 6 ตัว หมดอายุ 10 นาที ใน `user_profiles.line_link_code` → webhook → reply ยืนยัน |
| Q13 | cron | ✅ D2.3: GitHub Actions `*/5 * * * *`; pg_cron + pg_net เป็น fallback ที่อนุมัติล่วงหน้า (สลับได้ไม่ต้องถาม ถ้าดีเลย์ > 15 นาทีบ่อย) |
| Q14 | token shadcn vs semantic | 🟡 ไม่ได้ระบุ — map alias ของ shadcn → semantic token ใน `globals.css` จุดเดียว, lint ห้าม hex |
| Q15 | Storybook ทุก component + Lighthouse CI | 🟡 ไม่ได้ระบุ — story บังคับเฉพาะ `components/domain` + `components/widgets`; Lighthouse รันมือท้าย milestone (ประมาณการใน §2.7 ตั้งบนสมมติฐานนี้) |
| Q16 | พ.ศ. / ค.ศ. | 🟡 ไม่ได้ระบุ — พ.ศ. เป็น default ไม่มี toggle ใน POC |
| Q17-19 | เล็ก | 🟡 ชื่อ goal ไม่ unique · เหลือ < 7 วันในเดือน template เสนอ "เดือนหน้า" · ยึด Design เมื่อรายการ primitives ต่างกัน |

**ข้อสังเกตที่ควรรู้จาก Decision** (ไม่บล็อก แต่ระบุไว้ให้ชัด)
- D1.3 นิยาม streak จาก `task_completions` เท่านั้น → คนที่ทำแต่ task เดี่ยวจะได้ streak 0 — ผมจะให้ SQL metric นับรวม `date(tasks.completed_at at time zone 'Asia/Bangkok')` ด้วย (ระดับ query ไม่แตะ schema) ถ้าไม่ต้องการบอกได้
- D1.4 week goal ที่คร่อมขอบเดือน (`period_start` เป็นวันอาทิตย์ของเดือนก่อน) → กฎ Zod "ลูกอยู่ใน period แม่" ต้องเป็น **overlap** ไม่ใช่ containment
- D1.4 "task ตัวอย่าง 1 ตัวต่อสัปดาห์" — ข้อความ template จะเสนอให้ดูตอน M2 ก่อนสร้าง
- D3 ตัด `ShopChecklistWidget` → template **ไม่** seed task ประจำร้าน user สร้าง recurring task เองได้
- D3 "เลือก domain ตอนสร้าง task" — goal ก็มี `domain` ใน schema จึงมี `DomainSelect` ตัวเดียวกันใน `GoalForm` ด้วย (default งาน)

### 1.3 ความเสี่ยงทางเทคนิคที่เอกสารเดิมไม่ได้พูดถึง (ปรับตาม Decision)

| # | ความเสี่ยง | ผลกระทบ | การรับมือในแผน |
|---|---|---|---|
| R1 | **LINE push quota แผนฟรี ~300 ข้อความ/เดือน** (เช็คตัวเลขจริงใน OA Manager) | หลังตัด digest: 10 tester × ~15 push ≈ 150/เดือน — ครึ่งโควตา; เกินเมื่อไหร่จ่าย Basic 1,280 บาท (D2.2, Scope §13 แก้แล้ว) | overdue รวมเป็น 1 ข้อความ/วัน/คน · reply ผ่าน webhook ฟรี · นับ push ที่ส่งใน `domain_events` เพื่อดูโควตาใน Studio |
| R2 | **Supabase default SMTP เป็น dev-only** จำกัดไม่กี่ฉบับ/ชม. อาจส่งได้เฉพาะสมาชิกทีม | OTP พังตั้งแต่ tester คนที่ 2-3 | **M0 ข้อบังคับ**: Resend custom SMTP + verify domain ก่อนหน้า login (Decision "ความเสี่ยง M0" ข้อ 1) |
| R3 | **LINE in-app browser** cookie แยกจาก browser หลัก | ขอ OTP ใหม่ทุกครั้ง, ติดตั้ง PWA ไม่ได้ | ทุกลิงก์จาก LINE ต่อ `?openExternalBrowser=1` (Decision "ความเสี่ยง M0" ข้อ 2) — helper เดียว `lineUrl()` ห้ามประกอบ URL เอง |
| R4 | **Netlify Function timeout 10 วิ** + cold start | cron timeout; LCP | batch ≤ 20 event/รอบ, overdue scan แบ่ง batch ≤ 25 user, ตัวเลขบน widget บนสุดเป็น Server Component |
| R5 | **Serwist + Turbopack** (Next 16) | PWA build พัง M7 | ทดสอบ `next build --webpack` หรือ `@serwist/build` แยก step ตั้งแต่ M0; ถ้าติด POC = manifest + ติดตั้งได้ |
| R6 | **Timezone UTC vs Asia/Bangkok** | วันนี้/ค้าง/streak/overdue คลาดวัน | `lib/date.ts` จุดเดียว (`todayBkk`, `toBkkDate`, ขอบ period, สัปดาห์เริ่มอาทิตย์) + unit test ช่วงเที่ยงคืน; `task_completions.completed_on` เป็นวัน BKK |
| R7 | **Security ที่เอกสารไม่ระบุ** | endpoint สาธารณะ | cron = bearer `CRON_SECRET`; webhook verify `X-Line-Signature`; `service_role` เฉพาะ `lib/supabase/admin.ts`; RLS `domain_events` insert ของตัวเอง อ่าน/แก้ service role |
| R8 | **Bundle 200KB gz** | หน้า dashboard เกิน | POC ไม่มีกราฟ → **ไม่ติดตั้ง Recharts ใน POC** (ยังเป็น chart lib ที่เลือกไว้สำหรับ MVP); Motion import เฉพาะ celebration; วัดด้วย bundle analyzer ท้าย M4 |
| R9 | **Supabase free tier** pause 7 วัน, 2 project, ไม่มี branching | dev/staging ต้องแยก | 2 project ตั้งแต่ M0 (Decision "ความเสี่ยง M0" ข้อ 3); migration ผ่าน CLI เท่านั้น |
| R10 | **GitHub Actions cron** latency/60 วัน | ดู Q13 | `workflow_dispatch` + keepalive; pg_cron fallback อนุมัติแล้ว |
| R11 | **iOS PWA** ไม่มี install prompt | tester iPhone ติดตั้งไม่เป็น | หน้าคำแนะนำสั้นใน M7 |
| R12 | **E2E ต้องอ่าน OTP** | Playwright เข้าถึงอีเมลไม่ได้ | `auth.admin.generateLink` ใน test setup; ห้าม bypass ใน build production |
| R13 | **Metric §14 ไม่มี instrumentation** | วัดผลไม่ได้ | `domain_events` เป็น event log (`onboarding.completed`, `goal.created`, `task.completed`, `goal.completed`, `line.linked`, `persona.viewed`, `notification.sent`) + `supabase/queries/poc-metrics.sql` |
| R14 | **PDPA** | กฎหมาย | ข้อความยินยอม 1 บรรทัดหน้า login + หน้านโยบาย static (ดู "ข้อเสนอนอก scope") |
| R15 | **Node 26 ในเครื่อง vs Netlify** | build ต่างกัน | `.nvmrc` = 22 + `engines` + Netlify `NODE_VERSION=22` |
| R16 | **Overdue เป็น time-based ไม่ใช่ user action** | ต้องมี job สแกนรายวันแม้ตัด digest | route `/api/cron/scan-overdue` ยิงวันละครั้ง → emit `task.overdue` 1 event/user → processor push; idempotent ด้วย `user_profiles.last_overdue_notified_on` |

---

## ส่วนที่ 2 — แผนดำเนินการ POC (v2)

### 2.1 ขอบเขต POC หลัง Decision

**อยู่ใน POC**: Auth email+OTP · onboarding 3 ขั้น (OTP → persona → metric goal เดือนนี้ + week goal อัตโนมัติ) · goals CRUD + cascade tree (ปี/เดือน/สัปดาห์) + progress ตาม `goal_kind` · tasks CRUD + recurring (ทุกวัน/ทุกสัปดาห์) + `task_completions` + complete/undo + เลื่อนวัน · domain 6 ตัว (เลือกตอนสร้าง goal/task + filter งาน/ชีวิต) · dashboard คงที่ 2 widget · `domain_events` + cron 5 นาที + LINE (เชื่อมบัญชี, push overdue 1/วัน, push goal สำเร็จ) · ปฏิทิน วัน/สัปดาห์/เดือน · ตั้งค่า (ชื่อ, LINE, เปิด/ปิดแจ้งเตือน, ออกจากระบบ) · PWA ติดตั้งได้ + banner offline อ่านอย่างเดียว · ภาษาไทยผ่าน i18n · Admin = Supabase Studio

**ไม่อยู่ใน POC**: billing · drag-drop/`WidgetPicker`/`dashboard_layouts` · widget เฉพาะ seller (`SalesVsGoal`, `ShopChecklist`) และตารางยอดขายรายวัน · `DailyLifeWidget` · daily digest · ปฏิทินปี · offline write queue · swipe/long-press · dark mode · LINE Login · admin UI · AI · Recharts/react-grid-layout (ยังไม่ติดตั้ง)

### 2.2 สิ่งที่ต้องตั้งค่าก่อนเขียนโค้ดบรรทัดแรก (Milestone 0)

**สถานะเครื่อง**: Node v26.8.1 (ต้องเพิ่ม 22 LTS) · Docker ✅ · git + remote GitHub ✅ · ยังไม่มี pnpm, supabase CLI, netlify CLI, gh

**A. บัญชี/บริการ — คุณทำเอง (ผมทำแทนไม่ได้ และห้ามวาง secret ในแชท ให้ใส่ `.env.local` โดยตรง)**

| บริการ | ต้องทำ | ได้อะไร |
|---|---|---|
| Supabase | org + **2 project**: `kemtit-dev`, `kemtit-staging` (region Singapore) · Auth → Email เปิด · OTP 6 หลัก หมดอายุ 600 วิ · template "Magic Link" ใส่ `{{ .Token }}` ภาษาไทย · Site URL/Redirect · **Custom SMTP → Resend** (ทำก่อน M1) | URL, anon/publishable key, service_role/secret key, project ref ×2 |
| Resend (หรือ Brevo) | เพิ่ม domain `kemtit.com` · DNS SPF/DKIM · SMTP credential | ผู้ส่ง `no-reply@kemtit.com` |
| DNS `kemtit.com` | record ของ Resend (ตอนนี้) + Netlify custom domain (ตอน staging) | — |
| Netlify | import repo · build `pnpm build` · `NODE_VERSION=22` · env แยก production/deploy-preview | site URL |
| LINE Developers | Provider "Kemtit" → Messaging API channel · long-lived channel access token · channel secret · OA Manager: ปิด auto-reply/greeting (หรือ greeting = วิธีเชื่อมบัญชี) · เปิด webhook (URL ใส่ตอน M5) · Basic ID + QR · เช็คโควตาแผน | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, Basic ID |
| GitHub | Actions เปิด · Secrets `CRON_SECRET`, `CRON_BASE_URL` (ใช้ M5) | — |
| (ทางเลือก) Sentry | project ฟรี | `SENTRY_DSN` |

**B. CLI**: `brew install nvm pnpm supabase/tap/supabase netlify-cli gh` → `nvm install 22 && nvm use 22` → `gh auth login`, `netlify login`, `supabase login`

**C. Environment variables** (`.env.local` ไม่ commit · `.env.example` commit)

| ตัวแปร | ฝั่ง | ใช้ที่ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | Supabase client ทุกตัว |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (หรือ publishable key) | client+server | client ที่ผ่าน RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | `lib/supabase/admin.ts` — cron + webhook เท่านั้น |
| `NEXT_PUBLIC_SITE_URL` | client+server | ลิงก์ในอีเมล/LINE, redirect |
| `CRON_SECRET` | server | bearer ของ `/api/cron/*` |
| `LINE_CHANNEL_SECRET` | server | verify webhook |
| `LINE_CHANNEL_ACCESS_TOKEN` | server | push/reply |
| `NEXT_PUBLIC_LINE_OA_BASIC_ID` | client | ปุ่ม/QR เพิ่มเพื่อน |
| `SENTRY_DSN` (ทางเลือก) | ทั้งคู่ | error monitoring |

**D. Repo scaffold + tooling** (งานผม — รายการไฟล์อยู่ท้ายเอกสารนี้ รอยืนยัน)
- `create-next-app` (TypeScript, Tailwind v4, App Router, `src/`, ESLint) ปักหมุด Next 16 + React 19; scaffold ใน temp แล้วย้ายเข้า root เพื่อไม่ทับ `README.md`/`CLAUDE.md`/`docs/`
- Dependencies POC: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`, `next-intl`, `date-fns`, `date-fns-tz`, `lucide-react`, `sonner`, `motion` (celebration เท่านั้น), `@serwist/next` (M7) — **ไม่ติดตั้ง** `recharts`, `react-grid-layout`
- `shadcn init` (Tailwind v4) + map alias → semantic token ใน `src/styles/globals.css`
- Tooling: Prettier + `prettier-plugin-tailwindcss` · ESLint + `jsx-a11y` + `eslint-plugin-boundaries` (`modules/*` ห้าม import `modules/*` อื่น; `core/**` ห้าม import `modules/**`, `services/**`; `app/**` เป็น composition root) · Vitest + RTL · Storybook (react-vite) · Playwright config (ใช้จริง M7)
- `supabase init` + `supabase link` (dev) · migration `0001_user_profiles.sql`
- GitHub Actions `ci.yml`: lint + typecheck + vitest ทุก PR
- ทดสอบ R5 (Serwist/Turbopack) ตั้งแต่ตอนนี้

**E. Migration แรก — `0001_user_profiles.sql`**
- `user_profiles` ตาม Scope §6 + `updated_at`, `onboarding_completed_at`, `line_linked_at`, `line_link_code text unique`, `line_link_code_expires_at timestamptz`, `notify_overdue boolean default true`, `last_overdue_notified_on date`
- trigger `handle_new_user` บน `auth.users` insert → สร้าง profile
- RLS: `select`/`update` เฉพาะ `auth.uid() = id` และ `update` ห้ามแก้ `line_user_id`/`line_link_code` จาก client (ให้ผ่าน server action ที่ใช้ admin client เท่านั้น — ใช้ column-level grant หรือ trigger กัน)
- ทดสอบ: สมัครใน Studio → มีแถว profile; user A อ่านของ B ไม่ได้

**นิยาม "M0 เสร็จ"**: `pnpm dev` เปิดหน้า placeholder ไทยด้วย IBM Plex Sans Thai · Storybook เปิดได้ · `supabase db push` ผ่านบน dev · Netlify deploy preview ขึ้น · OTP ทดสอบผ่าน Resend ถึงอีเมลนอกทีม · `pnpm build` ผ่านพร้อมคำตอบเรื่อง Serwist

### 2.3 โครงสร้างโฟลเดอร์ (รวม Scope §4 + Design §14 + path จาก Decision 1.2)

```
src/
  app/                          # routes เท่านั้น — composition root
    (auth)/login, (auth)/onboarding/{persona,first-goal}
    (app)/dashboard, (app)/goals, (app)/goals/[id], (app)/calendar, (app)/settings
    (app)/dashboard/registry.ts # widget registry (จุดเดียวที่รู้จักทั้ง core และ modules)
    api/cron/{process-events,scan-overdue}/route.ts
    api/line/webhook/route.ts
    manifest.ts, sw.ts
  core/                         # shared kernel — ห้าม import modules/ และ services/
    domain/   {progress.ts, periods.ts, recurrence.ts, streak.ts}   # pure function ไม่แตะ DB (Decision 1.2)
    goals/    {schema.ts, actions.ts, queries.ts}
    tasks/    {schema.ts, actions.ts, queries.ts}
    profile/  {schema.ts, actions.ts, queries.ts}
    events/   {emit.ts, types.ts}
    ports/    {ai-suggestion.ts, notifier.ts}                        # interface เท่านั้น
  modules/
    seller/   {persona.ts, template.ts}      # POC: template onboarding เท่านั้น ไม่มี widget/ตารางเฉพาะ
  services/
    notifications/line/ {client.ts, signature.ts, messages.ts, url.ts}
    events/   {processor.ts, handlers/{goal-completed.ts, task-overdue.ts}}
    jobs/     {scan-overdue.ts}
  components/
    ui/        # shadcn primitives
    domain/    # GoalCard, GoalCascadeTree, ProgressRing, ProgressBar, TaskRow, TaskList, DomainTag,
               # DomainSelect, PeriodSwitcher, DatePicker, EmptyState, StatTile
    widgets/   # WidgetShell, GoalProgressWidget, TodayTasksWidget
    layout/    # AppShell, BottomNav, Sidebar, TopBar, Fab, PageHeader
  lib/         {utils.ts, format.ts, date.ts, supabase/{server,client,admin,proxy}.ts}
  i18n/        {request.ts}
  messages/th.json
  styles/globals.css
supabase/  {config.toml, migrations/, seed.sql, queries/poc-metrics.sql}
.github/workflows/ {ci.yml, cron-events.yml, cron-scan-overdue.yml, keepalive.yml}
```

### 2.4 Work breakdown — Milestones

#### M1 — Foundation: token, app shell, auth OTP, onboarding ขั้น 1-2
- **Migration**: `0001` จาก M0
- **งาน**: `globals.css` ครบ (palette, semantic token + โครง dark, radius, shadow, type scale, reduced-motion, alias shadcn) · ฟอนต์ · shadcn primitives (Button, Input, Label, Checkbox, Badge, Skeleton, Dialog, Sheet, Select, Switch, Tabs, Tooltip, Popover, DropdownMenu, Sonner) · `th.json` + next-intl · `lib/format.ts` (`formatTHB`, `formatPercent`, `formatThaiDate` พ.ศ., `formatRelative`) + `lib/date.ts` พร้อม unit test · `lib/supabase/*` + `proxy.ts` + route guard · หน้า login (OTP auto-submit, error inline, ข้อความยินยอม 1 บรรทัด) · onboarding ขั้น 2 (4 card, seller เท่านั้น) · AppShell (BottomNav 4 แท็บ, Sidebar/TopBar desktop, FAB ยังไม่ทำงาน, placeholder ทุกแท็บ) · Storybook token + primitives
- **รันแล้วเห็นผล**: สมัครอีเมลจริง → OTP → เลือก seller → dashboard ว่างพร้อม nav บน Netlify preview; refresh แล้ว session อยู่
- **ทดสอบ**: unit format/date; มือบน iPhone Safari + Android Chrome

#### M2 — Goals: schema, cascade, progress, หน้าเป้าหมาย, onboarding ขั้น 3
- **Migration `0002_goals_tasks.sql`**: `goals` ตาม Scope §6 + `goal_kind` (Decision 1.1) + `completed_at`, `updated_at`, `status` check (`active|completed|archived`) · `tasks` ตาม §6 + `updated_at` · `task_completions` ตาม Decision 1.3 ตรงตัว · index (`user_id, period_type, period_start`), (`user_id, due_date`), (`parent_id`), (`goal_id`) · RLS ทุกตาราง `auth.uid() = user_id`
- **งาน**: `core/goals/schema.ts` (Zod; metric ต้องมี `target_value > 0`; ลูก **overlap** period แม่) · `core/domain/periods.ts` (ขอบ period, เสนอช่วงลูก, week ที่ทับเดือน — สัปดาห์เริ่มอาทิตย์) · `core/domain/progress.ts` = `computeProgress` ตาม Decision 1.2 + `isBehindPace` · server actions create/update/archive/`updateCurrentValue` + queries tree/list · components + story: `DomainTag`, `DomainSelect`, `ProgressBar`, `ProgressRing`, `StatTile`, `EmptyState`, `PeriodSwitcher`, `DatePicker` (พ.ศ.), `GoalCard`, `GoalCascadeTree` (3 ระดับ), `GoalForm` (Sheet/Dialog) · หน้า `/goals` (filter งาน/ชีวิต, กลุ่มตาม period, สี warning) + `/goals/[id]` (hero % + tree + ปุ่ม "อัปเดตยอด" สำหรับ metric + ส่วน task ว่างไว้) · `modules/seller/template.ts` + onboarding ขั้น 3 (Decision 1.4: เป้าเดือน metric → week execution 4-5 + task ตัวอย่าง 1/สัปดาห์ — **ข้อความ template จะเสนอให้ดูก่อนสร้าง**) · `onboarding_completed_at` + emit `onboarding.completed`, `goal.created` · `supabase/seed.sql`
- **รันแล้วเห็นผล**: onboarding 3 ขั้นจบ เห็นเป้าเดือน + week goal ใน tree; อัปเดตยอดแล้ว % และสี warning เปลี่ยน; สร้าง goal ชีวิต (execution) ได้
- **ทดสอบ**: unit periods/progress ≥ 90% coverage; RLS test ผ่าน SQL

#### M3 — Tasks: CRUD, recurring, `task_completions`, undo, goal.completed
- **Migration**: ไม่มีใหม่
- **งาน**: `core/tasks/schema.ts` · `core/domain/recurrence.ts` (parse/expand `FREQ=DAILY|WEEKLY;BYDAY`) · queries `getTasksForDate`/`getTodayTasks` (เดี่ยววันนี้ + ค้าง + occurrence recurring วันนี้ พร้อมสถานะจาก `task_completions`) · actions create/update/delete/`toggleComplete(taskId, date)` (เดี่ยว → `completed_at`; recurring → insert/delete `task_completions`)/`reschedule` · หลัง toggle: progress ของ goal แม่ (execution) → ถึง 100 ครั้งแรก → `completed_at`, status, emit `goal.completed`; emit `task.completed` ทุกครั้ง · components + story: `TaskRow` (150ms), `TaskList` (ค้าง/วันนี้/เสร็จ), `TaskForm` (ชื่อช่องเดียวก็บันทึกได้; due, domain, recurring, ผูก goal), Sheet รายละเอียด (ติ๊ก/เลื่อนวัน/ลบ) · ลบ = เอาออกจาก UI + undo toast 5 วิ แล้วยิง delete · goal detail แสดง task ผูก · FAB ทำงานจริง · celebration ครั้งเดียว 800ms (ปิดเมื่อ reduced-motion) · `core/domain/streak.ts`
- **รันแล้วเห็นผล**: recurring ทุกวัน ติ๊กวันนี้ พรุ่งนี้กลับมาว่าง แต่ประวัติเมื่อวานอยู่; ติ๊ก task ครบ → week goal 100 + confetti + แถวใน `domain_events`
- **ทดสอบ**: unit recurrence (ข้ามเดือน, สัปดาห์เริ่มอาทิตย์); TaskRow keyboard (Space)

#### M4 — Dashboard คงที่ 2 widget → CP1
- **Migration**: ไม่มี
- **งาน**: `WidgetShell` (หัว + slot handle/menu ที่ยังไม่ render) · `GoalProgressWidget` (goal หลักเดือนนี้: % display 36px, metric → ยอดจริง/เป้า บาท + "อีก X บาท" + ปุ่ม "อัปเดตยอด" Sheet; execution → task เสร็จ/ทั้งหมด; ด้านล่าง goal เดือนนี้ตัวอื่นแบบย่อ; empty → CTA) · `TodayTasksWidget` (ค้าง + วันนี้ รวม recurring, ติ๊กในที่, CTA เพิ่มงาน) · registry `app/(app)/dashboard/registry.ts` + layout คงที่ (มือถือ stack, desktop 2 คอลัมน์ CSS grid) · Skeleton รูปทรงเดียวกับ widget · bundle analyzer + Lighthouse มือรอบแรก
- **รันแล้วเห็นผล**: เปิดแอปเห็นใน 3 วินาที — % เป้าเดือนนี้ + งานวันนี้; อัปเดตยอด/ติ๊กแล้ว widget ทั้งสองขยับ
- **จากนั้น**: CP1 (§2.6)

#### M5 — Domain events, cron, LINE (เชื่อมบัญชี, overdue, goal สำเร็จ)
- **Migration `0003_domain_events.sql`**: `domain_events` ตาม Scope §6 + `attempts int default 0`, `last_error text`, partial index `where processed_at is null`; RLS insert ของตัวเอง เท่านั้น
- **งาน**: `services/notifications/line` (`pushText`, `replyText`, `verifySignature`, `lineUrl()` ต่อ `openExternalBrowser=1`, ข้อความจาก `th.json` ไม่มี emoji) · `POST /api/line/webhook` (signature → รหัส 6 ตัว → จับคู่ → `line_user_id`, `line_linked_at`, ล้าง code, emit `line.linked` → reply; `unfollow` → ล้าง) · การ์ด "เชื่อม LINE" ในตั้งค่า (สร้างรหัส 10 นาที, QR/ปุ่ม, poll 3 วิ, ยกเลิก) · `POST /api/cron/process-events` (bearer, admin client, ≤ 20 แถว, handler ต่อ type, `processed_at` / `attempts+1` + `last_error`, หยุดที่ 5) · handler `goal.completed` → push · `POST /api/cron/scan-overdue` (Decision 2.2/R16: user ที่เชื่อม LINE + `notify_overdue` + `last_overdue_notified_on < วันนี้ BKK` + มี task ค้าง → emit `task.overdue` 1 event/user พร้อมรายการ → set วันที่; batch ≤ 25) · handler `task.overdue` → push 1 ข้อความรวม · emit `notification.sent` ทุกครั้งที่ push (นับโควตา) · GitHub Actions: `cron-events.yml` (`*/5 * * * *` + `workflow_dispatch`), `cron-scan-overdue.yml` (`0 1 * * *` UTC = 08:00 BKK + dispatch), `keepalive.yml` (commit ทุก 30 วัน) · dev ท้องถิ่น: `netlify dev --live`/cloudflared สำหรับ webhook
- **รันแล้วเห็นผล**: เชื่อม LINE < 1 นาที; goal สำเร็จ → LINE ภายใน ~5-15 นาที; เช้ามี task ค้าง → ได้ 1 ข้อความ; กดลิงก์เปิด browser หลักไม่ต้อง OTP ใหม่
- **ทดสอบ**: unit signature/messages; `workflow_dispatch` มือ; ดู `domain_events` ใน Studio

#### M6 — ปฏิทิน วัน / สัปดาห์ / เดือน (Decision 3)
- **Migration**: ไม่มี
- **งาน**: `PeriodSwitcher` (วัน/สัปดาห์/เดือน) · มุมมองวัน = `TaskList` ของวันที่เลือก + ก่อนหน้า/ถัดไป/วันนี้ · มุมมองสัปดาห์ 7 คอลัมน์เริ่มอาทิตย์ task เป็นจุดสี domain + label · มุมมองเดือน grid 6×7 + จำนวน/จุด domain ต่อวัน แตะวัน → มุมมองวัน · query ช่วงวันที่รวม recurring occurrence · story 3 state ต่อมุมมอง
- **รันแล้วเห็นผล**: เห็นวันไหนแน่น/ว่างในเดือน, เลื่อนสัปดาห์แล้ว recurring ปรากฏถูกวัน

#### M7 — ตั้งค่า, PWA, DoD sweep, E2E, metrics, staging → CP2
- **Migration**: ไม่มี (เว้นแต่ CP1 บังคับ)
- **งาน**: ตั้งค่า (ชื่อ, การ์ด LINE, toggle `notify_overdue`, ออกจากระบบ; ซ่อน persona/subscription/ธีม) · PWA (`manifest.ts`, icons, Serwist precache static shell เท่านั้น, banner offline อ่านอย่างเดียว, คำแนะนำติดตั้ง iOS) · DoD sweep (grep hex, keyboard/focus, loading/empty/error, contrast คู่ใหม่, i18n, formatter, reduced-motion, story ตาม Q15) · Playwright 3 flow (onboarding ผ่าน `generateLink`, สร้าง goal, ติ๊ก task) · Lighthouse มือถือ 4G · `poc-metrics.sql` (goal แรกใน session แรก, streak 7 วัน รวม 2 แหล่ง, อัตราเชื่อม LINE, push ต่อเดือน) · `kemtit-staging` + `db push` + Netlify production env + custom domain
- **รันแล้วเห็นผล**: build ผ่าน CI, ติดตั้งบน Android/iOS, E2E เขียว, Lighthouse ผ่าน → ปล่อย tester CP2

### 2.5 ลำดับการสร้าง component

| ลำดับ | สร้าง | เพราะ |
|---|---|---|
| 0 | `globals.css` token → ฟอนต์ → alias shadcn | ทุกอย่างอ้าง token |
| 1 | shadcn primitives | domain component ประกอบจากชุดนี้ |
| 2 | `lib/format.ts`, `lib/date.ts`, `core/domain/{periods,progress}.ts` | UI แสดงตัวเลข/วัน/% ผ่านนี้เท่านั้น |
| 3 | `DomainTag`, `DomainSelect`, `ProgressBar`, `ProgressRing`, `StatTile`, `EmptyState` | leaf ไม่พึ่งข้อมูล |
| 4 | `AppShell`, `BottomNav`, `Sidebar`, `TopBar`, `Fab`, `PageHeader` | ทุกหน้าอยู่ในกรอบนี้ |
| 5 | `DatePicker` (พ.ศ.), `PeriodSwitcher` | form/ปฏิทินพึ่งพา |
| 6 | `GoalForm` → `GoalCard` → `GoalCascadeTree` | tree ประกอบจาก card |
| 7 | `TaskForm` → `TaskRow` → `TaskList` | list ประกอบจาก row; form เลือก goal |
| 8 | `WidgetShell` → `GoalProgressWidget`, `TodayTasksWidget` | ห่อด้วย shell ประกอบจาก 6-7 |
| 9 | Dashboard + registry → ปฏิทิน 3 มุมมอง → การ์ด LINE | ประกอบทุกชั้น |

### 2.6 จุดหยุดทดสอบกับ user จริง

| จุด | เมื่อไหร่ | ทำอะไร | ตัดสินอะไร |
|---|---|---|---|
| **CP0** | ระหว่าง M1 (1-2 ชม.) | แม่ค้า 3 คนดู mock onboarding ขั้น 3 + dashboard | copy "เป้ายอดขาย", ข้อความ task ตัวอย่างใน template, รูปแบบ % |
| **CP1** | หลัง M4 (1 สัปดาห์รวมแก้) | moderated 5-6 คน × 30 นาที ไม่มี LINE: สมัคร → เป้า → อัปเดตยอด → ติ๊ก task → สร้าง goal ชีวิต 1 ข้อ | metric §14 ข้อ 1; เข้าใจ week goal ไหม; อัปเดตยอดทุกวันไหวไหมเมื่อไม่มีประวัติรายวัน (ผลของ Q10); widget ไหนไม่มีใครดู — **ถ้าข้อ 1 ตก ไม่ไป M5** (เริ่ม infra ของ M5 ที่ไม่ขึ้นกับผลได้ระหว่างรอ) |
| **CP2** | หลัง M7 (2 สัปดาห์) | 8-10 คน (โควตา LINE) ใช้จริง ได้ push overdue/สำเร็จ; สัมภาษณ์สัปดาห์ที่ 2 | metric §14 ข้อ 2-3; อัตราเชื่อม LINE; **go/no-go MVP** |

### 2.7 ประมาณการเวลา (solo dev, 5 วัน/สัปดาห์, DoD ตาม Q15(b), รวม deploy + แก้บั๊ก, ไม่รวมช่วง field test)

| Milestone | วันทำงาน |
|---|---|
| M0 ตั้งค่า + scaffold + migration แรก | 2-3 |
| M1 foundation + auth + onboarding 1-2 | 5-6 |
| M2 goals + cascade + template + onboarding 3 | 6-8 |
| M3 tasks + recurring + undo + goal.completed | 5-6 |
| M4 dashboard 2 widget | 2-3 |
| CP1 ทดสอบ + แก้ | 2-3 |
| M5 events + cron + LINE + overdue | 5-6 |
| M6 ปฏิทิน 3 มุมมอง | 3-4 |
| M7 ตั้งค่า + PWA + DoD + E2E + staging | 5-6 |
| **รวม** | **35-45 วัน ≈ 7-9 สัปดาห์ (กลาง ≈ 8)** |

**ตรงไปตรงมาเรื่องเป้า 6-7 สัปดาห์ที่ยอมรับใน Decision**: ตัวเลข 6-7 ใน v1 คิดจากกรณี "ไม่มีปฏิทิน + Storybook เฉพาะ domain + E2E 1 flow"; Decision 3 เก็บปฏิทิน 3 มุมมองและ E2E 3 flow ไว้ จึงได้ 7-9 แทน — ถ้าต้องการล็อก ≤ 7 สัปดาห์ให้เลือกคันโยกเหล่านี้: (1) ปฏิทินเหลือ วัน + สัปดาห์ (−1.5 วัน) (2) E2E 2 flow (−0.5) (3) ไม่ทำ service worker เหลือ manifest (−1) (4) จำกัดงานแก้จาก CP1 ไม่เกิน 2 วัน — รวมกันจะได้ ≈ 32-40 วัน ≈ 6.5-8 สัปดาห์ (6-7 คือกรณีดีที่สุด)

---

## ส่วนที่ 3 — ความเป็นไปได้ (สถานะหลัง Decision)

### 3.1 รายการตัด — ตัดสินแล้วทั้งหมด (Decision 3)
ตัด: offline write queue · `WidgetPicker` + ย้าย widget · daily digest · ปฏิทินปี · `ShopChecklistWidget` · `DailyLifeWidget` (domain เหลือ UI ขั้นต่ำ) · (โดยนัย) `SalesVsGoalWidget` + `seller_sales_entries`
คงไว้: recurring task · progress rollup (pure function) · ปฏิทิน วัน/สัปดาห์/เดือน · life domain 6 ตัวใน form + filter

### 3.2 สิ่งที่เอกสารเดิมประเมินง่ายเกินจริง (ยังจริงอยู่)
1. เวลา POC — เอกสารเดิม 3-5 สัปดาห์; หลังตัดแล้วประมาณ 7-9 (§2.7); Scope §12 แก้เป็นเป้า 6-7 พร้อมอ้างอิงประมาณการนี้
2. "LINE พื้นฐาน" ซ่อน webhook + signature + flow จับคู่ + job สแกน overdue (R16) ≈ 5-6 วัน
3. Email OTP ต้องมี custom SMTP + domain (R2) และความเร็วอีเมลกระทบเป้า 90 วินาที — วัดจริงใน CP1
4. DatePicker พ.ศ. + สัปดาห์เริ่มอาทิตย์ ต้องเขียน formatter เอง (~0.5-1 วัน)
5. Bundle budget — ลดความเสี่ยงลงมากเมื่อไม่มี Recharts ใน POC (R8)
6. ยอดขายไม่มีประวัติรายวัน (Q10) — ถ้า CP1 พบว่าแม่ค้าต้องการเห็นรายวัน จะเป็น migration เพิ่มใน MVP ไม่ใช่ POC

### 3.3 Dependency ภายนอก (ไม่เปลี่ยน)
LINE OA quota (R1) · Resend + DNS `kemtit.com` (บล็อก CP1 ถ้าไม่มีสิทธิ์ DNS) · Supabase free tier (R9) · Netlify free tier/timeout (R4) · GitHub Actions (R10 — fallback pg_cron อนุมัติแล้ว) · iOS PWA (R11) · Omise ไม่บล็อก POC แต่ควรเริ่ม KYC ช่วง CP2 ถ้าจะไป MVP · Node/Next/Serwist version (R5, R15)

---

## ข้อเสนอนอก scope (ยังไม่ทำ เว้นแต่อนุมัติ)
1. **Sentry (ฟรี)** — error monitoring ช่วง field test (1 ชม.)
2. **PDPA ขั้นต่ำ** — ข้อความยินยอม 1 บรรทัดหน้า login (ผมนับรวมใน M1 แล้วเพราะเป็นข้อความ 1 บรรทัด) + หน้านโยบาย static (ครึ่งวัน — ยังไม่รวม)
3. **เริ่มยื่น Omise merchant** ช่วง CP2 (กระบวนการ ไม่มีโค้ด)

## รายการเล็กที่ยังเปิด (ตอบได้ระหว่างทาง ไม่บล็อก M0)
1. เวลาสแกน overdue 08:00 Asia/Bangkok และ toggle ปิดได้ในตั้งค่า — โอเคไหม
2. streak นับรวม task เดี่ยว (`tasks.completed_at`) ด้วยหรือเฉพาะ `task_completions` ตาม D1.3 ตรงตัว
3. ข้อความ task ตัวอย่างใน template (จะเสนอตอน M2)
4. Q6/Q7/Q14/Q15/Q16 — ถ้าไม่ทัก ใช้ตามสมมติฐานใน §1.2

---

## ภาคผนวก A — POC Decisions (2026-09-05) — บันทึกคำตัดสินของเจ้าของโปรเจกต์

> เอกสารนี้มีลำดับความสำคัญสูงกว่า full-scope และ design-system เมื่อขัดกัน

**Decision 1 — กฎของ goal และ schema (migration 0002)**
- 1.1 `goals.goal_kind text not null default 'execution' check in ('metric','execution')` — metric: progress = `current_value / target_value` ที่ user กรอกเอง (เช่น ยอดขายเดือนนี้ 50,000 บาท); execution: จำนวน task ลูกที่เสร็จ / ทั้งหมด คำนวณตอนอ่าน (เช่น เตรียมเปิดร้านสาขาใหม่) — **ห้ามผสม**: metric ไม่นับ task ลูกแม้มี task ผูก
- 1.2 rollup คำนวณตอนอ่านด้วย pure function `core/domain/progress.ts` ไม่ใช้ trigger — `computeProgress(goal, children, tasks)`: metric → `min(100, current/target×100)` (ไม่มี target → 0); execution → ค่าเฉลี่ยของ [progress ของ child แต่ละตัว, อัตราส่วน task ตรงที่เสร็จ (ถ้ามี task)] น้ำหนักเท่ากัน ไม่ทำ weighted ใน POC
- 1.3 ตาราง `task_completions(id uuid pk, task_id → tasks on delete cascade, user_id → auth.users, completed_on date, created_at, unique(task_id, completed_on))` + index `(user_id, completed_on)` + RLS `auth.uid() = user_id` (for all) — recurring ไม่ใช้ `tasks.completed_at` แล้ว ทุกครั้งที่ติ๊ก insert แถว; task เดี่ยวใช้ `tasks.completed_at` เหมือนเดิม; streak 7 วัน = `completed_on` ต่อเนื่องของ user
- 1.4 onboarding ยึดเป้าเดือน: goal แรก `period_type='month'`, `goal_kind='metric'`; template สร้าง `week` ลูก (execution) 4-5 ตัว + task ตัวอย่าง 1 ตัว/สัปดาห์; ไม่สร้าง year goal ใน onboarding; แก้ Scope §7 Flow A ข้อ 5

**Decision 2 — LINE และ cron**
- 2.1 ผูกบัญชีด้วยรหัส 6 ตัว หมดอายุ 10 นาที ใน `user_profiles.line_link_code` → QR/ปุ่มเพิ่มเพื่อน → user พิมพ์รหัสใน LINE → webhook หา user → บันทึก `line_user_id` → ล้าง code → reply "เชื่อมสำเร็จ" (reply ฟรี)
- 2.2 ตัด daily digest — push เฉพาะ: task เลยกำหนด (≤ 1 ข้อความ/user/วัน รวมทุก task) และ goal สำเร็จ 100% (ทันที) — ประมาณ 10 tester × ~15 push ≈ 150/เดือน < โควตาฟรี 300 ครึ่งหนึ่ง; ถ้าชนโควตา อัปเกรด Basic 1,280 บาท/เดือน ยอมรับเป็นต้นทุน POC; แก้ Scope §13 เป็น "0-1,280 บาท"
- 2.3 cron = GitHub Actions `*/5 * * * *` (ไม่ใช่ `*/2`); ยอมรับดีเลย์ 5-15 นาที; **pg_cron + pg_net เป็น fallback ที่อนุมัติล่วงหน้า** — ถ้าดีเลย์ > 15 นาทีบ่อยจนกระทบ tester สลับได้เลยไม่ต้องถาม (ยิง HTTP เข้า route handler เดิม ไม่แก้โค้ด ไม่มี 60-day disable)

**Decision 3 — รายการตัด (หลัก: ตัดทุกอย่างที่ไม่ส่งผลต่อ success metric 3 ข้อใน Scope §14)**
| รายการ | ตัดสิน | เหตุผล |
|---|---|---|
| Offline write queue | ตัด | banner read-only พอ |
| WidgetPicker + ย้าย widget | ตัด | POC fixed; Design §8.4 ระบุเป็น MVP |
| Daily digest LINE | ตัด | ตาม 2.2 |
| ปฏิทิน view ปี | ตัด | เหลือ วัน/สัปดาห์/เดือน |
| Domain ชีวิตส่วนตัว | คงไว้ UI ขั้นต่ำ | เลือก domain ตอนสร้าง task + filter งาน/ชีวิต ไม่มี DailyLifeWidget |
| Recurring task | คงไว้ | จำเป็นต่อ streak |
| Progress rollup | คงไว้ (pure function) | แก่นของ cascade |
| ShopChecklistWidget | ตัด | ใช้ recurring task ธรรมดา |
Widget ที่เหลือ: `GoalProgressWidget` (goal เดือนนี้) + `TodayTasksWidget` — fixed layout

**ความเสี่ยงที่ต้องแก้ใน M0**: (1) Resend + DNS สำหรับ OTP ห้ามพึ่ง default SMTP (2) `openExternalBrowser=1` ทุกลิงก์จาก LINE (3) Supabase 2 project dev/staging ตั้งแต่ M0

**เวลา**: ยอมรับเป้า 6-7 สัปดาห์ (แทน 3-5) — Scope §12 แก้แล้ว; ประมาณการรายละเอียดดู §2.7

---

## ภาคผนวก B — รายการไฟล์ M0 ที่จะสร้าง/แก้ (รอยืนยัน)

**สร้างใหม่ (scaffold + tooling)**: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (ถ้า pnpm 10 สร้าง), `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs` (jsx-a11y + boundaries), `.prettierrc`, `.prettierignore`, `.nvmrc`, `.env.example`, `netlify.toml`, `components.json` (shadcn), `vitest.config.ts`, `vitest.setup.ts`, `.storybook/main.ts`, `.storybook/preview.tsx`, `playwright.config.ts`, `next-env.d.ts` (gitignored)

**สร้างใหม่ (src)**: `src/app/layout.tsx` (ฟอนต์ + next-intl provider), `src/app/page.tsx` (placeholder ไทยจาก `th.json`), `src/styles/globals.css` (token ครบชุด + alias shadcn), `src/lib/utils.ts` (`cn`), `src/lib/env.ts` (Zod ตรวจ env ตอน boot), `src/messages/th.json`, `src/i18n/request.ts`, `src/components/ui/button.tsx` (ตัวแรกเพื่อพิสูจน์ token pipeline), `src/components/ui/button.stories.tsx`, `public/icons/` (placeholder), `public/favicon.ico`

**สร้างใหม่ (supabase / CI)**: `supabase/config.toml`, `supabase/.gitignore`, `supabase/migrations/0001_user_profiles.sql`, `supabase/seed.sql` (ว่าง มีคอมเมนต์), `.github/workflows/ci.yml`

**แก้ไข**: `.gitignore` (เพิ่ม `.netlify/`, `storybook-static/`, `playwright-report/`, `test-results/`, `supabase/.temp/`), `README.md` (ส่วน "เริ่มพัฒนา": ติดตั้ง, env, คำสั่ง), `tracking-log.md`

**ไม่แตะ**: `docs/*`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.gitnexus/`

**ขั้นตอนที่ต้องรอคุณ**: `supabase link` / `db push` และ Netlify deploy ต้องมี project + env จากส่วน 2.2 A — ส่วน scaffold/tooling/migration file ทำได้ก่อนโดยไม่รอ
