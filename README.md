# Kemtit (เข็มทิศ)

Turn one big yearly goal into what you need to do today.

## What is Kemtit

Kemtit is a web app for planning your work goals and your personal life in one place. Its main idea is the Goal Cascade: you set one big goal for the year, and Kemtit breaks it down into quarters, months, weeks, and daily tasks for you. It is built for people in Thailand first, in Thai, with reminders sent through LINE.

## Key features

- Goal Cascade: one yearly goal becomes quarterly, monthly, weekly, and daily steps
- Task list with tasks that repeat on a schedule
- Life areas next to work goals: health, family, money, growth, and relationships
- A dashboard you arrange yourself by dragging widgets where you want them
- LINE messages that remind you about tasks and celebrate the goals you reach
- Tools for how you work: sales numbers for online sellers, a content plan for creators, an exam countdown for students, and goal tracking for office workers
- Thai language, and prices that make sense for people in Thailand
- Works in the browser and installs on your phone like a normal app

## Tech stack

- Next.js
- TypeScript
- Supabase (Postgres database and user login)
- Netlify (hosting)
- LINE Messaging API (notifications)
- Omise (payments)

## Status

POC feature-complete on branch `feat/poc` (M0–M7 in `docs/implementation-plan.md`): OTP login, persona onboarding, goal cascade with progress rollup, tasks with recurring completions, fixed dashboard, LINE linking + overdue/goal-completed push (dry-run until a LINE token is set), calendar, PWA. Hosted Supabase/Netlify/LINE accounts still need to be provisioned by the owner before field testing.

## เริ่มพัฒนา (Developer setup)

### สิ่งที่ต้องมีในเครื่อง

- Node 22 LTS (อ่านจาก `.nvmrc` — `nvm use`) และ pnpm 11 (`npm i -g pnpm`)
- Docker เฉพาะถ้าจะรัน Supabase local ด้วย `pnpm exec supabase start` (ไม่บังคับใน POC — ใช้ project บน supabase.com เป็นหลัก)
- Supabase CLI ติดตั้งเป็น devDependency แล้ว เรียกผ่าน `pnpm exec supabase ...` หรือ script `pnpm db:*`

### ติดตั้งและรัน

```bash
pnpm install
cp .env.example .env.local   # แล้วใส่ค่าจริง (ดูหัวข้อ Supabase / Resend / LINE ด้านล่าง)
pnpm dev                     # http://localhost:3000
pnpm storybook               # http://localhost:6006
```

ตรวจก่อน commit (ชุดเดียวกับ CI ใน `.github/workflows/ci.yml`):

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### Supabase — ทำครั้งเดียวต่อ project (ต้องมี 2 project: `kemtit-dev` และ `kemtit-staging`)

1. สร้าง project ที่ supabase.com เลือก region Singapore (ap-southeast-1)
2. Authentication → Providers → Email: เปิด Email provider (ใช้ OTP จึงไม่ต้องเปิด Confirm email)
3. Authentication → Settings (Auth): OTP length `6`, Email OTP expiry `600` วินาที
4. Authentication → Email Templates → **Magic Link**: วางเนื้อหาจาก `supabase/templates/magic_link.html` — ต้องมี `{{ .Token }}` เพื่อให้ส่งเป็นรหัส 6 หลักแทนลิงก์
5. Authentication → URL Configuration: Site URL = URL ของแอป (local `http://localhost:3000`) และเพิ่ม URL ของ Netlify (production + deploy preview) ใน Redirect URLs
6. **Custom SMTP (บังคับก่อนทดสอบกับคนนอกทีม)**: Authentication → Emails → SMTP Settings (บาง dashboard อยู่ที่ Project Settings → Authentication) → เปิด Custom SMTP แล้วใส่ค่าจาก Resend (หัวข้อถัดไป) — default SMTP ของ Supabase ส่งได้ไม่กี่ฉบับต่อชั่วโมงและอาจส่งได้เฉพาะอีเมลสมาชิกทีม
7. Project Settings → API: คัดลอก Project URL, anon (publishable) key, service_role (secret) key ลง `.env.local`
8. เชื่อม CLI แล้ว push migration (migration ทุกไฟล์อยู่ใน `supabase/migrations/` ชื่อขึ้นต้นด้วย timestamp):

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref ของ kemtit-dev>
   pnpm db:push
   ```

   staging ทำซ้ำด้วย ref ของ `kemtit-staging` เมื่อถึง milestone ปล่อยให้ tester

### Resend — custom SMTP สำหรับส่ง OTP

1. resend.com → Domains → Add domain `kemtit.com` → เพิ่ม DNS record ที่ Resend แสดง (SPF, DKIM และ MX ของ return-path) ที่ผู้ให้บริการโดเมน → รอสถานะ Verified
2. Resend → API Keys → สร้าง key สิทธิ์ Sending access (ใช้เป็น SMTP password)
3. ค่า SMTP: host `smtp.resend.com` · port `465` (SSL) หรือ `587` (STARTTLS) · username `resend` · password = API key
4. ใส่ใน Supabase SMTP Settings: Sender email `no-reply@kemtit.com` · Sender name `เข็มทิศ` · host/port/user/pass ตามข้อ 3
5. ทดสอบขอ OTP ด้วยอีเมลที่ **ไม่ใช่** สมาชิกทีม Supabase — ต้องได้รับภายในราว 1 นาที

### Netlify

1. Add new site → Import from GitHub → เลือก repo นี้ — build command และ Node 22 อ่านจาก `netlify.toml` อัตโนมัติ
2. Site configuration → Environment variables: ใส่ทุกตัวจาก `.env.example` (แยกค่า Production / Deploy previews ได้)
3. Deploy preview ของทุก branch/PR ขึ้นอัตโนมัติ — ใส่ URL เหล่านั้นใน Supabase Redirect URLs ด้วย

### LINE Messaging API (ใช้จริงใน M5 — ตั้งค่าล่วงหน้าได้)

1. developers.line.biz → Provider `Kemtit` → Create channel → **Messaging API** (จะได้ LINE Official Account มาพร้อมกัน)
2. แท็บ Messaging API: issue Channel access token (long-lived) และคัดลอก Channel secret ลง `.env.local`
3. LINE Official Account Manager → Settings → Response: ปิด auto-reply และ greeting (หรือตั้ง greeting เป็นวิธีเชื่อมบัญชี) และเปิด Webhooks — URL ใส่ตอน M5 คือ `https://<app>/api/line/webhook`
4. Basic ID (`@xxxx`) → `NEXT_PUBLIC_LINE_OA_BASIC_ID`
5. เช็คโควตาข้อความของแผนฟรีใน OA Manager — ดูประมาณการใน `docs/implementation-plan.md` (R1)

