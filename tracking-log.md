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
- **Result**: `pnpm lint` / `typecheck` / `test` (6 tests) / `build` (CI=true) / `build-storybook` ผ่านทั้งหมด; `next start` render หน้าไทย `lang="th"` ฟอนต์ Plex Thai theme-color ถูกต้อง · สิ่งที่ต่างจากรายการที่ยืนยัน: ใช้ `src/app/icon.svg` แทน `public/favicon.ico` (convention ของ Next), ใช้ package `cn` ของ shadcn แทน clsx+tailwind-merge เพราะ CLI v3 generate `import { cn } from "cn"`, ไม่ได้ติดตั้ง `eslint-plugin-boundaries` (ใช้ `no-restricted-imports` ตามที่ขอ), ใส่ block ของ Next ใน `AGENTS.md` · ยังไม่ได้ทดสอบ: migration บน Postgres จริง (Docker pull ช้า — ตรวจ syntax/logic ด้วยการอ่านแล้ว; จะรัน `pnpm db:push` ได้เมื่อมี project dev) · Storybook แจ้ง chunk > 500kB (เป็น runtime ของ Storybook เอง ไม่ใช่ของแอป) · button ของ shadcn สูง 36px ยังไม่ถึง 44px ตาม Design §10 — ปรับตอน M1 พร้อม primitives ที่เหลือ · รอเจ้าของโปรเจกต์: สร้าง Supabase 2 project + Resend SMTP + Netlify + LINE + GitHub secrets แล้ว `pnpm exec supabase link` + `pnpm db:push`