### GitHub

- Settings → Secrets and variables → Actions: `CRON_SECRET` (ค่าเดียวกับใน Netlify) และ `CRON_BASE_URL` (URL ของแอปบน Netlify) — ใช้โดย workflow cron ตั้งแต่ M5
- CI (lint · typecheck · test · build) รันทุก push/PR อยู่แล้ว ไม่ต้องใช้ secret — CI ตั้ง `SKIP_ENV_VALIDATION=1` เพื่อ build ด้วยค่า placeholder; ที่ runtime จริง env ที่ขาดจะ throw error ที่บอกชื่อตัวแปร

### กฎที่ lint บังคับ (Scope §4, Design §16)

- `src/core/` ห้าม import `src/modules/` และ `src/shared-services/`
- `src/modules/<persona>/` ห้าม import module อื่น และ `modules/`, `shared-services/`, `components/` ห้ามใช้ `@supabase/*` ตรง ๆ — ผ่าน `core/`
- `src/components/`, `src/modules/`, `src/app/` ห้ามมี hex สีดิบ — ใช้ token จาก `src/styles/globals.css`
- ข้อความ UI ทั้งหมดอยู่ใน `src/messages/th.json`
- migration สร้างด้วย `pnpm db:new <ชื่อ>` เท่านั้น (ใส่ timestamp ให้อัตโนมัติ) แล้ว `pnpm db:push` — ห้ามแก้ schema ใน Studio

### โครงสร้างโค้ด (สรุป — รายละเอียดใน `docs/implementation-plan.md` §2.3)

`src/app` routes · `src/core` shared kernel (goals, tasks, domain pure functions, events, ports) · `src/modules/<persona>` · `src/shared-services` (LINE, event processor) · `src/components/{ui,domain,widgets,layout}` · `src/lib` · `src/styles/globals.css` token ทั้งหมด · `src/messages/th.json` · `supabase/migrations`

### ทดสอบ end-to-end บนเครื่อง (Supabase local)

```bash
pnpm exec supabase start          # Postgres + Auth + Mailpit (ครั้งแรกดึง image ~1 GB)
pnpm exec supabase status -o env  # คัดลอก API_URL / ANON_KEY / SERVICE_ROLE_KEY ลง .env.local
pnpm db:reset                     # apply migrations ทั้งหมด
pnpm exec supabase gen types typescript --local > src/types/database.ts
pnpm e2e --project=mobile-chrome  # Playwright สตาร์ท next dev เอง; OTP อ่านจาก Mailpit http://127.0.0.1:54324
```

`.env.local` สำหรับ local: `LINE_CHANNEL_SECRET` ใส่ค่าอะไรก็ได้ (ใช้เซ็น webhook ใน E2E) และเว้น `LINE_CHANNEL_ACCESS_TOKEN` ว่างเพื่อให้ระบบอยู่ในโหมด dry-run

### LINE, cron และ PWA

- **LINE dry-run**: ถ้าไม่มี `LINE_CHANNEL_ACCESS_TOKEN` ระบบจะ log ข้อความแทนส่งจริงและบันทึก `notification.sent` ด้วย `dryRun: true` — ใส่ token เมื่อมี OA จริง ไม่ต้องแก้โค้ด
- **Webhook**: ตั้ง URL ใน LINE Developers เป็น `https://<app>/api/line/webhook` — ตรวจ `X-Line-Signature` ด้วย `LINE_CHANNEL_SECRET`; user ผูกบัญชีด้วยรหัส 6 ตัวจากหน้า ตั้งค่า → เชื่อม LINE
- **Cron** (GitHub Actions ใน `.github/workflows/`): `cron-events.yml` ทุก 5 นาที → `POST /api/cron/process-events`, `cron-scan-overdue.yml` 08:00 เวลาไทย → `POST /api/cron/scan-overdue`, `keepalive.yml` commit เปล่าเดือนละครั้ง — ทั้งหมดใช้ secret `CRON_BASE_URL` และ `CRON_SECRET` (ข้ามเองถ้ายังไม่ตั้ง); ทดสอบมือด้วย `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/process-events`
- **PWA**: `src/app/manifest.ts` + icon ใน `public/icons/` (สร้างใหม่ด้วย `node scripts/generate-icons.mjs`) + service worker จาก Serwist (`src/app/sw.ts`) — สร้างเฉพาะตอน `pnpm build` ซึ่งใช้ webpack เพราะ Serwist ยังไม่รองรับ Turbopack; ออฟไลน์อ่านได้ตามที่ cache ไว้ แต่ยังบันทึกไม่ได้ (ไม่มี offline queue ตาม POC Decisions)
- **Metrics ของ POC** (Scope §14): รัน `supabase/queries/poc-metrics.sql` ใน Supabase Studio
