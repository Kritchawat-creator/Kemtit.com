# Kemtit — วิเคราะห์ฟีเจอร์ทั้งระบบและสรุปสิ่งที่ยังขาด

**วันที่**: 2026-09-12 · **branch**: `feat/poc` @ `7ab4449` · **ขอบเขต**: research only — ไม่มีการแก้โค้ดใน `src/`, `supabase/`, `e2e/`

---

## 1. สรุปผู้บริหาร

Kemtit ตอนนี้คือ **POC ที่ฟีเจอร์ core ครบและทำงานได้จริง แต่ยังไม่เคยออกจากเครื่อง dev** — โค้ดผ่าน M0–M7 ครบ บวก M10a/M10b (ชั้นข้อมูล "บันทึกยอด" + desktop shell/dashboard v3) แต่ยังไม่มี Supabase project จริง ไม่มี Netlify site ไม่มี LINE channel จริง และยังไม่เคยมี tester คนนอกแตะระบบสักครั้ง

ผลตรวจ 627 รายการใน 16 พื้นที่ฟีเจอร์:

- **220 ข้อ ทำแล้วจริง** (มี file:line ยืนยัน)
- **167 ข้อ ยังไม่มี แต่เลื่อนไว้ถูกต้อง** — อ้าง scope §11 tier / §16 / tracking-log ได้ทุกข้อ **ไม่ใช่ปัญหา**
- **240 ข้อ เป็น gap จริง** (ราว 204 ข้อหลังตัดที่ซ้ำข้ามพื้นที่) — ในนั้น **22 ข้อบล็อก field test**

**ข้อสรุปที่สำคัญที่สุด**: สิ่งที่ขาดและควรกังวล **ไม่ใช่ฟีเจอร์** — ฟีเจอร์ที่ยังไม่มี (billing, drag-drop dashboard, persona 2-4, LINE Login, dark mode, admin UI) ถูกเลื่อนไว้อย่างจงใจและมีเอกสารรองรับครบ สิ่งที่ขาดจริงคือ 4 กลุ่มนี้:

| กลุ่ม | สภาพ | ผลถ้าไม่แก้ |
|---|---|---|
| **A. การ provision ของจริง** | ยังไม่ทำสักข้อ (Supabase / Netlify / LINE / GitHub secrets) | CP1 เริ่มไม่ได้เลย — ไม่ใช่ "ช้า" แต่คือ "ทำไม่ได้" |
| **B. ลิงก์ตายใน shell ที่ ship แล้ว** | 6 จุดชี้ไป `/entries` `/tasks` `/search` ที่ยังไม่มีหน้า | tester กด 2 ใน 5 เมนูหลักแล้วเจอ 404 |
| **C. ข้อมูลของ tester สูญ/รั่วได้** | SW cache หน้า login แล้ว 24 ชม. · ลบ task ซ้ำ = ประวัติหายถาวร · parent cycle ทำหน้าพังกู้ไม่ได้ | ความเสียหายกับคนจริง ไม่ใช่แค่ UX |
| **D. ชั้นปฏิบัติการที่ไม่เคยมีในเอกสาร** | ไม่มีแผน deploy branch · ไม่มี backup · ไม่มี security header · ไม่มีช่องให้ tester แจ้งปัญหา | ของพังกลางการทดสอบแล้วกู้ไม่ได้และไม่รู้ตัว |

**กลุ่ม D คือของใหม่ที่ไม่เคยถูกบันทึกที่ไหนมาก่อน** — ทั้ง scope, implementation-plan และ QA review เดิมมองแอปในฐานะ "โค้ดที่ต้องทำงานถูก" ไม่มีเอกสารไหนมองมันในฐานะ "ระบบที่ต้องรันกับข้อมูลจริงของคน 8-10 คน นาน 2 สัปดาห์"

---

## 2. วิธีตรวจ

รันเป็น multi-agent workflow: 16 agent สำรวจพื้นที่ฟีเจอร์แยกกัน → 16 agent ทำหน้าที่ **หักล้าง** ข้อกล่าวหาว่า "ขาด" ของแต่ละพื้นที่ด้วยคำค้นชุดใหม่ → 3 agent ตรวจความครบถ้วนด้วยเลนส์ต่างกัน (spec coverage · เส้นทางผู้ใช้จริง · ชั้นปฏิบัติการ) รวม 35 agent, 1,292 tool call

### การจัดหมวด — บังคับ 3 ระดับ ไม่ใช่ 2

ประเด็นสำคัญของงานนี้คือ **Kemtit เป็น POC โดยเจตนา** ถ้ารายงานลิสต์ของที่เจ้าของตั้งใจไม่ทำว่า "ขาด" รายงานก็ไร้ค่า ทุกข้อจึงถูกบังคับให้เข้าหมวดใดหมวดหนึ่ง:

| หมวด | นิยาม | หลักฐานที่บังคับ |
|---|---|---|
| `built` | มีในโค้ดปัจจุบัน | file:line |
| `deferred` | ไม่มี **และ** มีเอกสารเลื่อนไว้ชัด | ต้องอ้าง scope §11 tier / §16 / §17 / tracking-log "ยังไม่ทำ" / phase ในแผน — อ้างไม่ได้ = ไม่ใช่ deferred |
| `gap` | สเปกบอกว่าต้องมีใน scope ปัจจุบัน แต่ไม่มี / เป็น stub / ต่อไม่ถึง / พัง | file:line ที่พัง **หรือ** "กวาด path ไหน ด้วยคำค้นอะไร แล้วไม่เจอ" |

### กันการเดาว่า "ไม่มี"

ผลค้นเป็นศูนย์แปลว่า **ยังไม่เจอ** ไม่ใช่ **ไม่มี** — ทุกข้อที่อ้างว่าขาดต้องระบุคำค้นที่ใช้และ path ที่กวาด แล้วผ่าน verifier ที่ค้นด้วยคำอื่น (ข้อความไทยใน `th.json`, ชื่อ column ใน DB, ชื่อไฟล์ route, ชื่อ event type) เพื่อพยายามล้มข้อกล่าวหานั้น ผลคือมีข้อที่ถูก verifier ตีตกและย้ายกลับเป็น `built`/`deferred` จำนวนหนึ่ง และ verifier เองพบ gap เพิ่มที่ finder มองข้าม (ทำเครื่องหมาย `*` ในภาคผนวก)

### หมายเหตุความแม่นยำ

`docs/qa-review-2026-09-06.md` เก่าไป 6 วัน (มี M10a, M10b-1, M10b-2 + follow-up 2 ตัวลงหลังจากนั้น) จึงมี agent เฉพาะทางไปตรวจ **ทุกข้อ A1–A7 / B1–B38 / C1–C5 / D1–D7 กับ HEAD ปัจจุบัน** แทนการคัดลอกต่อ — ผลคือ **ยังเปิดอยู่ทั้งหมด ไม่มีข้อไหนถูกแก้เลยตั้งแต่ 2026-09-06** (สอดคล้องกับ tracking-log รอบ 18 ที่บันทึกว่า "ยังไม่ได้แก้อะไรเลยตามคำขอ — รอเจ้าของโปรเจกต์เลือกว่าจะแก้ข้อไหนก่อน CP1")

---

## 3. ภาพรวมต่อพื้นที่

| พื้นที่ | ตรวจทั้งหมด | built | deferred | **gap** | บล็อก field test |
|---|---:|---:|---:|---:|---:|
| Auth & Onboarding | 38 | 19 | 8 | **11** | 0 |
| Goal Cascade + Progress | 37 | 13 | 7 | **17** | 0 |
| Tasks + Recurrence | 32 | 14 | 7 | **11** | 2 |
| ปฏิทิน + Life domain | 36 | 19 | 8 | **9** | 0 |
| Dashboard + Widget | 36 | 8 | 16 | **12** | 0 |
| บันทึกยอด + Seller module | 45 | 23 | 12 | **10** | 2 |
| Persona อื่น (Creator/Student/Office) | 36 | 8 | 22 | **6** | 0 |
| LINE + Domain events + Cron | 38 | 15 | 11 | **12** | 2 |
| Billing / Free-Pro gating | 27 | 5 | 15 | **7** | 2 |
| Admin & Metrics | 35 | 10 | 17 | **8** | 0 |
| Data model + RLS/Security | 38 | 23 | 9 | **6** | 0 |
| UI design system | 60 | 29 | 12 | **19** | 1 |
| Non-functional / PWA / Perf | 29 | 14 | 5 | **10** | 1 |
| Test + CI/CD + provisioning | 48 | 7 | 4 | **37** | 5 |
| Route & Navigation | 30 | 13 | 14 | **3** | 0 |
| QA review 2026-09-06 (ตรวจซ้ำ) | 62 | 0 | 0 | **62** | 7 |
| **รวม** | **627** | **220** | **167** | **240** | **22** |

**อ่านตารางนี้อย่างไร**: แถว `Test + CI/CD + provisioning` gap สูงสุด (37) เพราะรวมงาน provision ฝั่งเจ้าของและช่องว่างเทสต์ของโค้ดใหม่ที่ยังไม่ถูกเขียน ไม่ใช่เพราะระบบพัง · **แถว `QA review (ตรวจซ้ำ)` 62/62 ต้องอ่านต่างจากแถวอื่น** — มันไม่ใช่พื้นที่ที่สำรวจเอง แต่เป็นการเดินตรวจรายการเดิมของ `qa-review-2026-09-06.md` ทุกข้อกับ HEAD ปัจจุบัน จึงนับ 62/62 เพราะไม่มีข้อไหนถูกแก้เลย และในนั้น: ราว **36 ข้อทับกับพื้นที่อื่น** · **C1–C5 เป็นประเด็นที่ต้องตัดสินกับ spec ไม่ใช่ gap** (ยกไปอยู่ใน §9) · **D1–D7 เป็นช่องว่างเทสต์ที่นับซ้ำกับแถว `Test + CI/CD`** — ตัวเลข gap ที่ไม่ซ้ำกันจริงจึงอยู่ราว **204 ข้อ** และแถวนี้มีไว้ให้เห็นสถานะครบทุกข้อของ QA review เดิมเป็นหลัก · แถวที่ deferred สูง (`Persona อื่น` 22, `Admin & Metrics` 17, `Dashboard` 16, `Billing` 15) คือพื้นที่ที่ **ตั้งใจไม่ทำใน POC** และทำถูกแล้ว

---

## 4. สิ่งที่ขาดและ**บล็อก field test** (P0 — ต้องจัดการก่อนนัด CP1)

### 4.1 กลุ่ม A — งาน provision ที่ยังไม่ได้ทำสักข้อ

ทั้ง 5 ข้อนี้อยู่ในรายการ "งานที่เหลือฝั่งเจ้าของโปรเจกต์ก่อน CP2" ของ `implementation-plan.md` อยู่แล้ว แต่ยืนยันจากรีโปว่ายังไม่มีร่องรอยว่าทำ:

| id | สิ่งที่ขาด | หลักฐานฝั่งรีโป | ผล |
|---|---|---|---|
| OWN-1 | Supabase `kemtit-dev`/`kemtit-staging` + Resend custom SMTP | `.env.example:6-9` ว่าง · `supabase/.temp/` มีแค่ `cli-latest` ไม่มี `project-ref` ที่ `supabase link` สร้าง | default SMTP ของ Supabase ส่งได้เฉพาะสมาชิกทีม → CP1 ให้คนนอกสมัครไม่ได้ |
| OWN-2 | Netlify site + env + `NEXT_PUBLIC_APP_URL` จริง | ไม่มี `.netlify/` · `NEXT_PUBLIC_APP_URL` ยังเป็น `http://localhost:3000` ทั้งใน `.env.example:13` และ `ci.yml:26` | ไม่มี URL สาธารณะ = CP2 (ใช้เอง 2 สัปดาห์) ทำไม่ได้ |
| OWN-3 | LINE channel + token/secret + webhook + Basic ID | `.env.example:22-25` ว่างทั้ง 3 ตัว พร้อมคอมเมนต์ "ACCESS_TOKEN ว่าง = dry-run" · `ci.yml:61` ใช้ `ci-dummy-line-secret` | §2.6 ระบุว่า CP2 วัด "อัตราเชื่อม LINE" เป็น metric go/no-go ของ MVP — ไม่มี channel = วัดไม่ได้ |
| OWN-4 | GitHub secrets `CRON_BASE_URL` / `CRON_SECRET` | `cron-events.yml:19-22` และ `cron-scan-overdue.yml:19-22` ยังเข้าเส้นทาง `exit 0` เงียบเมื่อ secret ว่าง | ไม่มี push เลย **แต่ workflow ขึ้นเขียวทุกรอบ** จึงไม่มีสัญญาณเตือน (ดู CI-4) |
| OWN-5 | ยังไม่เคยรัน CP1/CP2 | ไม่มี artifact ผลทดสอบใน repo · tracking-log 21 รอบไม่มีรอบไหนบันทึกผล CP0/CP1 | §2.6 กำหนดให้ CP1 เป็นตัวตัดสินว่าจะไป M5 ต่อไหม แต่ M5–M10b สร้างไปหมดแล้ว — **gate นี้ถูกข้าม ไม่ใช่แค่ค้าง** |

> ข้อสังเกตเชิงกระบวนการ: `poc-metrics.sql` เขียนไว้พร้อมใช้แล้ว ซึ่งเป็นข้อดี — ของที่ขาดคือการลงมือ provision ไม่ใช่เครื่องมือวัด

### 4.2 กลุ่ม B — ลิงก์ตายใน shell ที่ ship แล้ว (6 จุด)

`tracking-log` รอบ 21 บันทึกว่า "ลิงก์ sidebar ไป /entries /tasks /search ยังชี้ไปหน้าที่ยังไม่มี (ตั้งใจ — สร้างใน phase 3)" — **สิ่งที่เลื่อนคือ "หน้า" แต่สิ่งที่ ship ไปแล้วคือ "ลิงก์ที่ยังกดได้"** และมี 3 จุดที่อยู่นอก sidebar ซึ่งไม่มีเอกสารไหนเลื่อนไว้เลย:

| จุด | ไฟล์ | ปลายทาง |
|---|---|---|
| เมนู sidebar "บันทึกยอด" | `src/components/layout/nav-items.ts:35` | `/entries` → 404 |
| เมนู sidebar "งาน" (มี badge นับงานค้าง) | `src/components/layout/nav-items.ts:36` | `/tasks` → 404 |
| ช่องค้นหาบน top bar (ทุกหน้า desktop) | `src/components/layout/TopBar.tsx:49` | `/search` → 404 |
| กระดิ่งแจ้งเตือน "งานค้าง N รายการ" | `src/components/layout/NotificationsMenu.tsx:45` | `/tasks` → 404 |
| "ดูทั้งหมด" บนการ์ดบันทึกยอดล่าสุด | `src/app/(app)/dashboard/desktop-dashboard.tsx:315` | `/entries` → 404 |
| `revalidatePath` หลังบันทึกยอด | `src/core/entries/actions.ts:36-37` | revalidate path ที่ไม่มีอยู่ |

**ที่แย่ที่สุดคือกระดิ่ง** — มันโผล่เฉพาะตอนมีงานค้าง คือคลิกที่ tester ตั้งใจกดมากที่สุดในทั้ง shell แล้วพาไป 404 ทันที และ 404 อยู่นอก route group `(app)` จึงไม่มี sidebar/bottom nav (`NAV-G8`) มีแค่ปุ่มกลับแดชบอร์ด

รีโปมีกลไกแก้อยู่แล้วในไฟล์เดียวกัน — รายการ "รายงาน" ใช้ `disabled: true` (`nav-items.ts:43`) render เป็น `span` ไม่ใช่ลิงก์ แต่เพื่อนบ้านอีก 2 รายการไม่ได้ใช้

> ⚠️ ยังมีอีกชั้น: `proxy.ts` สร้าง `?next=/entries` เองได้เมื่อ user ที่ยังไม่ล็อกอินเปิดลิงก์นั้น แล้วโยน user ไป 404 **ทันทีหลังกรอก OTP ผ่าน** (`NAV-M2`) — ไม่มี allowlist ของ route ที่ `?next=` ยอมรับ

### 4.3 กลุ่ม C — ข้อมูลของ tester สูญหรือรั่วได้

| id | อาการ | หลักฐาน | ทำไมถึงเป็น blocker |
|---|---|---|---|
| **A4 / NFR-1** | service worker เก็บ HTML/RSC ของหน้าที่ล็อกอินแล้วไว้ 24 ชม. และ sign-out ไม่เคยล้าง cache | `src/app/sw.ts:22` ส่ง `defaultCache` ทั้งก้อน (cache `others`/`pages`/`pages-rsc`/`apis` = NetworkFirst 24 ชม.) · `src/core/auth/actions.ts:68-72` signOut ล้างแค่ cookie · กวาดทั้ง `src/` หา `caches.*` = 0 hit | QA review พิสูจน์บน production build จริงแล้วว่า HTML เต็มหน้า 32,229 ตัวอักษรถูกเก็บทั้งที่ header เป็น `no-store` · CP2 เป็นครั้งแรกที่ข้อมูลจริงเข้าไปอยู่ใน cache — เครื่องที่ใช้ร่วมกัน ผู้ใช้คนถัดไปเปิด PWA ตอนออฟไลน์เห็นแดชบอร์ด เป้าหมาย และชื่อของคนก่อน · **คอมเมนต์ใน `next.config.ts:8` เขียนว่า "precache static shell" ซึ่งไม่ตรงกับโค้ด** |
| **A1** | เป้าหมายวนลูป (parent cycle) ทำให้หน้า goal detail พังถาวร | `goals/queries.ts:80-84` `buildGoalTree` ไม่มี visited set · `goals/actions.ts:41-55` `validateParent` ตรวจแค่ overlaps ไม่ไล่ ancestor · `goals/candidates.ts:20-25` กรองแค่ `excludeId` ไม่ตัด descendant | ฟอร์มเสนอ "ลูกของตัวเอง" เป็นแม่ได้ แล้ว recursion ไม่รู้จบ · ปุ่ม "แก้ไข/เก็บเข้ากรุ" อยู่บนหน้าที่พังไปแล้ว → **tester กู้เองไม่ได้ ต้องเข้าไปแก้ที่ DB** |
| **TASK-14 / B8** | ลบ task ซ้ำ = ประวัติติ๊กหายทั้งหมด streak เด้งเป็น 0 | `tasks/actions.ts:100-117` hard delete · migration:116 `task_completions on delete cascade` · ไม่มีคอลัมน์ soft delete ในตาราง `tasks` เลย · undo เป็นแค่ `setTimeout` 5 วิฝั่ง client | routine ที่ทำต่อเนื่อง 10 วัน หายด้วยการกดปุ่มเดียวและกู้ไม่ได้หลัง 5 วินาที — **และนี่คือตัวเลขที่ scope §14 ข้อ 2 ตั้งใจใช้วัด retention ของ POC** |
| **TASK-12 / B7** | "เลื่อนวัน" บน task ซ้ำไปแก้ anchor ของทั้งชุด | `TaskList.tsx:263-297` render บล็อกเลื่อนวันโดยไม่เช็ค `selectedRule` · `tasks/actions.ts:129` เขียนทับ `due_date` ซึ่ง migration:86 ระบุว่าเป็น anchor · `recurrence.ts:35` `occursOn` ตัด occurrence ก่อน anchor ทิ้ง | routine ทุกวันที่มีประวัติติ๊ก 5 วัน กด "พรุ่งนี้" → occurrence ย้อนหลังหายจากปฏิทินทั้งหมด · routine "ทุกวันจันทร์" กด "พรุ่งนี้" → toast บอก "เลื่อนไปอังคาร" แต่ rule ไม่มีอังคาร งานไปโผล่จันทร์หน้า |
| **ENT-2** | แถว adjustment ค่าลบแก้ไขไม่ได้ | `goals/actions.ts:207-211` insert `amount: delta` ที่ติดลบได้ · `entries/schema.ts:56-58` `.positive({ error: "positive" })` และ `:65-68` `updateEntrySchema = entryFormSchema.omit({ goalId: true })` → บังคับค่าบวกทั้งตอนสร้างและตอนแก้ | ผลข้างเคียงหนักกว่าการบันทึกไม่ผ่าน: ฟอร์ม prefill ค่าติดลบใน `<Input min={0}>` ผู้ใช้แก้เป็นบวก แล้ว `updateEntry` รับ → **ยอดรวมของเป้าเหวี่ยง 2×\|amount\| เงียบ ๆ** |
| **ONB-BUG-1 / B10** | `createFirstGoal` ไม่มี guard สถานะ onboarding | `onboarding/first-goal/actions.ts:22-23` เช็คแค่ `getMe()` · ตาราง `goals` ไม่มี unique บน `(user_id, period_type, period_start)` | เปิด 2 แท็บ / double-tap บนมือถือ / retry ตอนเน็ตสะดุด = ได้ cascade ซ้ำทั้งชุดโดยไม่มี error · **ทำให้ metric §14 ข้อ 1 (สร้าง goal แรกสำเร็จใน session แรก) ซึ่งเป็นตัวตัดสิน CP1 อ่านค่าไม่ได้** |
| **DS-39 / NFR-9** | กลุ่ม `(auth)` ไม่มี error boundary เลย และทั้งแอปไม่มี `global-error.tsx` | มีแค่ `src/app/(app)/error.tsx` + `loading.tsx` + `not-found.tsx` | login/OTP/เลือก persona/ตั้งเป้าแรก = 3 ขั้นที่ tester **ทุกคน** ต้องผ่าน ถ้า `getMe()`/Supabase ล้มตรงนั้นจะได้หน้า error ดิบของ Next (ภาษาอังกฤษ ไม่มีปุ่มไปไหน) แทนการ์ด "ลองอีกครั้ง" ตาม design §8.6 |
| **AUTH-BUG-2 / B9** | `getMe()` คืน `null` ทั้งตอน DB error และตอนไม่มีแถว | `profile/queries.ts:32-36` ยุบ 2 กรณีเป็นค่าเดียว · `(app)/layout.tsx:15-16` redirect `/login` · `proxy.ts:55-60` เห็น claims ที่ยัง valid แล้วเด้งกลับ `/dashboard` | Supabase ตอบ error ชั่วคราว = tester เจอ `ERR_TOO_MANY_REDIRECTS` ของ browser ซึ่งดูเหมือนแอปพังสนิทและกู้เองไม่ได้ |

### 4.4 กลุ่ม C เพิ่มเติม — สองเส้นทางที่ core loop ตายทั้งเส้น

ทั้งสองข้อนี้ไม่มีพื้นที่ไหนเห็น เพราะมันอยู่ที่ **รอยต่อระหว่างพื้นที่** ไม่ใช่ในพื้นที่ใดพื้นที่หนึ่ง:

**(1) สมัครช่วงปลายเดือน → แอปว่างเปล่าทันทีหลังตั้งเป้าเสร็จ**

เมื่อสมัครในช่วง < 7 วันสุดท้ายของเดือน ฟอร์มเลือก "เดือนหน้า" ให้เป็น default (`onboarding/first-goal/page.tsx:14,34-35`) ผลคือ 3 อย่างพร้อมกัน:
- แดชบอร์ดกรอง `period_start = เดือนนี้` (`GoalProgressWidget.tsx:18-22`) จึงขึ้น empty state **"ยังไม่มีเป้าเดือนนี้ · ตั้งเป้าเดือนนี้"** ทั้งที่เพิ่งสร้างเป้าไปเมื่อ 5 วินาทีก่อน — ชวนให้ tester สร้างเป้าซ้ำอีกใบ
- กด "บันทึกยอด" แล้วโดน **"วันที่อยู่นอกช่วงของเป้าหมายนี้"** เพราะฟอร์ม default เป็นวันนี้ (`EntryForm.tsx:64` vs `entries/actions.ts:25-31`)
- งานตัวอย่างครบกำหนดเดือนหน้า "งานวันนี้" จึงว่าง

→ **core loop ของ CP1 (บันทึกยอดรายวัน + ติ๊กงาน) ตายทั้งเส้นจนกว่าจะขึ้นเดือนใหม่** · ถ้ายังไม่แก้ อย่างน้อยอย่านัด CP1 ตรงกับ 7 วันสุดท้ายของเดือน

**(2) สมัครกลางเดือน → งานตัวอย่างเกิดมาเป็น "งานค้าง" ทันที**

`modules/seller/template.ts:36-41` ตั้ง `due_date` ของทุก week goal ไว้ที่วันแรกของสัปดาห์นั้น ผู้ใช้ที่สมัครกลางเดือนจึงได้งานที่เลยกำหนดไปแล้ว 1-3 ใบตั้งแต่วินาทีแรก widget "งานวันนี้" ขึ้น **"มีงานค้าง N รายการ"** ให้คนที่เพิ่งสมัคร 5 วินาที — สิ่งที่ต้องติ๊กคือหนี้ ไม่ใช่งานของวันนี้ และเมื่อผูก LINE จริงแล้ว cron จะส่งข้อความงานค้างของงานที่ผู้ใช้ไม่ได้เขียนเอง

**(3) บนมือถือ แก้ยอดที่พิมพ์ผิดไม่ได้เลย**

`/entries` · goal detail v2 · GoalCard v2 ถูก defer แยกกันอย่างมีเหตุผลใน tracking-log รอบ 21 — แต่ **รวมกันแล้วแปลว่าบนโทรศัพท์ (เครื่องที่ CP1 ระบุไว้) ไม่มีที่ใดเลยที่อ่าน/แก้/ลบรายการบันทึกยอดได้** มีแต่ฟอร์มสร้าง ขณะที่ desktop ได้ `EntriesTable` ครบ ทางเดียวบนมือถือคือ "อัปเดตยอด" ซึ่งเขียนเป็น adjustment ค่าลบที่ **ENT-2 พิสูจน์แล้วว่าแก้ไม่ได้** → ชุด deferral + ENT-2 ประกอบกันเป็นทางตัน

---

## 5. ชั้นปฏิบัติการที่ไม่เคยมีในเอกสารฉบับใด (P0/P1 — ของใหม่)

ทั้ง scope, implementation-plan และ QA review เดิมมองแอปในฐานะ "โค้ดที่ต้องทำงานถูก" ไม่มีเอกสารไหนมองมันในฐานะ "ระบบที่ต้องรันจริง 2 สัปดาห์" ข้อเหล่านี้จึงไม่ทับกับ OWN-1..5 (ซึ่งเป็น "ยังไม่ได้ทำตามขั้นตอนที่มีอยู่") — ทุกข้อคือกลไกที่ **ไม่เคยมีอยู่ตั้งแต่แรก**

| ระดับ | สิ่งที่ขาด | หลักฐาน | ทำไมถึงสำคัญ |
|---|---|---|---|
| **blocker** | **ไม่มีใครกำหนดว่า production deploy มาจาก branch ไหน** | `git log main` = 2 commit (README + initial) · `git rev-list --count main..feat/poc` = **23** · `origin/HEAD` = `origin/main` · ไม่มีแผน merge/release/tag ในเอกสารใดเลย | ทำตาม README ตรง ๆ (`Import from GitHub`) จะได้ production = `main` = **แอปเปล่าที่มีแต่ README** และ `CRON_BASE_URL` จะชี้ไป URL ที่ไม่มี `/api/cron/*` เลย · ต่างจาก OWN-2 ตรงที่ import ถูกวิธีแล้วยังได้ผลผิด และไม่มีจุด rollback ให้กลับไปตอนโค้ดเสียกลางการทดสอบ |
| **high** | **migration ลง DB ด้วยมือล้วน ไม่มีอะไรผูก schema เข้ากับ deploy** | `rg "db push\|supabase db\|migration" .github/ netlify.toml` = ไม่มีเลย · `supabase/.temp/project-ref` ถูก gitignore · ไม่มีไฟล์ down migration | Netlify auto-deploy ทุก push แต่ schema ไม่ตามไปเอง → **โค้ดใหม่เจอ schema เก่ากลางการทดสอบ** และ instant rollback ของ Netlify ย้อนแค่โค้ด ไม่ย้อน DB |
| **high** | **ไม่มีการสำรอง/กู้คืนข้อมูลเลยสักรูปแบบ** | `rg -i "backup\|สำรอง\|restore\|กู้คืน\|pitr"` ทั้ง `docs/` `README.md` `tracking-log.md` = ไม่มีผลที่เกี่ยวข้อง · `ls scripts/` = `generate-icons.mjs` ไฟล์เดียว · Supabase free tier ไม่มี backup ที่ดาวน์โหลดได้ | CP2 เก็บ**ยอดขายจริง**ของ tester 8-10 คนนาน 2 สัปดาห์ — migration พลาดครั้งเดียว / ลบ goal ผิดใบ (entries cascade ตาม) = ข้อมูลหายถาวร และไม่มีอะไรตอบ tester ที่ถามหาข้อมูลของตัวเอง |
| **medium** | **แอปไม่ส่ง security header ใดเลย** (CSP, HSTS, X-Frame-Options, Referrer-Policy) และไม่มี robots.txt/noindex | `next.config.ts` ไม่มี `headers()` · `netlify.toml` ไม่มี `[[headers]]` · ไม่มีไฟล์ `robots*`/`sitemap*` | แอปที่ถือ session cookie และแสดงยอดขายจริง ถูก embed ใน iframe ของเว็บอื่นได้ และ URL ที่ tester ใช้ไม่มีอะไรกัน search engine index |
| **medium** | **ไม่มี runbook เหตุขัดข้อง และไม่มี kill switch ปิดการแจ้งเตือน** — flag เดียวในระบบคือ uploads | `src/lib/flags.ts` มีตัวเดียว · `rg -i "runbook\|incident\|rollback\|ฉุกเฉิน"` = ไม่มี · `processor.ts:38-41` เขียนเตือนตัวเองไว้ว่าลำดับ push→record→mark ไม่ idempotent | เคสส่ง LINE ซ้ำวนตอน timeout คือเหตุตี 2 ที่ solo dev ต้องหยุดให้ได้ใน 5 นาที — ทางหยุดเร็วสุดคือลบ GitHub secret ให้ workflow `exit 0` แต่ไม่มีเอกสารไหนเขียนไว้ |
| **medium** | **ไม่มีช่องทางให้ tester แจ้งปัญหา** และช่องทางเดียวที่มีตอบกลับเป็นข้อความ error | `rg -i "ติดต่อ\|ช่วยเหลือ\|แจ้งปัญหา\|support"` ใน `th.json` = เจอแค่ `errors.pageTitle` · `line/webhook/route.ts:84-87` ตอบข้อความที่ไม่ใช่รหัส 6 ตัวด้วย "พิมพ์รหัส 6 ตัวจากหน้า ตั้งค่า" · README:93 สั่งปิด auto-reply ของ OA | CP2 เป็นการทดสอบ 2 สัปดาห์**แบบไม่มี moderator** — tester ที่ติดตอน 3 ทุ่มไม่มีทางแจ้งใครได้ และถ้าพิมพ์ถามใน LINE OA (ที่เดียวที่เขารู้จัก) จะถูกตอบด้วยข้อความให้พิมพ์รหัส |
| **medium** | `NEXT_PUBLIC_APP_URL` validate แค่ว่า parse เป็น URL ได้ | `src/lib/env.ts:38` `z.url()` ไม่เช็ค https / ไม่เช็ค non-localhost · `.env.example:14` default = `http://localhost:3000` | ถ้าลืมตั้งบน Netlify ระบบไม่ error เลย แต่ tester **ทุกคน**จะได้ข้อความ LINE ที่ลิงก์ไป localhost ของตัวเอง — พังเงียบจนกว่าจะมีคนกดลิงก์ |
| **medium** | ขั้นตอน provisioning ไม่พูดถึง Supabase **Auth → Rate Limits** ของ hosted project | `supabase/config.toml` ตั้ง `email_sent = 100` ไว้เฉพาะ local พร้อมคอมเมนต์ "hosted ตั้งใน Dashboard" แต่ README 8 ขั้นตอนไม่มีข้อนี้ | CP1 คือ 5-6 คนสมัครพร้อมกันในเซสชันเดียว + ปุ่มขอรหัสใหม่ทุก 60 วิ — เพดานอีเมลตัดกลางเซสชัน = metric §14 ข้อ 1 วัดไม่ได้ |
| **medium** | ไม่มี guard กันการรัน e2e ใส่ hosted project ทั้งที่ README ให้ hosted เป็นวิธีหลัก | `playwright.config.ts` `webServer: pnpm dev` อ่าน `.env.local` โดยไม่ตรวจว่า `NEXT_PUBLIC_SUPABASE_URL` เป็น localhost · `e2e/helpers.ts:7` สร้างอีเมล `@kemtit.test` แล้วยิงผ่านแอปจริง | `pnpm e2e` ครั้งเดียวจะสร้าง auth user จริงในฐานของ tester และส่งเมลไปโดเมนที่ส่งไม่ถึง **ผ่าน Resend ตัวเดียวกับที่ส่ง OTP ให้ tester จริง** — เสี่ยงชื่อเสียงโดเมนที่ล็อกอินทั้งระบบพึ่งอยู่ |

---

## 6. gap ระดับ high ที่เหลือ (P1 — ควรแก้ก่อน MVP ไม่บล็อก CP1)

### 6.1 การวัดผล POC วัดไม่ได้จริง

| id | ปัญหา |
|---|---|
| MET-11 | metric §14 ข้อ 2 (streak 7 วัน) **มองไม่เห็น `goal_entries`** — `poc-metrics.sql` เขียนก่อน M10a จึงนับเฉพาะ `task_completions` แต่ core loop ใหม่ของ seller คือการบันทึกยอด ตัวเลขที่ใช้ตัดสิน go/no-go จึงต่ำกว่าความจริง |
| MET-4 | ไม่มีการวัด DAU/การใช้งานรายวันหลัง M10a |
| MET-6 | `domain_events` เป็นฐานของ metric ทุกข้อ แต่ user ที่ล็อกอินเขียน event ปลอมได้ (A2) — ความน่าเชื่อถือของตัวเลขจึงไม่มีอะไรรับประกัน |
| MET-3 | §14 ข้อ 3 (feedback เชิงคุณภาพ "ต่างจาก Notion/Griply ยังไง") ไม่มีกลไกเก็บเลย |

### 6.2 ความปลอดภัยที่บังคับแค่ชั้นแอป

| id | ปัญหา |
|---|---|
| A2 / SEC-06 | ผู้ใช้ที่ล็อกอินแล้ว `insert` แถวใน `domain_events` ปลอมได้ และ processor เชื่อ payload + prototype key (`OPS-9`: `HANDLERS` ยังหา handler จาก object literal ตรง ๆ) |
| A5 | flag uploads คุมแค่ชั้นแอป — storage policy กับ grant `avatar_path` ยังเปิด เขียนไฟล์/ตั้ง avatar ได้แม้ flag ปิด (ขัดเจตนา PDPA §6A.6) |
| ONB-SEC-1 | grant `update (active_persona, onboarding_completed_at)` ให้ `authenticated` — เปิด devtools เขียนตรงได้ ข้ามด่าน "POC เปิดแค่ seller" และข้ามขั้นที่ 3 ของ onboarding |
| DM-13 | `goals.current_value` กลายเป็นค่า derived ใน M10a แล้ว แต่ `authenticated` ยัง `UPDATE` คอลัมน์นี้ตรงได้ |
| A3 | open redirect `?next=/\evil.com` — `safeInternalPath` เช็คแค่ prefix ไม่กัน backslash/tab (แก้ 3 บรรทัด · verifier ตัดสินว่า **ไม่บล็อก CP1** เพราะ moderated session ไม่มีผู้โจมตีส่งลิงก์) |

### 6.3 ระบบแจ้งเตือน — ข้อที่ทำให้ CP2 วัดไม่ได้

| id | ปัญหา |
|---|---|
| **SHR-M1** | **task ซ้ำไม่เคยเข้าการแจ้งเตือน overdue เลย** — `tasks/admin.ts:18` `.is("recurrence_rule", null)` ตัดออกทั้งหมด ขณะที่ Decision 2.2 เขียนว่า "รวมทุก task" · onboarding สร้างงานตัวอย่างของ seller เป็นงานประจำ และ persona นี้ทำงาน routine เป็นหลัก → **tester จำนวนมากจะไม่ได้รับ push เช้าสักครั้งตลอด CP2** ต้องเลือกว่าจะนับ occurrence ที่ขาดของงานซ้ำ หรือแก้ Decision ให้เขียนว่า "เฉพาะงานเดี่ยว" |
| SHR-25 / B1 | job/queue กลืน DB error → แจ้งเตือนหายทั้งวันโดยไม่ retry และไม่มีสัญญาณ |
| SHR-M3 | push "เป้าสำเร็จ" ปิดไม่ได้ — มีแต่ toggle `notify_overdue` ทั้งที่คำอธิบายในหน้าตั้งค่าครอบทั้งสองแบบ |
| C4 / SHR-28 | ไม่มี lock/claim บน event และ workflow ไม่มี `concurrency:` → รอบตามเวลากับ `workflow_dispatch` ซ้อนกันแล้วส่งซ้ำ |

### 6.4 CI/CD ที่ไม่ได้กันอะไรจริง

| id | ปัญหา |
|---|---|
| CI-1 | **CI ไม่รัน e2e regression suite เลย** — รันแค่ `photos.spec.ts` บน mobile-chrome ซึ่ง `CI-9` ชี้ว่าเป็นการทดสอบ flag ที่ไม่เคยขึ้น production |
| CI-2 | ไม่มีอะไร gate deploy — Netlify build ไม่ผูกกับผล CI |
| CI-7 | `e2e/qa/localhost-qa.spec.ts` **ผ่านเสมอแม้ทุก step ล้ม** — false green ใน suite |
| CI-8 | build ใน CI ไม่ใช่ build ที่ deploy (ข้าม env validation ที่ Netlify รันจริง) |
| CI-10 | ไม่มีอะไรจับ drift ระหว่าง migration กับ `src/types/database.ts` |
| CI-4 | cron workflow `exit 0` เงียบเมื่อ secret ว่าง → เขียวทั้งที่ไม่มีการแจ้งเตือนเกิดขึ้นจริง |
| TEST-4 / M10-1..4 | trigger ที่ทำให้ `goals.current_value` เป็นค่า derived (หัวใจของ M10a) **ไม่มี automated test** · server action + query ของ entries ทั้งชุดไม่มีเทสต์เลย |
| M10-6 | UI ใหม่ของ dashboard v3 ส่วนใหญ่ไม่มี e2e — ครอบแค่การ์ดเข็มทิศ |
| QAD-5 / D7 | ไม่มีเทสต์ cycle ของ `candidatesFor`/`buildGoalTree` — ช่องที่ทำให้ A1 หลุด |

### 6.5 ความสม่ำเสมอของข้อมูลและ UI

| id | ปัญหา |
|---|---|
| GOAL-14 | การกรอง archived ต่างกันระหว่างหน้า list กับ detail → **% ของเป้าเดียวกันไม่ตรงกัน 2 หน้า** |
| ENT-V1 | ทุกแถวที่บันทึกจากการ์ดเข็มทิศขึ้นว่า "ปรับยอด" — data model ไม่มีอะไรแยก adjustment ออกจากยอดขายจริง |
| ENT-3 | กดแก้รายการของเป้าอื่นบนตาราง dashboard แล้วได้ข้อความ "ยังไม่มีเป้าที่วัดเป็นตัวเลข" แทนฟอร์ม |
| GOAL-32 | เป้า metric ที่สำเร็จแล้วหายจากตัวเลือกของฟอร์มบันทึกยอด — **ขายเกินเป้าแล้วบันทึกต่อไม่ได้** |
| NFR-2 | performance budget ยังตกทั้ง LCP (3.8s vs 2.5s) และ JS bundle (~335KB vs 200KB) — ต้นเหตุหลัก (ส่ง `th.json` ทั้งไฟล์ไป client) ยังไม่ถูกแตะ และ **ไม่เคยวัดซ้ำหลัง M10a/M10b เลย** |
| QA-2 | **`docs/qa-review-2026-09-06.md` ยังไม่ถูก commit เข้า git** (`git status` = `??`) ทั้งที่ tracking-log รอบ 18 อ้างถึงไฟล์นี้เป็นผลงานของรอบนั้น — และรายงานฉบับนี้ก็อ้างถึงมันด้วย **ใครก็ตามที่ clone repo จะเปิดไฟล์ที่ทั้งสองฉบับอ้างถึงไม่ได้** (`docs/claude-design-prompt.md` อยู่ในสภาพเดียวกัน) |
| TRACK-1 | รายการ QA review 57 ข้อไม่เคยถูกติดตามที่ไหนนอกจากไฟล์ markdown เดียว — ไม่มี issue list |
| LOG-1 | `tracking-log.md` **ข้ามรอบ 20** — ไม่มีบันทึกของ M10b-1 (desktop shell v3) ทั้งที่มี commit `18c881b` อยู่จริง |

---

## 7. ของที่ "ยังไม่มี" แต่เลื่อนไว้ถูกต้องแล้ว — **ไม่ใช่ปัญหา** (167 ข้อ)

ส่วนนี้มีไว้ให้เห็น roadmap ไม่ใช่รายการงานค้าง ทุกข้ออ้างเอกสารที่เลื่อนไว้ได้

### MVP (scope §11 แถวที่ 2)

- **Subscription/Billing ทั้งระบบ** (Omise/Opn, Free vs Pro, หน้าเปรียบเทียบ 2 คอลัมน์) — §11 ระบุว่า POC = "**ไม่มี billing**" ชัดเจน
- **Drag-drop dashboard + `dashboard_layouts` + WidgetPicker** — §11 POC = "fixed layout (ยังไม่ drag-drop)" · `registry.ts` เตรียมจุดต่อไว้แล้ว
- **เปิด Task Attachments (Free 1 / Pro 5)** — design §6A.6 สั่งปิด flag ตลอด POC/CP1 · เงื่อนไข POC ทั้ง 3 ข้อ (ปิดที่ server action, bucket private, RLS + signed URL) **ทำครบแล้ว**
- **Persona ที่ 2 (Creator)** — content pipeline, ปฏิทินต่อ platform, เป้า follower/engagement
- **Admin-lite 1 หน้า + `audit_log`**
- **widget ต่อ persona** (`SalesVsGoalWidget`, `ShopChecklistWidget`, `DailyLifeWidget`) — implementation-plan:67, 85, 121

### Full Product (scope §11 แถวที่ 3)

- Persona Student (exam countdown, ตารางเรียน, เป้าเกรด) และ Office (OKR รายไตรมาส, weekly review ritual)
- Admin UI เต็มรูปแบบ (design §9 ทั้งหมวด — §9.7 ระบุ phase ไว้แล้ว)
- LINE Login · AI แตกเป้าอัตโนมัติ (port `core/ports/ai-suggestion.ts` **มีอยู่จริง**ตามที่ §16 อ้าง) · native wrapper (Capacitor)

### เลื่อนตาม §16 / §17 (UI out of scope)

dark mode จริง · custom theme ให้ user เลือกสี · drag-drop บนมือถือ · multi-language · mascot/sticker/gradient/glassmorphism · animation ซับซ้อนเกิน §10.6 · import CSV จาก Page365 (Phase 2 ของ seller)

### เลื่อนตามแผน sales-log phase 3 (M10c)

หน้า `/entries` + ตัวกรอง + pagination + export CSV · `/tasks` · `/search` · goal detail v2 (กราฟ + ประวัติแก้ได้ + ปุ่มแชร์) · GoalCard v2 · `e2e/entries.spec.ts`

> ⚠️ **หน้าเหล่านี้เลื่อนได้ แต่ลิงก์ที่ชี้ไปหาเลื่อนไม่ได้** — ดู §4.2

### ข้อที่ควรบันทึกว่า "เลื่อนแล้วขัดกับสเปกเดิม"

`scope §5.1` เขียนว่าเลือก persona แล้ว "**สลับทีหลังได้**" แต่ `implementation-plan §2.4 M7` สั่งให้ซ่อนหมวด persona ในหน้าตั้งค่า — ปัจจุบัน **สลับ persona หลัง onboarding ไม่ได้เลย** เป็น deferred ที่ถูกต้องตามแผน แต่ขัดถ้อยคำใน scope ควรตัดสินว่าจะแก้ scope หรือจะเปิดหมวดนี้

---

## 8. สถานะของ QA review 2026-09-06 — **ยังเปิดอยู่ทั้งหมด**

ตรวจซ้ำทุกข้อกับ HEAD ปัจจุบัน (`7ab4449`) ผลคือ **ไม่มีข้อไหนถูกแก้เลยตั้งแต่ 2026-09-06** — ตรงกับ tracking-log รอบ 18 ที่บันทึกว่า "ยังไม่ได้แก้อะไรเลยตามคำขอ" และ 4 commit หลังจากนั้น (M10a, M10b-1 + follow-up, M10b-2 + follow-up) ไม่ได้แตะไฟล์ที่เกี่ยวข้อง

| กลุ่ม | จำนวน | สถานะ |
|---|---:|---|
| A1–A7 (พิสูจน์แล้วบนของจริง) | 7 | เปิดทั้งหมด — A1/A4 ยกเป็น **blocker**, A2/A5 high, A3 high (ไม่บล็อก CP1), A6 medium, A7 low |
| B1–B38 (ยืนยันจากโค้ด) | 38 | เปิดทั้งหมด — B2 **ขอบเขตกว้างขึ้น** เพราะ M10b-2 เพิ่ม `?new=entry` ด้วย href relative แบบเดิม |
| C1–C5 (ต้องตัดสินกับ spec) | 5 | ยังไม่ตัดสินสักข้อ |
| D1–D7 (ช่องว่างเทสต์) | 7 | เปิดทั้งหมด |

**ข้อที่รายงานนี้เพิ่มจาก QA review เดิม** (ไม่เคยถูกจับ): SW cache ยกระดับเป็น blocker เมื่อคิดในบริบท CP2 · ลิงก์ตาย 6 จุดจาก shell v3 ที่ ship หลัง QA review · task ซ้ำไม่เข้า overdue notification · adjustment ค่าลบแก้ไม่ได้ · เส้นทาง "เป้าเดือนหน้า" ที่ทำให้ core loop ตาย · ชั้นปฏิบัติการทั้งหมดใน §5

---

## 9. คำถามที่ต้องให้เจ้าของตัดสิน (ไม่ใช่บั๊ก)

1. **production deploy มาจาก branch ไหน** — merge `feat/poc` → `main` ก่อน หรือให้ Netlify ชี้ `feat/poc` โดยตรง? (ต้องตัดสินก่อน provision ทุกอย่าง เพราะทุก step ที่เหลือลงผิดที่ถ้าข้อนี้ผิด)
2. **การแจ้งเตือน overdue นับ task ซ้ำไหม** — แก้โค้ดให้ตรง Decision 2.2 หรือแก้ Decision ให้ตรงโค้ด
3. **`?next=` ควรมี allowlist ของ route หรือไม่** — หรือแค่กัน backslash ก็พอสำหรับ POC
4. **เก็บเป้าเข้ากรุ cascade ลงลูกและงานไหม** (C1 เดิม) · **task รายสัปดาห์ควรโผล่ในวัน `due_date` ของตัวเองไหม ถ้าวันนั้นไม่อยู่ใน BYDAY** (C2 เดิม)
5. **ลบ task ซ้ำควรเป็น soft delete ไหม** — หรือยอมรับว่าประวัติหายและเตือนก่อนลบ
6. **จะเปิดหมวด persona ในหน้าตั้งค่าไหม** หรือแก้ scope §5.1 ให้ตรงกับที่ทำจริง
7. **นัด CP1 วันไหน** — ถ้ายังไม่แก้เส้นทาง "เป้าเดือนหน้า" ต้องเลี่ยง 7 วันสุดท้ายของเดือน
8. **PDPA: ลบบัญชี / ส่งออกข้อมูล** — ไม่เคยอยู่ใน scope ฉบับใด ถ้า CP2 เก็บข้อมูลจริง 2 สัปดาห์ ควรตัดสินว่าจะมีหรือจะตอบด้วยมือ

---

## 10. ลำดับงานที่แนะนำ

ไม่ใช่คำสั่ง — เป็นลำดับที่คิดจาก "อะไรบล็อกอะไร"

**รอบที่ 1 — ปลดล็อกให้ field test เกิดขึ้นได้ (ตัดสิน + provision)**
ตอบคำถามข้อ 1 ใน §9 → merge/ชี้ branch → OWN-1..4 (Supabase + Resend + Netlify + LINE + GitHub secrets) → ทดสอบ OTP กับอีเมลนอกทีม 1 ครั้ง และ push LINE จริง 1 ครั้ง

**รอบที่ 2 — ปิดทางตันที่ tester จะเจอแน่ ๆ (แก้โค้ดเล็ก ผลกระทบสูง)**
`disabled: true` หรือชี้ปลายทางใหม่ให้ลิงก์ตายทั้ง 6 จุด (§4.2) → error boundary ของกลุ่ม `(auth)` + `global-error.tsx` → แยก DB error ออกจาก "ไม่มีแถว" ใน `getMe()` → guard `createFirstGoal` → `updateEntrySchema` รับค่าลบ → ซ่อนบล็อก "เลื่อนวัน" เมื่อเป็น task ซ้ำ

**รอบที่ 3 — กันข้อมูลสูญ/รั่ว**
กรอง `runtimeCaching` ไม่ให้ cache navigation/RSC ของหน้าที่ล็อกอิน + ล้าง cache ตอน sign-out → visited set ใน `buildGoalTree` + ตัด descendant ใน `candidatesFor` → soft delete หรือเตือนก่อนลบ routine ที่มีประวัติ → เขียน backup/export script อย่างน้อย 1 ตัว

**รอบที่ 4 — ให้ field test วัดผลได้จริง**
`poc-metrics.sql` นับ `goal_entries` ด้วย → ตัดสินเรื่อง task ซ้ำกับ overdue notification แล้วแก้ให้ตรง → ช่องทางให้ tester แจ้งปัญหา (แม้เป็นแค่ลิงก์ LINE ส่วนตัวในหน้าตั้งค่า) → runbook 1 หน้า (ปิด notification ยังไง, rollback ยังไง)

**รอบที่ 5 — หนี้ที่รอได้ถึงหลัง CP1**
เทสต์ของ entries + trigger · e2e ใน CI · security header · rate limit · perf budget · gap ระดับ low/info ที่เหลือทั้งหมดในภาคผนวก

---

## ภาคผนวก — รายการ gap ครบทุกข้อ (240 ข้อ)

เครื่องหมาย ⛔ = บล็อก field test · `*` ต่อท้าย id = พบโดย verifier ที่ finder มองข้าม · รายการในพื้นที่ `QA review (ตรวจซ้ำ)` ราว 36 ข้อทับกับพื้นที่อื่น (คงไว้เพื่อให้เห็นสถานะครบทุกข้อของ QA review เดิม)


### Auth & Onboarding — 11 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| high |  | ONB-BUG-1 | createFirstGoal ไม่มี guard สถานะ onboarding → กดซ้ำได้ cascade ซ้ำทั้งชุดแบบเงียบ | src/app/(auth)/onboarding/first-goal/actions.ts:18-37 — เรียก createGoalCascade(spec) ทันทีหลัง getMe() ไม่มีการตรวจ me.profile.onboarding_completed_at; src/core/profile/actions.ts:88-104 completeOnboarding ใช้ .is("onboarding_com |
| high |  | AUTH-SEC-2 | Open redirect ผ่าน ?next= ด้วย backslash ยังไม่ถูกแก้ (A3 ของ qa-review) | src/core/profile/onboarding.ts:25-29 — safeInternalPath เช็คแค่ prefix "/", "//", "/api/" ไม่กรอง backslash/tab; ค่าถูกใช้ที่ src/core/auth/actions.ts:63-64 แล้วส่งเข้า router.replace ที่ src/app/(auth)/login/login-form.tsx:89; sr |
| high |  | AUTH-SEC-3 | ออกจากระบบไม่ล้าง service worker cache — หน้าที่ล็อกอินแล้วค้าง 24 ชม. (A4 ของ qa-review) | src/app/sw.ts:22 `runtimeCaching: defaultCache` (ส่ง defaultCache ของ @serwist/next ทั้งก้อน = NetworkFirst 24 ชม. สำหรับ others/pages/pages-rsc/apis); src/core/auth/actions.ts:68-72 signOut ล้างแค่ cookie แล้ว redirect — swept ทั |
| high |  | AUTH-BUG-2 | getMe() คืน null ทั้งตอน DB error และตอนไม่มีแถว → redirect loop ระหว่าง (app)/layout กับ proxy | src/core/profile/queries.ts:32-36 — `if (error) { console.error(...); return null } if (!profile) return null` ยุบ 2 กรณีเป็นค่าเดียว; src/app/(app)/layout.tsx:15-16 redirect ไป /login เมื่อ me เป็น null; src/proxy.ts:55-60 เห็น c |
| medium |  | AUTH-UI-1 | กลุ่มเส้นทาง (auth) ไม่มี error.tsx / loading.tsx และทั้งแอปไม่มี global-error.tsx | swept src/app ด้วย find -name 'error.tsx' -o -name 'loading.tsx' -o -name 'global-error.tsx' — พบเฉพาะ src/app/(app)/error.tsx และ src/app/(app)/loading.tsx (กับ src/app/not-found.tsx) ไม่มีไฟล์ใดใต้ src/app/(auth)/ และไม่มี globa |
| low |  | ONB-SEC-1 | ด่าน persona (POC เปิดแค่ seller) และขั้นที่ 3 ของ onboarding บังคับแค่ชั้นแอป — DB grant ให้ client เขียนตรงได้ | supabase/migrations/20260905133043_user_profiles.sql:83-84 `grant update (display_name, active_persona, notify_overdue, onboarding_completed_at) on public.user_profiles to authenticated;` — check constraint บรรทัด 7-8 รับครบทั้ง 4 |
| low |  | AUTH-UX-1 | ข้อความ error ของ OTP ค้างอยู่หลังกด "เปลี่ยนอีเมล"/ย้อนกลับ | src/app/(auth)/login/login-form.tsx:104 และ 158 — onClick เรียกแค่ setStep("email") ไม่มี setServerError(null); state เดิมถูก render ต่อที่บรรทัด 200-204 ในหน้ากรอกอีเมล |
| low |  | ONB-EVT-1 | event persona.viewed ประกาศไว้ใน EVENT_TYPES แต่ไม่มีจุดใดในแอป emit เลย | src/core/events/types.ts:14,29 ประกาศ "persona.viewed" ทั้งใน EventPayloads และ EVENT_TYPES; swept ทุก emitEvent( ใน src/ พบ 8 จุด (goals/completion.ts:35, goals/actions.ts:95,260, entries/actions.ts:81, tasks/actions.ts:186,208,  |
| low |  | ONB-UI-2* | หน้า login ไม่มีตัวบอกขั้น 1/3 ทั้งที่ persona/first-goal ใช้ current 2 และ 3 | src/app/(auth)/onboarding/persona/page.tsx:18 ใช้ <OnboardingSteps current={2} /> และ first-goal/page.tsx:29 ใช้ current={3} — แต่ src/app/(auth)/login/page.tsx:1-6 กับ login-form.tsx ไม่ import OnboardingSteps เลย; src/components |
| low |  | AUTH-11* | proxy ทิ้ง query string ตอนสร้าง ?next= — deep link พร้อมพารามิเตอร์กลับมาไม่ครบหลังล็อกอิน | src/proxy.ts:51 `url.search = pathname !== "/" ? \`?next=${encodeURIComponent(pathname)}\` : ""` — ใช้แค่ pathname ทิ้ง request.nextUrl.search ทั้งก้อน (ยืนยันว่ายังไม่ถูกแก้หลัง 4 commit ล่าสุด) |
| info |  | ONB-I18N-1 | คีย์ onboarding.persona.choose ("เลือก {name}") ใน th.json ไม่ถูกใช้ที่ใด | src/messages/th.json:86 นิยาม "choose": "เลือก {name}"; rg -n "persona.choose" src/ คืนเฉพาะบรรทัดนิยามนั้น — persona-picker.tsx ใช้ t(`personas.${id}.name`) กับ t("onboarding.persona.title") เท่านั้น (persona-picker.tsx:48,75,78) |

### Goal Cascade + Progress — 17 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| high |  | GOAL-14 | การกรอง archived ต่างกันระหว่าง list กับ detail → % ของเป้าเดียวกันไม่ตรงกัน 2 หน้า | src/core/goals/queries.ts:56 (list ตัด archived ก่อนคำนวณ) เทียบกับ queries.ts:95 (`getGoalDetail` เรียก `includeArchived: true`) และ src/core/tasks/actions.ts:194 (toggleTask ใช้ includeArchived:true) — `computeProgress` (progres |
| medium |  | GOAL-13 | เป้าที่ archive แล้วหาไม่เจอในแอปอีกเลย (restore เป็น dead path หลัง 5 วินาที) | src/core/goals/queries.ts:56 (`listGoalsWithProgress` ตัด archived เป็น default) + src/app/(app)/goals/page.tsx:36 เรียกแบบไม่ส่ง `includeArchived` และไม่มี filter "เก็บเข้ากรุ" ใน FILTERS (page.tsx:23) → ปุ่มกู้คืนที่ goal-detail |
| medium |  | GOAL-15 | เป้า execution แม่ไม่ถูกปิดงานเมื่อลูกที่เป็น metric ถึง 100% | src/core/goals/completion.ts:15-42 — `markMetricCompletedIfReached` ปิดเฉพาะ goal ใบที่ส่งเข้ามา ไม่ไล่ ancestor เลย; ที่ไล่ ancestor มีที่เดียวคือ src/core/tasks/actions.ts:193-218 (เดินขึ้นด้วย while loop) ซึ่งเรียกจาก `toggleTa |
| medium |  | GOAL-17 | สร้าง parent cycle ได้ทาง server action → หน้า goal detail พังถาวร (buildGoalTree ไม่มี visited set) | src/core/goals/actions.ts:41-55 — `validateParent` ตรวจแค่ `overlaps` ไม่ตรวจชั้นของ period และไม่ไล่ ancestor chain; actions.ts:112 บล็อกแค่ `values.parentId === id`; DB trigger (migration 20260905154811:47-49) บล็อกแค่ self-pare |
| medium |  | GOAL-20 | ปุ่ม "เพิ่มงาน" บนเป้าที่ archive แล้ว สร้างงานที่ไม่ผูกเป้าเงียบ ๆ | src/app/(app)/goals/[id]/page.tsx:226 ลิงก์ `?new=task&goal={id}` แสดงทุกสถานะ (ไม่เช็ค `goal.status`) · src/components/layout/QuickAddHost.tsx:91-101 หา goal จาก `parentCandidates` ซึ่ง `listParentCandidates` ตัด archived ออกแล้ว |
| medium |  | GOAL-32* | เป้า metric ที่สำเร็จแล้วหายจากตัวเลือกของฟอร์ม "บันทึกยอด" — ขายเกินเป้าแล้วบันทึกต่อไม่ได้ | src/core/entries/queries.ts:74 `listEntryGoalOptions` ใช้ `.eq("status", "active")` ตัดทั้ง archived และ completed ทิ้ง ขณะที่ server action ฝั่งรับ (src/core/entries/actions.ts:59) บล็อกเฉพาะ archived — UI จึงเข้มกว่ากติกาจริง ·  |
| low |  | GOAL-18 | แก้เป้าที่แม่ถูก archive อยู่ = ตัดสายจากแม่แบบเงียบ ๆ | src/components/domain/GoalForm.tsx:87-89 — effect เคลียร์ `parentId` ทุกครั้งที่ค่าเดิมไม่อยู่ใน `candidates` · src/core/goals/queries.ts:118-127 `listParentCandidates` ตัด archived ออก → เปิดฟอร์มแก้แค่ชื่อ แล้วกดบันทึก `parent_i |
| low |  | GOAL-19 | เปลี่ยนช่วงเวลาของเป้าแม่ ไม่ตรวจกับลูกที่มีอยู่ | src/core/goals/actions.ts:103-135 `updateGoal` ตรวจเฉพาะความสัมพันธ์ของตัวเองกับแม่ ไม่ query ลูกเลย (ไม่มี select ที่ `parent_id = id`) |
| low |  | GOAL-21 | หน้า goal detail แสดงจำนวนงาน 2 ชุดไม่ตรงกัน | src/app/(app)/goals/[id]/page.tsx:61 (hero ใช้ `progress.tasksDone/tasksTotal` ซึ่ง progress.ts:103-113 ตัด task ซ้ำออก) เทียบกับ page.tsx:65,222 (`tasksDone = taskItems.filter(i=>i.done).length` / `taskItems.length` ที่รวม task ซ |
| low |  | GOAL-22 | เลือกเป้าแม่ในฟอร์มแล้วไม่ auto-suggest ช่วงวันที่ให้ | src/components/domain/GoalForm.tsx:265-305 — ช่อง parent เป็น Select ที่มีแต่ `field.onChange`; ไม่มีที่ไหนเรียก `normalizePeriodStart`/`suggestChildPeriods` เมื่อ parentId เปลี่ยน (มีแต่ตอนเปลี่ยน periodType ที่บรรทัด 228-234) ·  |
| low |  | GOAL-23 | ปุ่ม "เก็บเข้ากรุ" ไม่มี pending state → กดรัวได้ 2 toast | src/app/(app)/goals/[id]/goal-detail-actions.tsx:30 `const [, startTransition] = useTransition();` ทิ้งค่า isPending ทั้งที่ import มา แล้วปุ่มบรรทัด 98 ไม่มี `disabled` |
| low |  | GOAL-28 | Empty state ของ "เส้นทาง" บนหน้า goal detail เป็นข้อความเปล่า ไม่มีไอคอน/CTA | src/app/(app)/goals/[id]/page.tsx:203-206 — เมื่อ `tree.length === 0` เรนเดอร์แค่ `<div class="rounded-xl bg-bg-surface"><p>{t("progress.noChildren")}</p></div>` ต่างจาก section งานที่ผูกซึ่งใช้ `<EmptyState>` เต็มรูปแบบ (page.tsx |
| low |  | GOAL-33* | ปุ่ม "เพิ่มเป้าย่อย" บนเป้าที่ archive แล้ว เปิดฟอร์มเปล่าโดยไม่ผูกแม่ (คู่ขนานกับ GOAL-20 คนละปุ่มคนละไฟล์) | src/app/(app)/goals/[id]/goal-detail-actions.tsx:32-33 คำนวณ `addChildHref` จาก `childPeriodType(goal.period_type)` อย่างเดียว ไม่เช็ค `goal.status` (ต่างจากบรรทัด 63 ที่ปุ่ม "อัปเดตยอด" เช็ค) → ลิงก์ `?new=goal&parent=<archived i |
| low |  | GOAL-34* | กู้คืนเป้าที่เคย completed แล้วกลายเป็น active ถาวร — ไม่มีวันกลับไปเป็น "สำเร็จแล้ว" อีก | src/core/goals/schema.ts:60-63 `setGoalStatusSchema` รับ enum แค่ ["active","archived"] → ปุ่มกู้คืน (goal-detail-actions.tsx:86) เขียน `status: "active"` ทับสถานะ completed เดิม ขณะที่ `completed_at` ไม่ถูกแตะ · src/core/goals/co |
| info |  | GOAL-27 | Loading/Error state ของหน้า goals ใช้ skeleton ทรงแดชบอร์ด ไม่ใช่ทรงเนื้อหาจริง | มีแค่ src/app/(app)/loading.tsx (hero widget + widget 1 ใบ) และ src/app/(app)/error.tsx ระดับ group — ไม่มี loading.tsx/error.tsx ใต้ src/app/(app)/goals/ (find src/app -name 'loading.tsx' -o -name 'error.tsx' คืน 2 ไฟล์นี้ + src/ |
| info |  | GOAL-29 | ProgressRing มีอยู่แต่ไม่ถูกใช้ที่ไหนในแอป (design ระบุให้ใช้ใน StatTile) | grep -rn 'ProgressRing' src e2e docs → พบเฉพาะ src/components/domain/ProgressRing.tsx:21 (นิยาม) และ src/components/domain/Progress.stories.tsx:7,46-48 (Storybook) · src/components/domain/StatTile.tsx ไม่ import (grep 'ProgressRin |
| info |  | GOAL-30 | ตัวเลขไม่มี count-up 400ms ตอนค่าเปลี่ยน | swept src/ สำหรับ 'countUp/count-up/CountUp/useSpring/animate-count' — ไม่พบ; ตัวเลขบน hero (goals/[id]/page.tsx:151-155) และ CompassDial (CompassDial.tsx ส่วนตัวเลขกลางหน้าปัด) เรนเดอร์เป็นข้อความตรง ๆ. ที่มี motion คือเข็ม (Comp |

### Tasks + Recurrence — 11 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| high | ⛔ | TASK-12 | "เลื่อนวัน" บน task ซ้ำไปแก้ anchor ของทั้งชุด และ toast บอกวันที่ไม่มีทางเกิดขึ้น | src/components/domain/TaskList.tsx:263-296 บล็อกเลื่อนวัน render โดยไม่เช็ค selectedRule (บรรทัด 174 parse ไว้แล้วแต่ใช้แค่แสดงข้อความ/ฟอร์มแก้ไข) · src/core/tasks/actions.ts:129 `.update({ due_date: parsed.data.dueDate })` เขียนท |
| high | ⛔ | TASK-14 | ลบ task ซ้ำ = ประวัติติ๊กหายทั้งหมด (cascade) streak เด้งเป็น 0 ทันที | src/core/tasks/actions.ts:100-117 deleteTask = hard delete · supabase/migrations/20260905154811_goals_tasks.sql:116 task_completions.task_id references tasks on delete cascade · src/core/tasks/queries.ts:91-106 getStreak อ่านจาก t |
| medium |  | TASK-10 | ลิงก์ sidebar "งาน" และเมนูกระดิ่ง "งานค้าง N รายการ" ชี้ไป /tasks ที่ยังไม่มีหน้า → 404 | src/components/layout/nav-items.ts:38 { key: "tasks", href: "/tasks", badge: "tasks" } — ไม่มี disabled:true (มีเฉพาะ reports บรรทัด 45) · src/components/layout/Sidebar.tsx:145-150 render เป็น <Link href={item.href}> จริง · src/co |
| medium |  | TASK-13 | ติ๊ก task ซ้ำได้ในวันที่ rule ไม่ตรง / ก่อนวันเริ่ม / วันในอนาคต — toggleTask ไม่มี date guard | src/core/domain/dayplan.ts:111-131 goalTaskItems map ทุก task โดยไม่เรียก occursOn (ต่างจาก itemsForDate:53 ที่เรียก) · src/core/tasks/actions.ts:143-176 toggleTask รับ `date` เป็น isoDateSchema เฉย ๆ ไม่ตรวจกับ recurrence_rule/du |
| medium |  | TASK-17 | Query ของ tasks กลืน DB error แล้วคืนลิสต์ว่าง → "ระบบพัง" แสดงผลเหมือน "วันนี้ไม่มีงาน" | src/core/tasks/queries.ts:48-50 getDayPlan คืน { overdue: [], due: [], done: [] } เมื่อ error · :132-134 getWeekTaskStats คืน { done: 0, total: 0 } เมื่อ error · :64-76 getRangeTasks และ :78-96 getGoalTaskItems destructure เฉพาะ d |
| medium |  | TASK-18 | ปุ่ม/เมนู "เพิ่มงาน" ใช้ href="?new=task" แบบ relative → ทิ้ง ?date ของปฏิทิน ทำให้บันทึกงานผิดวัน | src/components/layout/QuickAddMenu.tsx:49 <Link href="?new=task"> (FAB มือถือใช้ตัวเดียวกันผ่าน Fab.tsx:15) · src/components/widgets/TodayTasksWidget.tsx:52,73 และ src/app/(app)/dashboard/page.tsx:75 เหมือนกัน · ต่างจากปุ่มในปฏิทิ |
| medium |  | TASK-30* | แก้ไขงานซ้ำผ่าน TaskForm ก็เลื่อน anchor ทั้งชุดเหมือนปุ่ม "เลื่อนวัน" และ label ไม่บอกว่าเป็นวันเริ่ม | src/core/tasks/actions.ts:86 `const { user_id: _ignored, ...patch } = toInsert(user.id, values)` → patch มี due_date เสมอ (toInsert :47) จึงเขียนทับ anchor ทุกครั้งที่กดบันทึกในโหมด edit · src/components/domain/TaskForm.tsx:129-13 |
| medium |  | TASK-31* | undo ของการลบงานแข่งกับ router.refresh()/reload — งานที่ลบไปโผล่กลับ หรือไม่ถูกลบจริง | src/components/domain/TaskList.tsx:105-134 remove() ซ่อนแถวด้วย override แล้วตั้ง setTimeout 5 วินาทีค่อยเรียก deleteTask · :65-68 `if (items !== prevItems) { setPrevItems(items); setOverrides({}); }` ล้าง override ทุกครั้งที่ pro |
| low |  | TASK-22 | แปลงงานเดี่ยว ↔ งานซ้ำ ทิ้งสถานะเก่าค้างไว้ (completed_at / task_completions กำพร้า) | src/core/tasks/actions.ts:76-98 updateTask เขียนทับ recurrence_rule ผ่าน toInsert (:41) โดยไม่ล้าง completed_at และไม่ลบแถว task_completions ที่เกี่ยวข้อง · ผลถูกอ่านที่ src/core/domain/dayplan.ts:60 (เดี่ยว = completed_at) และ :5 |
| info |  | TASK-21 | คอลัมน์ tasks.persona_data มีใน DB แต่ไม่มีโค้ดอ่านหรือเขียน | supabase/migrations/20260905154811_goals_tasks.sql:81 คอลัมน์ถูกสร้าง · swept src/ for "persona_data" — ทุกจุดที่ใช้จริงเป็นของ goals (unit THB) หรือเป็น fixture ใน *.stories.tsx เท่านั้น; src/core/tasks/actions.ts:41 toInsert ไม่ |
| info |  | TASK-29 | i18n key ของ tasks ที่ไม่มีผู้ใช้ (dead keys) | swept src/ (ไม่รวม *.json) for "tasks.streakLabel/tasks.sections.today/tasks.sections.upcoming/tasks.meta.today/tasks.empty.today/tasks.empty.day" — ไม่มีผลลัพธ์เลย ขณะที่ key ทั้งหมดมีอยู่ใน src/messages/th.json namespace tasks |

### ปฏิทิน + Life domain — 9 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| medium |  | CAL-G1 | FAB "เพิ่มงาน" บนปฏิทินทำ `?view=&date=` หายทั้งก้อน แล้วฟอร์ม prefill เป็นวันนี้ → บันทึกงานผิดวัน | src/components/layout/QuickAddMenu.tsx:49 `<Link href="?new=task">` (URL แบบขึ้นต้นด้วย ? แทนที่ query ทั้งก้อน) → src/app/(app)/calendar/page.tsx:30-32 อ่าน view/date ไม่เจอจึงกลับเป็น week/วันนี้ → src/components/layout/QuickAdd |
| low |  | CAL-G2 | ปิดฟอร์มเพิ่มงานบนปฏิทินแล้ววันที่ที่กำลังดูหายไป | src/components/layout/QuickAddHost.tsx:33-41 `close()` ลบทั้ง `new`, `parent`, `goal` และ `date` ออกจาก URL ทั้งที่ `date` เป็น view state ของหน้าปฏิทิน (อ่านที่ calendar/page.tsx:32) |
| low |  | CAL-G3 | ตัวเลข "N งาน" บนแถบสัปดาห์/ช่องเดือน ไม่ตรงกับรายการข้างล่าง เมื่อวันที่เลือกคือวันนี้และมีงานค้าง | src/core/domain/dayplan.ts:104 `overdue: date === today ? overdueItems(...) : []` → src/app/(app)/calendar/page.tsx:137 dayItems รวม plan.overdue และแสดงจำนวนที่บรรทัด 226 · แต่ src/components/domain/CalendarWeek.tsx:39 (`byDay[se |
| low |  | DOM-G1 | ปฏิทินบนมือถือสื่อ domain ด้วยสีอย่างเดียว ไม่มี label ข้อความและไม่มีใน aria-label | src/components/domain/CalendarWeek.tsx:76-80 (จุดสี aria-hidden ไม่มีข้อความใด ๆ ในแถบวัน) + บรรทัด 52 aria-label = "{วันที่} · N งาน" · src/components/domain/CalendarMonth.tsx:151-160 + บรรทัด 137 เหมือนกัน |
| low |  | DOM-G2 | เพิ่มงานจากเป้าที่ archive แล้ว → domain ตกกลับเป็น work เงียบ ๆ และลิงก์เป้าหลุด | src/components/layout/QuickAddHost.tsx:91,99-100 `parentCandidates.find(...)` แล้ว fallback `domain: goal?.domain ?? "work"` · src/core/goals/queries.ts:118-124 listParentCandidates กรอง `.neq("status", "archived")` จึงหาไม่เจอสำห |
| low |  | CAL-G6 | Loading skeleton ของหน้าปฏิทินเป็นทรงแดชบอร์ด ไม่ใช่ทรงปฏิทิน | src/app/(app)/loading.tsx:5-20 render WidgetSkeleton แบบ hero + widget ให้ทุกหน้าใน (app) รวมทั้ง /calendar · ไม่มี src/app/(app)/calendar/loading.tsx (find src/app -name loading.tsx → เจอไฟล์เดียว) |
| low |  | CAL-M1* | ช่วงจอ 640–1023px: มุมมองเดือนเลือกวันได้แต่ไม่มีที่แสดงงานของวันนั้น | src/hooks/use-is-mobile.ts:5 `QUERY = "(max-width: 639px)"` → src/components/domain/CalendarMonth.tsx:38 `if (!isMobile)` เข้า branch desktop ตั้งแต่ 640px · แต่ src/app/(app)/calendar/page.tsx:216-219 แผงงานขวาเป็น `hidden ... lg |
| low |  | CAL-M2* | ลิงก์ปฏิทินที่มี query หายหลัง login (`?next=` เก็บแค่ pathname) | src/proxy.ts:51 `url.search = pathname !== "/" ? "?next=" + encodeURIComponent(pathname) : ""` — ใช้เฉพาะ `pathname` ทิ้ง `request.nextUrl.search` · src/app/(auth)/login/page.tsx:5 ส่ง `next` ต่อให้ LoginForm ตามที่ได้รับ จึงกลับม |
| info |  | CAL-G5 | คีย์ i18n `calendar.emptySelected` ไม่ถูกใช้ที่ไหนเลย | src/messages/th.json:371 `"emptySelected": "ยังไม่มีงานวันนี้"` · swept src/ สำหรับ `emptySelected` — ไม่มีผู้เรียก (หน้าปฏิทินใช้ calendar.emptyDay.* แทนที่ page.tsx:140-143) |

### Dashboard + Widget — 12 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| medium |  | DASH-15 | Desktop เห็นต้นไม้มือถือก่อน hydrate แล้วสลับ (ResponsiveSwitch flash) | src/components/layout/ResponsiveSwitch.tsx:19-22 + src/hooks/use-is-mobile.ts:35 (SSR snapshot = false) → SSR ส่ง HTML ของแดชบอร์ดมือถือเสมอ; e2e/dashboard.spec.ts:26 เขียนยอมรับไว้ตรง ๆ ว่า "การ์ด v3 มีหลัง hydrate เท่านั้น (SSR  |
| medium |  | DASH-16 | Skeleton ของ desktop v3 (รูปทรงเดียวกับ content จริง) | src/app/(app)/dashboard/page.tsx:87 ใช้ `<WidgetSkeleton variant="hero" />` (ทรง hero ของมือถือ: การ์ดเดียว + วงกลม 196px, src/components/widgets/WidgetSkeleton.tsx:10-28) แทนโครง KPI 4 ใบ + กราฟ; src/app/(app)/loading.tsx:15-18 เ |
| medium |  | DASH-19 | ข้อความ "ยังไม่มีเป้าเดือนนี้" ขึ้นทั้งที่มีเป้าเดือนนี้ (แบบ execution) | src/app/(app)/dashboard/desktop-dashboard.tsx:88 `isMetric = goal?.goal_kind === "metric"` → :190 เงื่อนไข `goal && isMetric`; เมื่อ user มีเป้าเดือนนี้แบบ execution จะตกไป :339-355 ซึ่งแสดง `widgets.goalProgress.empty.title` = "ย |
| medium |  | DASH-21 | Badge เทียบเดือนก่อน/เมื่อวาน คิดคนละขอบเขตกับตัวเลขหลัก | src/app/(app)/dashboard/desktop-dashboard.tsx:94-102 เรียก `sumEntriesBetween(...)` โดยไม่ส่ง `goalId` (ทั้ง prevMonthToDate และ yesterday) ขณะที่ตัวตั้ง `total` (:104) และ `todayTotal` (:106) มาจากเป้าเดียว (`goal.progress.curren |
| medium |  | DASH-24 | การ์ด "บันทึกยอดล่าสุด" ต่อสายแบบเป้าเดียว ทั้งที่ดึงข้อมูลทั้งบัญชี | src/app/(app)/dashboard/desktop-dashboard.tsx:85 `listEntries({ limit: RECENT_LIMIT })` = ทุกเป้า แต่ :319-336 ส่ง `goalOptions=[goal เดียว]` และไม่ส่ง `showGoal` · src/components/domain/EntriesTable.tsx:216-228 กรอง `goalOptions. |
| low |  | DASH-13 | Tablet 640–1024px = 2 คอลัมน์ | src/app/(app)/dashboard/page.tsx:78 — สาขามือถือเป็น `grid gap-4` ไม่มี `md:grid-cols-2`; ResponsiveSwitch สลับที่ 1024px (src/hooks/use-is-mobile.ts:22) แปลว่า 640–1023px ได้ต้นไม้มือถือคอลัมน์เดียว (เทียบกับ src/app/(app)/goals/ |
| low |  | DASH-17 | กฎ "widget แรกบนสุดเสมอคือ goal หลักเดือนนี้" | มือถือทำตามกฎ (registry.ts:31 DEFAULT_LAYOUT = ["goal-progress", …]) แต่ desktop v3 วางแถว KPI ไว้บนสุด (desktop-dashboard.tsx:119-188) และการ์ดเข็มทิศอยู่แถว 2 คอลัมน์ที่ 9-12 (:265-308) · ตรวจ design doc แล้ว §8.4 (บรรทัด 532-53 |
| low |  | DASH-18 | Empty state ภายใน widget เมื่อยังไม่มีข้อมูล (การ์ดกราฟยอดสะสม) | src/app/(app)/dashboard/desktop-dashboard.tsx:190-263 — เงื่อนไขมีแค่ `goal && isMetric` ไม่มีการเช็ค `entries.length === 0`; src/core/domain/entries.ts:29-42 `cumulativeSeries` คืนจุดครบทุกวันที่ total = 0 → SalesChart วาดเส้นแบน |
| low |  | DASH-27 | มาร์กอัป desktop ใน `GoalProgressPanel` กลายเป็น UI ที่เข้าไม่ถึง | src/components/widgets/GoalProgressPanel.tsx:139 `hidden gap-3 lg:grid lg:grid-cols-4` (tile waypoint), :87 `lg:size-60`, :111 `hidden lg:inline` — แต่ component นี้ถูกเรียกจาก GoalProgressWidget.tsx:32 เท่านั้น ซึ่งอยู่ในสาขามือถ |
| low |  | DASH-M5* | Desktop v3 ทั้งหน้าอยู่ใต้ Suspense เดียว ไม่มี skeleton ต่อ widget | page.tsx:95-97 ห่อ DesktopDashboard ทั้งก้อนด้วย Suspense เดียว และ desktop-dashboard.tsx:79-102 await Promise.all 6+ query ก่อนคืน JSX ใด ๆ — ไม่มี Suspense/skeleton ย่อยต่อการ์ดเลย (rg "Suspense" src/app/(app)/dashboard/ = page. |
| info |  | DASH-26 | `SPAN_CLASS` / `WidgetDefinition.span` เป็นโค้ดที่ไม่มีผล | src/app/(app)/dashboard/registry.ts:26-29 นิยาม `lg:col-span-*` แต่ถูกใช้ที่ src/app/(app)/dashboard/page.tsx:81 บน container ที่เป็น `grid gap-4` (ไม่มี `lg:grid-cols-12`) และสาขานี้ไม่เคยเรนเดอร์ที่ ≥1024px หลัง hydrate (Respons |
| info |  | DASH-28 | Widget lazy-load แยก chunk ต่อ persona | swept src/ for "next/dynamic/React.lazy/dynamic(" — ไม่พบเลยแม้แต่จุดเดียว; widget ทั้งหมดเป็น Server Component ที่ import ตรงใน registry.ts:3-4 และ desktop-dashboard.tsx:33 |

### บันทึกยอด + Seller module — 10 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| high | ⛔ | ENT-1 | UI ที่ ship แล้ว 4 จุดชี้ไปหน้าที่ยังไม่มี → 404 เปล่านอก app shell | src/components/layout/nav-items.ts:35-36 (href "/entries", "/tasks"), src/components/layout/TopBar.tsx:49 (action="/search"), src/components/layout/NotificationsMenu.tsx:45 (Link "/tasks"), src/app/(app)/dashboard/desktop-dashboar |
| high | ⛔ | ENT-2 | แถว adjustment ค่าลบแก้ไขไม่ได้ — Zod บังคับ amount > 0 ทั้งที่ระบบเองเป็นคนสร้างแถวลบ | src/core/goals/actions.ts:40-48 insert `amount: delta` ซึ่งติดลบเมื่อผู้ใช้ลดยอด; src/core/entries/schema.ts:56-59 `amount .positive({ error: "positive" })` ใช้ทั้ง entryFormSchema และ updateEntrySchema (schema.ts:65-68); src/comp |
| high |  | ENT-3 | กดแก้รายการของเป้าอื่นบนตาราง dashboard แล้วได้ข้อความ "ยังไม่มีเป้าที่วัดเป็นตัวเลข" แทนฟอร์ม | src/app/(app)/dashboard/desktop-dashboard.tsx:319-331 ส่ง goalOptions = [เป้าหลักเดือนนี้] ตัวเดียว แต่ rows มาจาก listEntries() ที่ไม่กรอง goal (desktop-dashboard.tsx:85); src/components/domain/EntriesTable.tsx:219-223 กรอง `goal |
| high |  | ENT-V1* | ทุกแถวที่บันทึกจากการ์ดเข็มทิศขึ้นว่า "ปรับยอด" — data model ไม่มีอะไรแยก adjustment ออกจากยอดขายจริง | EntriesTable.tsx:126 `const isAdjustment = row.note === null;` + :142 `{row.note ?? t("entries.adjustment")}` — มี fallback เดียว; QuickEntryForm.tsx:60-64 `addEntry({ goalId, entryDate, amount })` → entries/actions.ts:70 `note: n |
| medium |  | ENT-4 | ฟอร์ม "บันทึกยอด" จาก FAB เลือกเป้าเริ่มต้นผิด — ได้เป้าเก่าสุด ไม่ใช่เป้าเดือนนี้ | src/components/layout/QuickAddHost.tsx:77 `entryGoals.find(g => g.id === goalId)?.id ?? entryGoals[0]?.id` (ไม่มีขั้น mainMonthMetric); src/core/entries/queries.ts:70-90 listEntryGoalOptions เรียง `.order("period_start")` = น้อยไป |
| low |  | ENT-5 | desktop เห็นแดชบอร์ดมือถือแวบหนึ่งก่อน แล้วค่อยสลับเป็น v3 หลัง hydrate | src/components/layout/ResponsiveSwitch.tsx:19,22 — SSR snapshot ของ useIsDesktop() เป็น false เสมอ จึงส่ง tree มือถือมาก่อนแล้วสลับหลัง hydrate; e2e/dashboard.spec.ts:26 เขียนกำกับไว้เองว่า "การ์ด v3 มีหลัง hydrate เท่านั้น (SSR ส |
| low |  | ENT-6 | backfill ของ migration ใส่ entry_date นอกช่วงของเป้าได้ → กราฟกับหน้าปัดไม่ตรงกัน | supabase/migrations/20260907090000_goal_entries.sql:74-77 ใช้ `(created_at at time zone 'Asia/Bangkok')::date` เป็น entry_date โดยไม่หนีบเข้าช่วงของเป้า; src/core/domain/entries.ts:35 cumulativeSeries กรอง `periodContains(period,  |
| low |  | ENT-7 | คอลัมน์ channel เขียนลง DB ได้ แต่ไม่มีหน้าไหนแสดงผล | src/components/domain/EntriesTable.tsx:115,152-158 เรนเดอร์คอลัมน์ช่องทางเฉพาะเมื่อ `!compact` แต่จุด mount เดียวในทรีคือ desktop-dashboard.tsx:332 ที่ส่ง `compact` → คอลัมน์ถูกซ่อนตลอด; `rg "<EntriesTable" src` เจอที่เดียว |
| low |  | ENT-V5* | ลบรายการแล้วเปลี่ยนหน้าภายใน 5 วินาที การลบจะไม่เกิดขึ้นเลยและแถวกลับมาเงียบ ๆ | src/components/domain/EntriesTable.tsx:67 `timers = useRef(new Map())` + :76-88 `setTimeout(..., UNDO_MS)` โดยไม่มี `useEffect(() => () => ...)` cleanup/flush ที่ไหนในไฟล์ (อ่านครบ 238 บรรทัด) — เมื่อ component unmount timer หายไป |
| info |  | ENT-9 | ช่องบันทึกยอดเร็ว (compact) รับเฉพาะจำนวนเต็ม ขณะที่ EntryForm รับทศนิยม | src/components/domain/QuickEntryForm.tsx:30-32 `digitsOnly` ตัดทุกอักขระที่ไม่ใช่ 0-9 ออก; src/components/domain/EntryForm.tsx:179-181 ใช้ type="number" step="any" |

### Persona อื่น (Creator/Student/Office) — 6 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| medium |  | PERS-8 | Event `persona.viewed` ประกาศ type ไว้แต่ไม่เคย emit และไม่เคยถูกอ่าน | src/core/events/types.ts:14 `"persona.viewed": { persona: string }` และ :29 อยู่ใน `EVENT_TYPES` · ไม่มี callsite: `emitEvent(` มี 8 จุดทั้ง repo (entries/actions.ts:81, goals/completion.ts:35, profile/actions.ts:97, profile/line- |
| low |  | PERS-9 | Illustration monoline ของ 4 persona ยังใช้ Lucide icon แทน | src/app/(auth)/onboarding/persona/personas.ts:12-17 `ICONS` = Lucide `Store/Clapperboard/GraduationCap/Briefcase`; src/modules/seller/persona.ts:1,10 `icon: Store` · illustration ที่วาดเองมีตัวเดียวคือเข็มทิศ: src/components/domai |
| low |  | PERS-13* | Dashboard v3 ฝั่ง desktop ข้าม registry ของ persona ทั้งก้อน — ใหญ่กว่า ternary ตายใน PERS-12 | src/app/(app)/dashboard/page.tsx:49 เรียก layoutForPersona แล้วใช้ผลเฉพาะกิ่ง `mobile` ของ ResponsiveSwitch (:82-92) · กิ่ง `desktop` (:94-98) เรียก `DesktopDashboard` ซึ่งไม่ import registry เลยและ hardcode เนื้อหา seller ล้วน (d |
| info |  | PERS-10 | คอลัมน์ tasks.persona_data มีใน DB แต่ไม่มีโค้ดอ่านหรือเขียนเลย | supabase/migrations/20260905154811_goals_tasks.sql:81 `persona_data jsonb not null default '{}'::jsonb` (ตาราง tasks); src/types/database.ts:245,258,271 มีใน type · ไม่มี hit อื่น: rg "persona_data" ทั้ง src/ ให้ผลเฉพาะ goals (goa |
| info |  | PERS-11 | i18n key `onboarding.persona.choose` ไม่มีใครเรียก | src/messages/th.json:86 `"choose": "เลือก {name}"` · rg "persona.choose" ทั่ว src ให้ผลบรรทัดเดียวคือตัว th.json เอง — persona-picker.tsx ใช้แค่ `onboarding.persona.title` (:48 aria-label ของ RadioGroup), `personas.<id>.name/descr |
| info |  | PERS-12 | ความพร้อมของสถาปัตยกรรมสำหรับ persona ที่ 2 — additive เป็นหลัก แต่มี 2 จุดต้องรื้อ | จุดที่ต้องรื้อ: (1) src/app/(auth)/onboarding/first-goal/actions.ts:22 เรียก `getMe()` แต่ไม่เคยอ่าน `me.profile.active_persona` เลย แล้ว :27 hardcode `sellerFirstGoalSpec(...)` ทั้งที่ docstring :15 เขียนว่า "app layer เป็น compo |

### LINE + Domain events + Cron — 12 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| high |  | SHR-26 | ผู้ใช้ที่ล็อกอินเขียน `domain_events` ปลอมได้ + processor เชื่อ payload และ prototype key | supabase/migrations/20260905154811_goals_tasks.sql:146 (`event_type` check แค่ `char_length between 1 and 64` ไม่มี `check (event_type in (...))`), :147 (`payload jsonb` ไม่มี constraint), :181-184 (policy insert + `grant insert . |
| high | ⛔ | SHR-M1* | task ซ้ำ (recurring) ไม่เคยเข้าการแจ้งเตือน overdue ทั้งที่ Decision 2.2 เขียนว่า "รวมทุก task" | src/core/tasks/admin.ts:18 `.is("recurrence_rule", null)` ตัด task ซ้ำออกจาก listOverdueTaskIds ทั้งหมด → scan-overdue เห็นเฉพาะงานเดี่ยว · ไม่มีเอกสารไหนบันทึกการยกเว้นนี้สำหรับ "การแจ้งเตือน" (progress.ts:9 บันทึกไว้เฉพาะเรื่อง  |
| high | ⛔ | SHR-M2* | เมนูกระดิ่งแจ้งเตือนลิงก์ไป /tasks ที่ยังไม่มีหน้าอยู่จริง | src/components/layout/NotificationsMenu.tsx:45 `<Link href="/tasks">` · find src/app -name page.tsx → มีแค่ calendar, dashboard, goals, goals/[id], settings, login, onboarding ×2, root — ไม่มี tasks/entries/search · จุดเดียวกันซ้ำ |
| medium |  | SHR-25 | Job/queue กลืน DB error → แจ้งเตือนหายทั้งวันโดยไม่ retry | src/core/profile/admin.ts:99-107 (`getProfileForNotification` คืน `data` = null ทั้งกรณีไม่มีแถวและกรณี query error) · src/core/tasks/admin.ts:13-22,28-34 (คืน `data ?? []`) · src/core/events/admin.ts:16-24 (คืน `[]` เมื่อ error), |
| medium |  | SHR-31 | LINE ที่ผูกกับบัญชีอื่นอยู่แล้ว ได้ข้อความ "รหัสไม่ถูกต้อง" และการ์ดค้าง poll จนหมดอายุ | supabase/migrations/20260905133043_user_profiles.sql:12 (`line_user_id text unique`) → src/core/profile/admin.ts:58-71 `linkLineAccount` คืน `false` เมื่อ unique violation · src/app/api/line/webhook/route.ts:90-93 ตอบ `t("linkInva |
| low |  | SHR-27 | `persona.viewed` ประกาศไว้ในสัญญา event แต่ไม่มีโค้ดไหน emit เลย | src/core/events/types.ts:14 (`"persona.viewed": { persona: string }`) และ :29 (อยู่ใน `EVENT_TYPES`) — swept src/ supabase/ e2e/ for "persona.viewed" แล้วเจอแค่ 2 บรรทัดนี้ ไม่มีจุดเรียก `emitEvent`/`insertEventAsAdmin` ด้วย type  |
| low |  | SHR-28 | ไม่มี `concurrency:` บน workflow cron → รอบตามเวลากับ `workflow_dispatch` ซ้อนกันแล้วส่งซ้ำ | rg "concurrency" over .github/workflows/ → เจอเฉพาะ ci.yml:8 · .github/workflows/cron-events.yml และ cron-scan-overdue.yml ไม่มี block `concurrency:` เลย · ฝั่งโค้ดก็ไม่มี lock: src/core/events/admin.ts:16-22 เป็น `select` ธรรมดา  |
| low |  | SHR-29 | fetch ไป LINE API ไม่มี timeout → processor เสี่ยงถูก Netlify ตัดที่ 10 วินาที | src/shared-services/notifications/line/client.ts:17-21 — `this.fetchImpl(url, { method, headers, body })` ไม่มี `signal` / `AbortSignal.timeout` · processor.ts:97-117 วน push ทีละ event แบบ sequential (batch สูงสุด 20) ภายใต้ `max |
| low |  | SHR-30 | ข้อความ LINE รายงานจำนวนงานค้างผิดเมื่อค้างเกิน 20 รายการ | src/core/tasks/admin.ts:7-11 (`listOverdueTaskIds(userId, today, limit = 20)`) และ src/shared-services/jobs/run.ts:16 เรียกโดยไม่ส่ง limit → ได้สูงสุด 20 id · src/shared-services/notifications/line/messages.ts:19 ใช้ `titles.lengt |
| low |  | SHR-32 | หน้าตั้งค่าบอกให้ตั้งตัวแปรผิดตัวเมื่อ `LINE_CHANNEL_SECRET` ไม่ได้ตั้ง | src/app/(app)/settings/page.tsx:27-37 — `lineConfig()` ห่อ `getLineEnv()` ด้วย try/catch แล้วคืน `configured: false` ซึ่ง throw ได้เฉพาะเมื่อ `LINE_CHANNEL_SECRET` หาย (schema ที่ src/lib/env.server.ts:20-25 บังคับตัวเดียวนี้) · แ |
| low |  | SHR-M3* | push "เป้าสำเร็จ" ปิดไม่ได้ — มีแต่ toggle notify_overdue ทั้งที่คำอธิบายในหน้าตั้งค่าครอบทั้งสองแบบ | src/shared-services/events/processor.ts:48-49 handleGoalCompleted เช็คแค่ profile?.line_user_id ไม่แตะ preference ใด ๆ (ต่างจาก handleTaskOverdue ที่ :65 เช็ค notify_overdue) · th.json settings.line.description = "รับข้อความเมื่อง |
| info |  | SHR-M4* | webhook ตอบ 500 (ไม่ใช่ error ที่อ่านออก) เมื่อ LINE_CHANNEL_SECRET ยังไม่ตั้ง | src/app/api/line/webhook/route.ts:38 เรียก getLineEnv() นอก try/catch (try เริ่มที่ :43 สำหรับ JSON.parse เท่านั้น) → parseEnv โยน error เมื่อ LINE_CHANNEL_SECRET ว่าง → Next คืน 500 · ต่างจาก settings/page.tsx:35 ที่ห่อ try/catch |

### Billing / Free-Pro gating — 7 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| high | ⛔ | SUB-15 | เมนู sidebar "บันทึกยอด" (/entries) และ "งาน" (/tasks) เป็นลิงก์จริงที่ชี้ไปหน้าที่ยังไม่มี → 404 | src/components/layout/nav-items.ts:35-38 `{ key: "entries", href: "/entries" }` และ `{ key: "tasks", href: "/tasks", badge: "tasks" }` ไม่มี `disabled: true`; Sidebar.tsx:142-168 render เป็น `<Link href={item.href}>`; `find src/ap |
| high | ⛔ | SUB-V1* | ลิงก์ตายนอก sidebar อีก 3 จุด — ช่องค้นหา top bar, กระดิ่งแจ้งเตือน "งานค้าง", และ "ดูทั้งหมด" บนแดชบอร์ด | src/components/layout/TopBar.tsx `<form role="search" action="/search" method="get">` (กด Enter ในช่องค้นหา desktop = 404 ทันที); src/components/layout/NotificationsMenu.tsx:45 `<Link href="/tasks">{t("notifications.overdue")}</Li |
| medium |  | SUB-12 | ข้อความขาย "Pro: เป้าหมายไม่จำกัด · รายงานสัปดาห์" สัญญาลิมิตที่ spec ไม่เคยกำหนดและโค้ดไม่มี | src/messages/th.json:51 `"pitch": "Pro: เป้าหมายไม่จำกัด · รายงานสัปดาห์"`; swept src/ supabase/ for MAX_GOALS/GOAL_LIMIT/FREE_/PRO_/planLimits/limits. — absent ไม่มีลิมิตจำนวน goal ที่ไหนเลย; scope §5.3 ระบุลิมิต Free เป็น person |
| low |  | SUB-19 | active_persona เป็นคอลัมน์เดี่ยวที่ client เขียนเองได้ — แสดง "Free = 1 persona" ไม่ได้และ bypass gate ได้ | supabase/migrations/20260905133043_user_profiles.sql:82-84 `grant update (display_name, active_persona, notify_overdue, onboarding_completed_at) on public.user_profiles to authenticated` + policy update own (บรรทัด 70-76) → user ท |
| low |  | SUB-V2* | subscription_tier ไม่มีโค้ดไหนเขียนเลย — สถานะ Pro เกิดขึ้นไม่ได้ กิ่ง isPro เป็น dead code | อ่านได้ที่เดียว src/components/layout/AppShell.tsx:28 `const tier = me.profile.subscription_tier` → ShellFrame → Sidebar.tsx:173 → ProCard.tsx:14 `const isPro = tier === "pro"`; ไม่มี insert/update ที่ไหนใน src/ supabase/ e2e/ scr |
| low |  | SUB-V3* | §8.7 touchpoint ทั้ง 3 ข้อไม่มีอยู่เป็น UI สักข้อ — touchpoint 2 ไม่มีแม้แต่หน้าจอให้ไปอยู่ | touchpoint 1 (WidgetPicker badge Pro) ไม่มี WidgetPicker — registry.ts:20-23 มี WIDGETS คงที่ 2 ตัว (defer โดย implementation-plan.md:85); touchpoint 2 (Sheet ตอนเปิด persona ที่ 2) ไม่มีที่อยู่เลย — src/app/(app)/settings/page.ts |
| info |  | SUB-22 | ไม่มี automated test คลุมจุด Pro ใด ๆ | swept e2e/ for pro/อัปเกรด/แพ็กเกจ/รายงาน — absent (เจอแต่ Promise/processed); ไม่มี src/components/layout/ProCard.stories.tsx (find src/components -name "*.stories.tsx" → มี 15 ไฟล์ ไม่มี ProCard/Sidebar) |

### Admin & Metrics — 8 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| high |  | MET-4 | DAU / การวัดการใช้งานรายวันหลัง M10a (บันทึกยอด) | supabase/queries/poc-metrics.sql:57-62 นับ DAU จาก `event_type = 'task.completed'` อย่างเดียว · path บันทึกยอดใหม่ emit `entry.logged` ที่ src/core/entries/actions.ts:81 แต่ไม่มี query ไหนอ่าน · path เดิม `updateCurrentValue` (src |
| high |  | MET-11* | Metric §14 ข้อ 2 (streak 7 วัน) มองไม่เห็น goal_entries — ตัวเดียวกับที่ใช้ตัดสิน go/no-go | supabase/queries/poc-metrics.sql:24-40 — CTE `days` union แค่ public.task_completions และ public.tasks.completed_at; grep "goal_entries/entry" ทั้งไฟล์ poc-metrics.sql = 0 บรรทัด ทั้งที่ตาราง goal_entries มี entry_date + user_id พ |
| medium |  | MET-6 | ความน่าเชื่อถือของ `domain_events` ที่เป็นฐานของ metric ทุกข้อ | ยังไม่ถูกแก้: supabase/migrations/20260905154811_goals_tasks.sql:146 (`event_type` ตรวจแค่ความยาว 1-64) + :181-185 (policy insert ตรวจแค่ `auth.uid() = user_id`, ไม่มี check ว่า event_type อยู่ในชุดที่อนุญาต) และ migration ใหม่สุด |
| low |  | MET-3 | §14 ข้อ 3 — Feedback เชิงคุณภาพ ("ต่างจาก Notion/Griply ยังไง") | swept src/ supabase/ docs/ tracking-log.md สำหรับ feedback/ฟีดแบ็ก/ความคิดเห็น/survey/nps/แบบสอบถาม — ไม่พบสักจุด; poc-metrics.sql มี 5 query ไม่มีข้อไหนแตะ metric นี้ และไม่มีสคริปต์สัมภาษณ์/ชุดคำถาม/ที่เก็บคำตอบใน docs/ |
| low |  | MET-5 | `persona.viewed` — event ที่ประกาศไว้แต่ไม่มีใครยิง | ประกาศไว้ที่ src/core/events/types.ts:14 และ :29 แต่ `rg -n "persona.viewed" src` คืนแค่สองบรรทัดนั้น — ไม่มี call site; หน้า persona picker (src/app/(auth)/onboarding/persona/persona-picker.tsx) ไม่ emit อะไรเลย |
| low |  | OPS-9* | HANDLERS ของ processor ยังหา handler จาก object literal ตรง ๆ (ครึ่งหลังของ QA A2 ที่ยังไม่แก้) | src/shared-services/events/processor.ts:79-83 นิยาม HANDLERS เป็น object literal ธรรมดา และ :98 `const handler = HANDLERS[event.event_type];` ไม่มี Object.hasOwn / ไม่มี prototype: null · :47,63 handler อ่าน payload ด้วย `as unkno |
| info |  | MET-10 | ตัวหารของ metric รวมบัญชีทดสอบ/e2e | supabase/queries/poc-metrics.sql:6 `select id as user_id, created_at as signed_up_at from auth.users` — ไม่มี where กรองอะไรเลย เช่นเดียวกับ :44-46 ที่นับ `count(*)` จาก user_profiles ทั้งตาราง |
| info |  | OPS-6 | `supabase/seed.sql` ที่ config.toml ชี้ถึงแต่ไม่มีไฟล์ | supabase/config.toml:70 `sql_paths = ["./seed.sql"]` แต่ `ls supabase/seed.sql` → No such file or directory (find supabase -type f ยืนยันว่ามีแค่ migrations/queries/templates) |

### Data model + RLS/Security — 6 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| medium |  | SEC-06 | QA A2 ยังเปิด — ผู้ใช้ที่ล็อกอินเขียน domain_events ปลอมได้ และ processor ยังไม่ validate | supabase/migrations/20260905154811_goals_tasks.sql:146 (`event_type text not null check (char_length(event_type) between 1 and 64)` — ไม่มี enum), :147 (`payload jsonb not null` — ไม่มีเพดานขนาด), :181,185 (policy+grant insert ให้ |
| low |  | DM-12 | คอลัมน์ tasks.persona_data มีใน DB แต่โค้ดไม่เคยอ่านหรือเขียน | swept src/ ด้วย rg "persona_data" — hit ที่ tasks มีเฉพาะ src/types/database.ts:245,258,271 (generated) และ fixture story src/components/domain/TaskRow.stories.tsx:17 · ฝั่ง goals เขียนจริงที่ src/core/goals/actions.ts:68 และอ่านท |
| low |  | SEC-07 | EVENT_TYPES allowlist มีอยู่แล้วแต่ไม่ถูกบังคับทั้งใน DB และใน processor | src/core/events/types.ts:20-31 ประกาศ `EVENT_TYPES` 10 ตัว `as const satisfies readonly EventType[]` · rg -n "EVENT_TYPES" src/ คืนเฉพาะบรรทัดที่ประกาศ — ไม่มี call site เลย และไม่มี check constraint ที่ migration |
| low |  | SEC-15 | คอลัมน์ jsonb ทั้งหมด (persona_data, payload) ไม่มีเพดานขนาด | goals.persona_data (20260905154811:21), tasks.persona_data (:81), domain_events.payload (:147) — ไม่มี check constraint ใดจำกัดขนาด · เทียบกับคอลัมน์ text ที่มีเพดานครบ (title 1-120/1-200, note 1-120, path 1-300, event_type 1-64) |
| low |  | DM-13* | goals.current_value กลายเป็นค่า derived ใน M10a แต่ authenticated ยัง UPDATE คอลัมน์นี้ตรงได้ | supabase/migrations/20260907090000_goal_entries.sql:53-55 ทำให้ current_value = greatest(0, sum(amount)) · แต่ 20260905154811:183 มี revoke เฉพาะ `from anon` — ไม่มี `revoke update on public.goals from authenticated` เลย จึงเหลือส |
| info |  | SEC-17 | supabase/config.toml ชี้ seed ไปไฟล์ที่ไม่มีอยู่ | supabase/config.toml:65-70 — `[db.seed] enabled = true` · `sql_paths = ["./seed.sql"]` · `ls supabase/*.sql` คืน "no matches found" (ในโฟลเดอร์มีแค่ config.toml, migrations/, queries/, templates/) |

### UI design system — 19 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| high | ⛔ | DS-39 | §8.6 Error state — กลุ่ม (auth) ไม่มี error boundary เลย | find src/app -name "error.tsx" -o -name "global-error.tsx" -o -name "loading.tsx" → ได้เฉพาะ src/app/(app)/error.tsx, src/app/(app)/loading.tsx, src/app/not-found.tsx; ไม่มี src/app/(auth)/error.tsx, ไม่มี src/app/global-error.tsx |
| medium |  | DS-09 | §2A.5 Motion เดียวที่จำได้ — เข็มแกว่ง spring overshoot 600ms | src/components/domain/CompassDial.tsx:104-106 — `transition-transform duration-[800ms] ease-[cubic-bezier(.2,.8,.2,1)]` : control point ทุกตัวอยู่ใน [0,1] จึง monotonic ไม่มี overshoot และ 800ms คือค่าของ motion "ถึงจุดหมาย" ไม่ใช |
| medium |  | DS-20 | §3.5 Contrast AA — หัวข้อหมวดใน sidebar ตก AA | src/components/layout/Sidebar.tsx:95 — `text-[11px] font-semibold … text-brand-200 uppercase` บนพื้น bg-bg-surface (ขาว): brand-200 #b9a8f5 บน #ffffff = **2.10:1** (คำนวณด้วยสูตร WCAG) ต่ำกว่าเกณฑ์ 4.5:1 และขนาด 11px ไม่เข้าข่าย l |
| medium |  | DS-40 | §8.6 Loading skeleton ใช้ทรงแดชบอร์ดกับทุกหน้า | src/app/(app)/loading.tsx:6-20 — หัวหน้า 2 บรรทัด + `WidgetSkeleton variant="hero"` + WidgetSkeleton อีกใบใน grid lg:grid-cols-2 ซึ่งเป็นทรงของแดชบอร์ด; ไม่มี loading.tsx ใน goals/, goals/[id]/, calendar/, settings/ (find ยืนยัน) |
| medium |  | DS-52 | §16 DoD — Storybook story ≥3 state ของ components/domain + components/widgets | มี story 15 ไฟล์ แต่ component ที่ยังไม่มี story เลย: EntryForm, QuickEntryForm, QuickTaskInput (ทั้งสามสร้างในรอบ M10b-2 รอบเดียวกับที่ EntriesTable/SalesChart ได้ story), Celebration, AvatarSlot, ImageSlot, PhotoViewer, TaskPhot |
| medium |  | DS-M5* | §8.6 แถว Offline — OfflineBanner ติดตั้งเฉพาะกลุ่ม (app) ไม่ครอบ login/onboarding | src/app/(app)/layout.tsx:10,28 เป็นจุดเดียวที่ mount <OfflineBanner /> · src/app/(auth)/layout.tsx ทั้งไฟล์ (20 บรรทัด) ไม่มี OfflineBanner และ src/app/layout.tsx (root) ก็ไม่มี |
| low |  | DS-04 | §2A.3 ระบบไอคอน monoline ของตัวเอง (persona 4 + domain 6) | src/app/(auth)/onboarding/persona/personas.ts:1,14-19 — persona ใช้ Lucide ล้วน (Clapperboard / GraduationCap / Briefcase + sellerPersona.icon); domain ไม่มี illustration เลย มีแค่ pill+จุดสีที่ src/components/domain/DomainTag.tsx |
| low |  | DS-05 | §2A.3 เข็มทิศ empty state หมุนเบา ๆ ครั้งเดียวตอนเข้าหน้า | src/components/domain/EmptyState.tsx:19-37 — CompassIllustration เป็น SVG static ล้วน ไม่มี class animate-* / transition / motion wrapper |
| low |  | DS-07 | §2A.4 ยอดเงินต้องเป็น "50,000 บาท" ห้ามใช้ "฿" | src/lib/format.ts:11-30 `formatTHB` ใช้ Intl style:"currency" → ตรวจด้วย node จริงได้ "฿50,000"; ไหลเข้า UI ผ่าน `formatValueWithUnit` (format.ts:43-46) ที่ GoalCard.tsx:34, GoalCascadeTree.tsx:85,91, goals/[id]/page.tsx:150,154,1 |
| low |  | DS-08 | §2A.4 / §11 ตัวเลขเปลี่ยนค่าต้อง count-up 400ms | swept src/ for "countUp/count-up/useSpring/animate(/motion./framer/from \"motion\"" — เจอที่เดียวคือ src/components/domain/Celebration.tsx:3,39 (confetti). ProgressBar.tsx:46 เปลี่ยนเฉพาะ width, CompassDial.tsx:105 เปลี่ยนเฉพาะ tr |
| low |  | DS-14 | §2A.7 Checkbox ต้องเป็นวงกลม (checkpoint บนเส้นทาง) | src/components/ui/checkbox.tsx:13 — primitive ยังเป็น `rounded-[6px]` (นอกสเกล §5.2 ที่ sm = 10px ด้วย); ความเป็นวงกลมอยู่ที่ override ของผู้เรียกเท่านั้น (src/components/domain/TaskRow.tsx:58 `rounded-full … data-[state=checked]: |
| low |  | DS-47 | §2A.5/§5.4 ห้าม confetti ทั่วจอ — แต่โค้ดมี confetti เต็มจอ 4 จุด | src/components/domain/Celebration.tsx:5,32-34 — PARTICLES = 20, `fixed inset-0 z-50` เต็มจอ; ถูกเรียก 4 จุด: GoalProgressPanel.tsx:280, TaskList.tsx:321, QuickEntryForm.tsx:112,172, goal-detail-actions.tsx:141 |
| low |  | DS-51 | §7.3/§13 ResponsiveSwitch สลับ mobile→desktop หลัง hydrate (เสี่ยง CLS) | src/components/layout/ResponsiveSwitch.tsx:24 `return useIsDesktop() ? desktop : mobile;` + คอมเมนต์ของไฟล์เอง "SSR/first paint ถือเป็นมือถือก่อนเสมอ (useIsDesktop() คืน false ตอน SSR) แล้วสลับเป็น desktop หลัง hydrate"; use-is-mo |
| low |  | DS-M1* | §2A.1 กฎ "accent ปรากฏที่เดียวบน dashboard" ถูกเจือจางเหลือ 4-5 จุด | บนหน้า /dashboard มี accent พร้อมกัน: src/app/(app)/dashboard/page.tsx:74 ปุ่มเพิ่มงาน bg-accent-500 shadow-fab · src/components/layout/QuickAddMenu.tsx:34 FAB มือถือ bg-accent-500 · src/components/layout/TopBar.tsx:35 persona pil |
| low |  | DS-M4* | §10 focus ring ทั้งแอปใช้สูตรต่างจากสเปก (ring-[3px] brand-500/30 ไม่มี offset) | src/components/layout/Sidebar.tsx:88,107 · src/components/ui/checkbox.tsx:13 · src/components/domain/GoalCard.tsx:46 · src/components/layout/TopBar.tsx (ผ่าน primitive) — ทั้งหมดเป็น `focus-visible:ring-[3px] focus-visible:ring-br |
| info |  | DS-24 | §4.2 ขนาด text-[11px] นอกสเกล 7 จุด | src/components/layout/Sidebar.tsx:95,113,198 · src/components/layout/ProCard.tsx:23 · src/components/layout/UserMenu.tsx:67 · src/components/widgets/GoalProgressPanel.tsx:182 · src/app/(app)/dashboard/desktop-dashboard.tsx:389 — ท |
| info |  | DS-27 | §5.4 พื้นหลัง card tint ตาม domain — token มีแต่ไม่มีใครอ่าน | src/components/domain/DomainTag.tsx:9,14,22,30,38,46,54 — ประกาศ field `tint` ใน type และใส่ค่าครบ 6 domain (`bg-domain-*-bg/40`) แต่ rg "tint" src/ ทั้ง repo ไม่มีผู้อ่านเลย (ImageSlot.tsx:23,51 เป็น variant คนละความหมาย); GoalCa |
| info |  | DS-35 | §7.1 Breakpoints — ช่วง tablet 640-1024px ไม่มี layout ของตัวเอง | src/hooks/use-is-mobile.ts:23 DESKTOP_QUERY = "(min-width: 1024px)" และ ResponsiveSwitch.tsx:24 `useIsDesktop() ? desktop : mobile` → หน้าจอ 640-1023px ได้ต้นไม้มือถือทั้งชุด (bottom nav, คอลัมน์เดียว, ไม่มี sidebar); นับ breakpoi |
| info |  | DS-M2* | §2A.8 ห้ามเอา compass ไปใช้นอกความคืบหน้า — แต่ถูกใช้เป็นโลโก้/ไอคอนแอป/หน้า 404 | src/components/layout/Sidebar.tsx:63-66 โลโก้ tile เป็น polygon เข็มทิศ (fill-neutral-0 + fill-accent-500) · src/app/icon.svg บรรทัด 3-5 ไอคอนแอป/PWA เป็นวงเข็มทิศ + เข็มพีชชุดเดียวกัน · src/app/not-found.tsx:11 ใช้ Lucide `Compas |

### Non-functional / PWA / Perf — 10 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| blocker | ⛔ | NFR-1 | Service worker เก็บ HTML/RSC ของหน้าที่ล็อกอินไว้ 24 ชม. และ sign-out ไม่ล้าง cache (QA A4 — ตรวจซ้ำแล้วยังอยู่ครบ) | src/app/sw.ts:22 `runtimeCaching: defaultCache` (ไม่มีการกรอง others/pages/pages-rsc/apis) · next.config.ts:8 comment ยังเขียนว่า "precache static shell, ไม่ cache การเขียน" ซึ่งไม่ตรงกับโค้ด · src/core/auth/actions.ts:68-72 `sign |
| high |  | NFR-2 | Performance budget ยังตกทั้ง LCP และ JS bundle — ต้นเหตุหลัก (ส่ง th.json ทั้งไฟล์ไป client) ยังไม่ถูกแตะ | tracking-log.md:100 (รอบ 16) บันทึกล่าสุด: `LCP 3.8→3.0s ... LCP ยังเกิน 2.5s (เหลือเรื่อง client bundle)` · tracking-log.md:93 (M7) `JS โอน ~335 KB เกิน budget 200 KB (... + messages ทั้งไฟล์)` · src/app/layout.tsx:39 `<NextIntlC |
| medium |  | NFR-3 | ไม่เคยวัด performance ซ้ำหลัง M10a/M10b และไม่เคยวัด desktop เลย — dashboard v3 สลับต้นไม้หลัง hydrate | tracking-log.md:93 และ :100 — การวัดทุกครั้งคือหน้า `/login` บนมือถืออย่างเดียว (CLS 0 จึงไม่ครอบ dashboard) · tracking-log.md บรรทัดสรุปรอบ 21 ระบุการวัดเพียง `GET /dashboard ~700 มิลลิวินาที` (server response ไม่ใช่ web vital) · |
| medium |  | NFR-4 | เขียนตอนออฟไลน์ไม่มี error state ที่ออกแบบไว้ — banner สัญญาไว้แต่ฟอร์มไม่มีทางบอกผู้ใช้ | src/messages/th.json:643 `pwa.offline` = "ไม่มีอินเทอร์เน็ต — ดูได้อย่างเดียว บันทึกได้เมื่อกลับมาออนไลน์" แต่ namespace `errors` (34 key) ไม่มี key เรื่องเน็ต/offline/network เลย · src/components/domain/QuickEntryForm.tsx:58-66 ` |
| medium |  | NFR-9* | หน้า login/OTP ออฟไลน์เด้งหน้า error ของ Next (อังกฤษ ไม่มี style) — ไม่มี error boundary ในกลุ่ม (auth) และไม่มีที่ root | src/app/(auth)/login/login-form.tsx:62-91 — `sendCode`/`submitCode` เรียก `requestOtp`/`verifyOtp` ใน startTransition โดยไม่มี try/catch · `find src/app -name 'error.tsx' -o -name 'global-error.tsx'` คืนเฉพาะ src/app/(app)/error.t |
| low |  | NFR-5 | OfflineBanner ไม่ถูก mount ในกลุ่ม (auth) — หน้า login/OTP/onboarding ออฟไลน์ไม่มี banner | src/app/(app)/layout.tsx:28 `<OfflineBanner />` เป็นจุดเดียวที่ใช้ component นี้ · src/app/(auth)/layout.tsx ทั้ง 20 บรรทัดไม่มี OfflineBanner · swept src/ for `OfflineBanner` — เจอ 2 hit เท่านั้น (นิยาม + การใช้ใน (app)/layout) |
| low |  | NFR-6 | Touch target ต่ำกว่า 44px บนมือถือหลายจุด (ปุ่ม size sm / icon-sm = 40px) | src/components/ui/button.tsx:26,29,31 — `sm: "h-10 ... md:h-9"` (40px บนมือถือ), `icon-sm: "size-10 md:size-9"` (40px), `xs: "h-7"` / `icon-xs: "size-7"` (28px) · จุดที่มือถือแตะได้จริง: src/components/widgets/TodayTasksWidget.tsx |
| low |  | NFR-7 | ไม่มีการตรวจ a11y อัตโนมัติเกิน eslint-plugin-jsx-a11y — keyboard-only flow ไม่มี regression guard | eslint.config.mjs:29 เปิด `jsxA11y.flatConfigs.recommended.rules` เป็น error (static เท่านั้น — ตรวจ contrast/ลำดับโฟกัส/touch target ไม่ได้) · swept e2e/ .storybook/ vitest.setup.ts playwright.config.ts for `axe/a11y` — absent (0 |
| low |  | NFR-10* | ไม่มี offline fallback page — เปิด PWA ตอนออฟไลน์โดยยังไม่มี cache ได้หน้า error ของเบราว์เซอร์ | src/app/sw.ts ทั้ง 26 บรรทัดไม่มี `fallbacks` ให้ Serwist · `ls src/app` ไม่มี route ชื่อ offline/~offline · src/app/manifest.ts:11 `start_url: "/dashboard"` ซึ่งเป็นหน้า dynamic ที่ไม่อยู่ใน precache manifest (precache มีแค่ /_ne |
| info |  | NFR-8 | ไม่มี rate limiting บน /api/line/webhook และ /api/cron/* (นอกจาก auth ของ Supabase) | src/lib/http/cron-auth.ts:8-15 ตรวจแค่ bearer แบบ timing-safe ไม่มีการนับ request · src/app/api/line/webhook/route.ts ป้องกันด้วย signature อย่างเดียว · ฝั่ง OTP มีของจริง: src/core/auth/actions.ts:16-20 แปลง 429/`over_email_send_ |

### Test + CI/CD + provisioning — 37 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| blocker | ⛔ | OWN-1 | Supabase `kemtit-dev` / `kemtit-staging` + Resend custom SMTP ยังไม่ provision — บล็อก CP1 | ไม่มี artifact ฝั่งรีโปที่ยืนยันได้ — .env.example:6-9 ยังเป็นช่องว่าง, supabase/ ไม่มี `.temp/project-ref`; เป็น action ฝั่งเจ้าของตาม implementation-plan:369 |
| blocker | ⛔ | OWN-2 | Netlify: import repo + env ทุกตัว + `NEXT_PUBLIC_APP_URL` จริง — ยังไม่ทำ | netlify.toml มีแค่ build config + flag uploads ต่อ context ไม่มีอะไรยืนยันว่ามี site จริง; README:31 "Hosted Supabase/Netlify/LINE accounts still need to be provisioned by the owner before field testing" |
| blocker | ⛔ | OWN-3 | LINE Developers channel + token/secret + webhook URL + Basic ID — ยังไม่ตั้ง (ทั้งระบบยัง dry-run) | .env.example:23-27 `LINE_CHANNEL_ACCESS_TOKEN=` ว่าง พร้อมคอมเมนต์ "ACCESS_TOKEN ว่าง = dry-run (log แทนส่งจริง)"; e2e/line.spec.ts:8 ใช้ secret dev ปลอม; tracking-log รอบ 18 "ยังไม่ได้ทดสอบ: ... LINE OA จริง (ยัง dry-run)" |
| blocker | ⛔ | OWN-4 | GitHub secrets `CRON_BASE_URL` / `CRON_SECRET` ยังไม่ตั้ง — cron ทั้งสองตัวยังไม่ทำงานจริง | .github/workflows/cron-events.yml:18-23 และ cron-scan-overdue.yml:17-22 ยังเข้าเส้นทาง `echo "::notice:: ... ยังไม่ตั้ง — ข้าม"; exit 0` ตราบที่ secret ว่าง |
| blocker | ⛔ | OWN-5 | ยังไม่ได้นัด/รัน CP1 (5-6 คน moderated) และ CP2 (8-10 คน 2 สัปดาห์) | ไม่มี artifact ผลการทดสอบใน repo — docs/ มีแค่ scope/design/plan/qa-review/claude-design-prompt; tracking-log ไม่มีรอบใดบันทึกผล CP0/CP1; supabase/queries/poc-metrics.sql มีอยู่แต่ไม่มีผลลัพธ์บันทึกไว้ |
| high |  | CI-1 | CI ไม่รัน e2e regression suite เลย — รันแค่ photos.spec.ts บน mobile-chrome | .github/workflows/ci.yml:19-45 job `check` = lint/typecheck/test/build เท่านั้น; ci.yml:85 job `e2e-uploads` รัน `playwright test e2e/photos.spec.ts --project=mobile-chrome` ไฟล์เดียว project เดียว — onboarding/goals/tasks/dashboa |
| high |  | CI-2 | ไม่มีอะไร gate deploy — Netlify build ไม่ผูกกับผล CI | netlify.toml:3-5 `command = "pnpm build"` ไม่มี lint/typecheck/test และไม่มี `[build] ignore` หรือเงื่อนไขใด ๆ ที่อ้างสถานะ GitHub Actions |
| high |  | TEST-4 | trigger ที่ทำให้ `goals.current_value` เป็นค่า derived ไม่มี automated test | supabase/migrations/20260907090000_goal_entries.sql มี trigger แต่ไม่มีไฟล์เทสต์ SQL ใด ๆ ใน repo (ดู TEST-3); src/core/domain/entries.test.ts:1-16 import เฉพาะ `./entries` และ `./periods` ไม่แตะ DB; tracking-log รอบ 19 บันทึกว่าต |
| high |  | M10-6 | UI ใหม่ของ dashboard v3 ส่วนใหญ่ไม่มี e2e — ครอบแค่การ์ดเข็มทิศ | e2e/dashboard.spec.ts:26-35 ครอบเฉพาะ region "เข็มทิศเดือนนี้" (กรอกยอด → toast → 50%) และ :40-55 งานวันนี้; ไม่มี assertion ใดแตะ SalesChart, StatTile KPI, EntriesTable (แก้/ลบ/undo) หรือ `?new=entry`. swept e2e/ ด้วย "SalesChart |
| high |  | QAD-5 | ไม่มีเทสต์ cycle ของ `candidatesFor` / `buildGoalTree` (บั๊ก A1 ที่ทำ goal detail พังถาวร) | swept src/core/goals/ และ src/**/*.test.ts ด้วย "cycle/วนลูป/visited" — absent; ไม่มีไฟล์ *.test.ts ใน src/core/goals/ เลย (มีแค่ actions/candidates/completion/queries/schema.ts) |
| medium |  | CI-3 | ไม่มี Lighthouse CI ทั้งที่ design §15 บังคับ "ทุก PR" — perf budget ที่เกินอยู่ไม่มีตัวกัน regression | swept ทั้ง repo (ยกเว้น node_modules/docs/storybook-static) ด้วย `rg -i "lighthouse/lhci/axe-core/playwright-lighthouse"` — เจอเฉพาะใน tracking-log กับคอมเมนต์ globals.css ไม่มี config/workflow/devDependency ใด ๆ |
| medium |  | CI-4 | workflow cron `exit 0` เงียบเมื่อยังไม่ตั้ง secrets — CI เขียวทั้งที่ไม่มีการแจ้งเตือนเกิดขึ้นจริง | .github/workflows/cron-events.yml:18-23 และ cron-scan-overdue.yml:17-22: `if [ -z "$BASE_URL" ] ... echo "::notice:: ... ข้าม"; exit 0` |
| medium |  | CI-6 | Storybook build ไม่อยู่ใน CI ทั้งที่ acceptance ทุก phase ของแผน M10 ระบุไว้ | rg "storybook" over .github/workflows/ci.yml netlify.toml → ไม่พบ; package.json:15 มีสคริปต์ `build-storybook` แต่ไม่มี job เรียก |
| medium |  | TEST-1 | ไม่มีเครื่องมือวัด coverage เลย ทั้งที่ M2 กำหนด ≥ 90% | swept package.json (ไม่มี `@vitest/coverage-v8`/`@vitest/coverage-istanbul` และไม่มีสคริปต์ `test:coverage`), vitest.config.mts:9-14 (ไม่มี key `coverage`), ci.yml (ไม่มี flag `--coverage`) — absent |
| medium |  | TEST-2 | ไม่มี component test (.test.tsx / React Testing Library) สักไฟล์ | `find src -name "*.test.tsx"` → 0 ไฟล์; test ทั้ง 17 ไฟล์เป็น `.ts` ของ pure function/service ล้วน แม้ devDependencies จะมี @testing-library/react, jest-dom, user-event ติดตั้งไว้แล้ว |
| medium |  | TEST-3 | ไม่มี RLS test ด้วย SQL / pgTAP ทั้งที่ M2 ระบุเป็นเงื่อนไขผ่าน | swept `supabase/` (มีแค่ migrations/ 5 ไฟล์, queries/poc-metrics.sql, templates/, config.toml) และ `find . -name "*.test.sql" -o -name "*_test.sql"` → absent; rg "pgtap/supabase test" ทั้ง repo → absent |
| medium |  | M10-1 | server action ของ entries (addEntry / updateEntry / deleteEntry) ไม่มีเทสต์เลยสักชั้น | src/core/entries/actions.ts:43,97,143 export 3 action; swept src/ e2e/ ด้วย "addEntry/updateEntry/deleteEntry" — ผู้เรียกมีแค่ EntryForm.tsx:12,98 และ EntriesTable.tsx:10,79 ไม่มีไฟล์ *.test.ts หรือ *.spec.ts อ้างถึงเลย |
| medium |  | M10-2 | query ของ entries (listEntries / sumEntriesBetween / getEntryStreak / listEntryGoalOptions) ไม่มีเทสต์ | src/core/entries/queries.ts:16,42,70,95,113 export 5 ตัว; ผู้เรียกคือ desktop-dashboard.tsx:85,93,94,101 เท่านั้น; swept src/**/*.test.ts และ e2e/ ด้วยชื่อทั้ง 5 — absent |
| medium |  | M10-3 | `entryStatus` / `entryCode` ใน core/entries/schema.ts ไม่มีเทสต์ | src/core/entries/schema.ts:33 `entryStatus`, :38 `entryCode`; src/core/domain/entries.test.ts:1-16 import เฉพาะ 9 function จาก `./entries` (sumAmounts…percentChange) ไม่มี schema.ts; rg "entryStatus/entryCode" over src/**/*.test.t |
| medium |  | M10-4 | `markMetricCompletedIfReached` (core/goals/completion.ts) ไม่มีเทสต์ และยังเป็น read-then-write ตาม QA B19 | src/core/goals/completion.ts:15 export function เดียวของไฟล์; swept src/**/*.test.ts ด้วย "markMetricCompletedIfReached/completion" — absent |
| medium |  | QAD-1 | `e2e/line.spec.ts` รวมยอด `sent` ของ user ทุกคนแล้ว break เร็ว — regression ของ task.overdue อาจผ่านได้ | e2e/line.spec.ts:79-90 — `let sent = 0; for (…40) { … sent += summary.sent; if (summary.fetched === 0 // sent >= 1) break; } expect(sent).toBeGreaterThanOrEqual(1)` ยังเป็นแบบเดิมทุกบรรทัด |
| medium |  | QAD-2 | `isAuthorizedCron` ไม่มี unit test (secret ว่าง, scheme ผิด, `bearer` ตัวเล็ก) | src/lib/http/cron-auth.ts:8 `export function isAuthorizedCron`; `ls src/lib/http/` → มีแค่ cron-auth.ts ไม่มีไฟล์ test; swept src/**/*.test.ts ด้วยชื่อฟังก์ชัน — absent; e2e/line.spec ครอบแค่เคสไม่มี header |
| medium |  | QAD-3 | ไม่มี test ของ route `/api/line/webhook` (รหัสหมดอายุ, unique violation, source ที่ไม่ใช่ user) | `find src/app -name "*.test.ts"` → 0 ไฟล์; swept src/**/*.test.ts ด้วย "webhook" — absent; e2e/line.spec.ts ครอบเฉพาะ signature ผิด → 401 และ happy path ผูกบัญชี |
| medium |  | QAD-4 | `scan-overdue.test.ts` มีเคสเดียว (happy path) | src/shared-services/jobs/scan-overdue.test.ts — `describe("scanOverdue")` มี `it` เดียว: "สร้าง event เฉพาะ user ที่มีงานค้าง และ mark วันที่แจ้ง" |
| medium |  | QAD-6 | `onboarding.test.ts` ไม่ครอบ backslash ใน `safeInternalPath` (open redirect A3) | src/core/profile/onboarding.test.ts:29-30 มีเฉพาะ `https://evil.example` และ `//evil.example` — ไม่มีเคส `\\evil.example` หรือ `/\\evil.example` |
| medium |  | CI-7* | e2e/qa/localhost-qa.spec.ts ผ่านเสมอแม้ทุก step ล้ม — false green ใน suite | e2e/qa/localhost-qa.spec.ts:41-54 `async step(name, fn)` ห่อ `await fn()` ด้วย try/catch แล้ว push finding status "fail" **โดยไม่ rethrow**; :58-71 `report()` เขียนไฟล์ markdown + `console.log` ไม่มี `expect` สักบรรทัด; playwright |
| medium |  | CI-8* | build ใน CI ไม่ใช่ build ที่ deploy — ข้าม env validation ที่ Netlify รันจริง | .github/workflows/ci.yml:21 ตั้ง `SKIP_ENV_VALIDATION: "1"` + ค่า placeholder (:24-25 `https://placeholder.supabase.co` / `"placeholder"`) ขณะที่ netlify.toml ไม่มีตัวแปรนี้ในทุก context (บรรทัด 7-23) → src/lib/env.ts:15 `return p |
| medium |  | CI-9* | e2e ตัวเดียวที่ CI รัน ทดสอบ flag ที่ไม่เคยขึ้น production | .github/workflows/ci.yml:56 job `e2e-uploads` ตั้ง `NEXT_PUBLIC_FLAG_UPLOADS: "1"` แต่ netlify.toml:13-23 ปัก `"0"` ทั้ง production/deploy-preview/branch-deploy/dev — จึงไม่มี e2e run ใดใน CI ที่รันด้วย flag state ที่ tester จะเจอ |
| medium |  | CI-10* | ไม่มีอะไรจับ drift ระหว่าง migration กับ src/types/database.ts | src/types/database.ts เป็นไฟล์ generated ที่ commit ไว้ (มี goal_entries อยู่แล้ว 2 จุด) และถูกใช้เป็น generic ของทุก client — src/lib/supabase/server.ts:17 `createServerClient<Database>`, client.ts:9, admin.ts:17 — แต่ package.js |
| low |  | CI-5 | cron workflow ไม่มี `concurrency` — รอบที่ค้างซ้อนรอบใหม่ได้ | rg "concurrency" over .github/workflows/ → เจอที่ ci.yml:8 ที่เดียว; cron-events.yml และ cron-scan-overdue.yml ไม่มี block นี้ |
| low |  | TEST-5 | `supabase/seed.sql` ไม่มีในรีโป ทั้งที่ config.toml ชี้ไปที่ไฟล์นี้ | supabase/config.toml:70 `sql_paths = ["./seed.sql"]`; `ls supabase/seed.sql` → No such file or directory |
| low |  | M10-5 | `getWeekTaskStats` และ `monthShort` ที่เพิ่มในรอบ 21 ไม่มีเทสต์ | swept src/ e2e/ ด้วย "getWeekTaskStats/monthShort" แล้วกรองเฉพาะไฟล์ test/spec — absent (format.test.ts มี 9 เคสแต่ไม่มี monthShort) |
| low |  | M10-7 | component ใหม่รอบ 21 หลายตัวไม่มี Storybook story ตาม DoD ≥ 3 state | `find src -name "*.stories.tsx"` → 15 ไฟล์ มี SalesChart.stories.tsx และ EntriesTable.stories.tsx แต่ไม่มีของ QuickEntryForm.tsx, QuickTaskInput.tsx, EntryForm.tsx, CompassDial.tsx, StatTile.tsx (ทั้งหมดอยู่ใน src/components/domai |
| low |  | M10-10 | 3 spec (onboarding / line / photos) ยังไม่เคยรันกับ tree v3 — locator อ่านแล้วน่าจะรอด แต่ยังไม่พิสูจน์ | tracking-log รอบ 21 ระบุ 4 spec; e2e/onboarding.spec.ts:38 พึ่ง toast "บันทึกยอดแล้ว" บน /goals/[id] (goal detail v2 ยังไม่ทำ จึงไม่กระทบ), e2e/line.spec.ts แตะเฉพาะ /settings + API, e2e/photos.spec.ts:35,96 ใช้ region "งานวันนี้" |
| low |  | QAD-7 | `dayplan.test.ts` มีแค่ 3 เคส — ไม่ครอบเคสติ๊กในวันที่ rule ไม่ตรง (A6) | src/core/domain/dayplan.test.ts — `describe("buildDayPlan")` 2 เคส + `describe("goalTaskItems")` 1 เคส; fixture มี FREQ=DAILY (anchor อดีต/อนาคต) และ FREQ=WEEKLY;BYDAY=SA แต่ `goalTaskItems` ทดสอบเฉพาะ "สถานะวันนี้" ไม่มีเคสวันที่ |
| low |  | REL-2 | tracking-log ข้ามรอบ 20 — ไม่มีบันทึกของ M10b-1 (desktop shell v3) ในไฟล์ | grep หัวข้อใน tracking-log.md — :168 "รอบ 19 — M10a" แล้วข้ามไป :178 "รอบ 21 — M10b-2"; ขณะที่ git log มี commit `18c881b M10b-1: desktop shell v3` และ `68d6edf M10b-1 follow-up` อยู่จริง |
| low |  | CI-11* | `format:check` มีสคริปต์แต่ไม่มี job ใดเรียก — Prettier drift ไม่ถูกจับ | package.json:13 `"format:check": "prettier --check ."` มีอยู่ แต่ .github/workflows/ci.yml:41-44 รันแค่ lint/typecheck/test/build — swept .github/ ด้วย "prettier/format" — absent |

### Route & Navigation — 3 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| medium |  | NAV-M1* | ไม่มี not-found boundary ในกลุ่ม (app) — notFound() จากเป้าหมายที่ถูกลบเด้ง user ออกนอกโครงแอป | src/app/(app)/goals/[id]/page.tsx:46 `if (!detail) notFound();` แต่ `find src/app -name 'not-found.tsx'` พบไฟล์เดียวคือ src/app/not-found.tsx (ระดับ root) — boundary ที่ใกล้ที่สุดจึงเป็น root ซึ่งห่อด้วย src/app/layout.tsx เท่านั้ |
| medium |  | NAV-M2* | login ?next= ไม่มี allowlist ของ route — proxy สร้าง ?next=/entries เองแล้วโยน user ไป 404 ทันทีหลัง OTP ผ่าน | src/proxy.ts:48-52 สร้าง `?next=${encodeURIComponent(pathname)}` ให้ทุก path ที่ไม่ public; src/core/profile/onboarding.ts:25-29 `safeInternalPath` กันแค่ path ที่ไม่ขึ้นต้น "/", ขึ้นต้น "//" และ "/api/" — ไม่ตรวจว่า route มีจริง; |
| low |  | NAV-G8 | หน้า 404 อยู่นอก route group (app) — ทางตันไม่มี sidebar/bottom nav | src/app/not-found.tsx:9 `<main className="mx-auto flex min-h-dvh ... ">` อยู่ที่ src/app/ ไม่ใช่ src/app/(app)/ จึงใช้แค่ root layout — ไม่มี AppShell; ทางออกเดียวคือ src/app/not-found.tsx:15 `<Link href="/dashboard">` |

### QA review 2026-09-06 (ตรวจซ้ำ) — 62 ข้อ

| ระดับ | FT | id | รายการ | หลักฐาน |
|---|:-:|---|---|---|
| blocker | ⛔ | A1 | เป้าหมายวนลูป (parent cycle) ทำให้หน้า goal detail พังถาวร | src/core/goals/queries.ts:80-84 buildGoalTree ยังไม่มี visited set · src/core/goals/actions.ts:41-55 validateParent ตรวจแค่ overlaps ไม่ตรวจชั้น period และไม่ไล่ ancestor · :113 บล็อกแค่ parentId===id · src/core/goals/candidates.t |
| blocker | ⛔ | A4 | Service worker เก็บหน้าที่ล็อกอินแล้วไว้ 24 ชม. และ sign-out ไม่เคยล้าง | src/app/sw.ts:22 `runtimeCaching: defaultCache` ยังส่งทั้งก้อน · next.config.ts:8-13 ไม่มีการกรอง · src/core/auth/actions.ts:68-72 signOut ล้างแค่ cookie |
| high |  | A2 | ผู้ใช้ที่ล็อกอินเขียน domain_events ปลอมได้ และ processor เชื่อ payload + prototype key | supabase/migrations/20260905154811_goals_tasks.sql:145 `check (char_length(event_type) between 1 and 64)` อย่างเดียว · :185 `grant insert on public.domain_events to authenticated` · src/shared-services/events/processor.ts:47,63 ca |
| high |  | A3 | Open redirect ผ่าน ?next= ตอนล็อกอิน | src/core/profile/onboarding.ts:25-28 safeInternalPath ยังเป็น prefix check (`//`, `/api/`) ไม่กัน backslash/tab · src/core/auth/actions.ts:63-64 ใช้ค่าที่ผ่าน check นี้ต่อ |
| high |  | A5 | Feature flag uploads คุมแค่ชั้นแอป — storage policy กับ grant avatar_path ยังเปิดอยู่ | supabase/migrations/20260906120000_photos.sql:10 `grant update (avatar_path) ... to authenticated` · :86 policy "photos: insert own folder" · 20260906180000_uploads_private.sql:11,16 policy select/update own folder ยังอยู่ · src/l |
| high |  | TRACK-1 | รายการ QA review ไม่เคยถูกติดตามที่ไหนนอกจากไฟล์ markdown เดียว | rg "qa-review" ทั้ง repo คืนผลเดียวคือ tracking-log.md:156 · ไม่มี .github/ISSUE_TEMPLATE, ไม่มีไฟล์ชื่อ *issue* ใน repo · docs/implementation-plan.md:361-364 "Known issues" เป็นของรีวิวเจ้าของโปรเจกต์รอบ 11 คนละชุด · ไม่มี TODO/F |
| high | ⛔ | QA-1* | เมนู sidebar หลัก 2 ใน 5 รายการ (/entries, /tasks) ชี้ไปหน้าที่ยังไม่มี — ได้ 404 | src/components/layout/nav-items.ts:35 `{ key: "entries", href: "/entries", icon: NotebookPen }` และ :36 `{ key: "tasks", href: "/tasks", icon: CheckSquare, badge: "tasks" }` อยู่ในกลุ่ม primary ที่ render เป็นลิงก์จริง เทียบกับ :4 |
| high |  | QA-2* | ไฟล์ QA review ทั้งฉบับยังไม่ถูก commit เข้า git — tracking-log ชี้ไปหาไฟล์ที่ไม่อยู่ใน repo | `git ls-files docs/` คืน 4 ไฟล์: implementation-plan.md, kemtit-full-scope.md, kemtit-ui-design-system.md, plans/2026-09-06-design-turn6-7-sales-log.md — ไม่มี qa-review-2026-09-06.md · `git status --short docs/` → `?? docs/qa-rev |
| medium | ⛔ | A6 | หน้า goal detail ให้ติ๊ก task ซ้ำในวันที่ rule ไม่ตรง (และก่อนวันเริ่ม) | src/core/domain/dayplan.ts:110-130 goalTaskItems map task ซ้ำทุกตัวโดยไม่เรียก occursOn · src/core/tasks/actions.ts:143-183 toggleTask รับ date อะไรก็ได้ ไม่ตรวจ rule · src/app/(app)/goals/[id]/page.tsx:43,233 ป้อน items เข้า Task |
| medium |  | B1 | Job/queue กลืน DB error → แจ้งเตือนหายทั้งวันโดยไม่ retry | src/core/profile/admin.ts:99-107 คืน data (undefined ตอน error) · src/core/tasks/admin.ts:13-22 `return (data ?? []).map(...)` · src/core/events/admin.ts:16-25 `return data ?? []` และ :54-57 insertEventAsAdmin แค่ console.error ·  |
| medium | ⛔ | B2 | ปุ่ม FAB / เมนูเพิ่ม ล้าง query string ตอนเปิดฟอร์ม → งานถูกบันทึกผิดวัน | src/components/layout/QuickAddMenu.tsx:49,55,61 ยังเป็น `href="?new=task"` / `"?new=goal"` / `"?new=entry"` แบบ relative ล้วน · src/app/(app)/goals/page.tsx:68,84 `href="?new=goal"` (หน้าปฏิทินยังทำถูกที่ calendar/page.tsx:58,107, |
| medium | ⛔ | B3 | ปิดฟอร์มเพิ่มงานบนปฏิทิน แล้ววันที่ที่ดูอยู่หายไป | src/components/layout/QuickAddHost.tsx:33-41 close() ยังมี `next.delete("date")` ที่บรรทัด 38 · src/app/(app)/calendar/page.tsx:31 อ่าน date จาก searchParams เป็น view state |
| medium |  | B4 | goal ถึง 100% แล้วไม่ถูกปิดงาน ถ้าไม่ได้มาจากการติ๊ก task | src/core/tasks/actions.ts:193-219 (execution) และ src/core/goals/completion.ts:26 (metric ผ่าน entry) เป็นสองจุดเดียวที่ตัดสิน completed_at · path ที่ยังไม่ settle: deleteTask (tasks/actions.ts:100-117), updateTask (:76-98), updat |
| medium |  | B5 | เป้าที่เก็บเข้ากรุถูกนับใน rollup เฉพาะบางหน้า | src/core/goals/queries.ts:56 (list ตัด archived) vs :95 getGoalDetail ใช้ includeArchived:true · src/core/tasks/actions.ts:194 toggleTask ก็ includeArchived:true · src/core/domain/progress.ts:90-116 resolve ไม่กรอง status |
| medium |  | B6 | แก้เป้าที่แม่ถูก archive อยู่ = ตัดสายจากแม่แบบเงียบ ๆ | src/components/domain/GoalForm.tsx:87-89 effect เคลียร์ parentId ทุกครั้งที่ค่าเดิมไม่อยู่ใน candidates · src/core/goals/queries.ts:118-127 listParentCandidates ยัง `.neq("status","archived")` · src/core/goals/actions.ts:61 toInse |
| medium |  | B7 | "เลื่อนวัน" บน task ซ้ำไปแก้ anchor ของทั้งชุด และ toast บอกวันที่งานไม่มีวันโผล่ | src/components/domain/TaskList.tsx:263-296 ปุ่ม "พรุ่งนี้/สัปดาห์หน้า/เลือกวัน" แสดงโดยไม่เช็ค selected.recurring · src/core/tasks/actions.ts:119-137 rescheduleTask เขียน due_date ตรง ๆ |
| medium |  | B8 | ลบ task ซ้ำ = ลบประวัติติ๊กทั้งหมด streak เด้งเป็น 0 | src/core/tasks/actions.ts:100-117 deleteTask เป็น hard delete · supabase/migrations/20260905154811_goals_tasks.sql task_completions ผูก `on delete cascade` · src/core/tasks/queries.ts:98-115 getStreak รวมจาก task_completions |
| medium |  | B9 | Redirect loop ระหว่าง (app)/layout กับ proxy.ts เมื่อ getMe() คืน null | src/core/profile/queries.ts:32-36 ยุบ DB error เป็น `return null` · src/app/(app)/layout.tsx:15-16 `if (!me) redirect(ROUTES.login)` · src/proxy.ts:55-60 authenticated + /login → redirect /dashboard |
| medium | ⛔ | B10 | createFirstGoal ไม่มี guard สถานะ onboarding → เปิด 2 แท็บได้ cascade ซ้ำ | src/app/(auth)/onboarding/first-goal/actions.ts:22-23 เช็คแค่ `getMe()` แล้วสร้างต่อเลย ไม่มี `nextRouteFor(me.profile)` gate · ตาราง goals ไม่มี unique บน (user_id, period_type, period_start) |
| medium |  | B11 | ไม่มี error boundary เหนือ (app)/layout.tsx และไม่มีเลยใน (auth) | `find src/app -name error.tsx -o -name global-error.tsx` คืนแค่ src/app/(app)/error.tsx ไฟล์เดียว — ไม่มี src/app/error.tsx, src/app/global-error.tsx, src/app/(auth)/error.tsx · src/app/(app)/layout.tsx:15 เรียก getMe() ที่ข้างในไ |
| medium |  | B12 | useIsMobile ใช้ 639px แต่ shell ใช้ lg (1024px) และ SSR snapshot เป็น mobile เสมอ | src/hooks/use-is-mobile.ts:5 `QUERY = "(max-width: 639px)"` และ :18 server snapshot `() => true` (ไม่เปลี่ยน) · src/components/ui/responsive-dialog.tsx:24 ยังสลับ component ด้วย useIsMobile() · BottomNav.tsx:22 / Fab.tsx:14 ใช้ `l |
| medium |  | B13 | แถบ waypoint บน desktop โชว์ 3 สัปดาห์แรกเสมอ ป้าย "อยู่ตรงนี้" หายไปช่วงปลายเดือน | src/components/widgets/GoalProgressPanel.tsx:34 `MAX_TILES = 3` · :66-68 `[...waypoints].sort(period_start ascending).slice(0, MAX_TILES)` ไม่สนว่าวันนี้อยู่สัปดาห์ไหน · :141 เงื่อนไข current = periodContains(wp.period, today) |
| medium |  | C1 | เก็บเป้าเข้ากรุ ไม่ cascade ลงลูกและงาน | src/core/goals/actions.ts:139-159 setGoalStatus update แถวเดียว · sweep docs/kemtit-full-scope.md และ docs/kemtit-ui-design-system.md ด้วย rg "archive/เก็บเข้ากรุ/กรุ" — ไม่มีบรรทัดไหนกำหนด semantics ของ archive เลย |
| medium |  | C2 | task รายสัปดาห์ไม่โผล่ในวัน due_date ของตัวเอง ถ้าวันนั้นไม่อยู่ใน BYDAY | src/core/domain/recurrence.ts:34-39 occursOn ตี due_date เป็นขอบล่าง (`if (isBeforeISO(date, anchor)) return false`) · supabase/migrations/20260905154811_goals_tasks.sql:86 comment เขียนว่า "due_date เป็นวันแรกของ task ซ้ำ" |
| medium |  | C3 | Batch 20 event ต่อรอบ อาจเกิน budget 10 วินาทีของ Netlify | src/shared-services/events/processor.ts:11 `EVENT_BATCH_SIZE = 20` · :97-117 loop `for (const event of events)` ทำงานเรียงทีละตัว · src/shared-services/notifications/line/client.ts:17-21 fetch ไม่มี AbortSignal/timeout |
| medium |  | C4 | ไม่มี lock/claim บน event ที่ดึงมา และ workflow ไม่มี concurrency | src/core/events/admin.ts:16-22 เป็น select ธรรมดา ไม่มี update-claim · .github/workflows/cron-events.yml:6-7 และ cron-scan-overdue.yml:6-7 มี schedule + workflow_dispatch แต่ไม่มี `concurrency:` (มีแต่ใน ci.yml:8) |
| medium |  | D1 | ไม่มีเทสต์ route ของ webhook สำหรับรหัสหมดอายุ / unique violation / source ที่ไม่ใช่ user | ไม่มีไฟล์ `src/app/api/line/webhook/route.test.ts` · e2e/line.spec.ts:39 มีแต่ `source: { type: "user", userId }` (happy path) — rg "expired/unique/23505/group/room" over e2e/line.spec.ts ไม่พบ |
| medium |  | D6 | onboarding.test.ts ครอบ //evil.example แต่ไม่ครอบ backslash/tab | src/core/profile/onboarding.test.ts:26-33 มี 5 assertion: "/goals/1", "https://evil.example", "//evil.example", "/api/cron/x", null — ไม่มี `/\evil.com` หรือรูปที่มี tab |
| medium |  | D7 | ไม่มีเทสต์ cycle ของ candidatesFor / buildGoalTree | rg "candidatesFor/buildGoalTree" over src/ --include=*.test.ts คืนผลว่าง (NONE) — ไม่มีไฟล์ test ของ src/core/goals/ เลยในรายการ 19 ไฟล์ |
| medium |  | QA-3* | แดชบอร์ด desktop ทั้งหน้าเป็นการสลับต้นไม้หลัง hydrate — first paint เป็นเลย์เอาต์มือถือแล้วเปลี่ยนทั้งหน้า | src/components/layout/ResponsiveSwitch.tsx:22 `return useIsDesktop() ? desktop : mobile` · src/hooks/use-is-mobile.ts:35 server snapshot ของ useIsDesktop คือ `() => false` → HTML ที่ส่งออกเป็นต้นไม้มือถือเสมอ · src/app/(app)/dashb |
| low |  | A7 | formatPercent ปัด 99.5%+ ขึ้นเป็น "100%" ทั้งที่ยังไม่ถึงเป้า | src/lib/format.ts:37-39 ยังใช้ Intl percent maximumFractionDigits 0 (ปัดขึ้น) ไม่มี Math.floor · call site: CompassDial.tsx:144, ProgressBar.tsx:64, GoalCard.tsx:31, GoalCascadeTree.tsx:88, GoalProgressPanel.tsx:263 |
| low |  | B14 | PNG พื้นโปร่งใสถูกแปลงเป็น JPEG จนได้พื้นดำ | src/hooks/use-photo-upload.ts:31 pass-through รับเฉพาะ `file.type === "image/jpeg"` · :42-44 `canvas.toBlob(resolve, "image/jpeg", 0.85)` ไม่มีการเติมพื้นขาวก่อน drawImage |
| low |  | B15 | งานที่รอ undo กลับมาโผล่ ถ้ามีอะไร refresh ภายใน 5 วิ | src/components/domain/TaskList.tsx:64-68 `if (items !== prevItems) { setPrevItems(items); setOverrides({}) }` ล้าง override ทั้งหมดเมื่อ props เปลี่ยน · :105-134 remove() ยังตั้ง timer 5 วิแยกจาก override |
| low |  | B16 | สถานะ completed ไม่เคย reconcile กับ progress | src/core/goals/actions.ts:139-159 setGoalStatus เขียน status อย่างเดียว ไม่แตะ completed_at · src/core/goals/schema.ts:60-63 setGoalStatusSchema รับแค่ active/archived · src/app/(app)/goals/[id]/page.tsx:111-123 (badge "สำเร็จแล้ว |
| low |  | B17 | streak เกิน 61 วันไม่ได้ (ดึงย้อนหลังแค่ 60 วัน) | src/core/tasks/queries.ts:96 `const STREAK_LOOKBACK_DAYS = 60;` · :100-108 getStreak query `.gte("completed_on", since)` ด้วย since = today − 60 |
| low |  | B18 | หน้า goal detail แสดงจำนวนงาน 2 ชุดไม่ตรงกัน | src/app/(app)/goals/[id]/page.tsx:61 hero ใช้ `goal.progress.tasksDone/tasksTotal` · :222 หัวข้อใช้ `taskItems.length` · src/core/domain/progress.ts:102 `countable = own.filter(t => t.recurrence_rule === null)` ตัด task ซ้ำออกจาก  |
| low |  | B19 | เขียน completed_at แบบ read-then-write → 2 request พร้อมกันได้ goal.completed ซ้ำ | src/core/goals/completion.ts:20-30 select goal → เช็ค `!typed.completed_at` → update `.eq("id", goalId)` ไม่มี `.is("completed_at", null)` · src/core/tasks/actions.ts:200-206 pattern เดียวกัน |
| low |  | B20 | ข้อความ LINE บอกจำนวนงานค้างผิด — cap ที่ 20 แต่รายงานเป็นยอดรวม | src/core/tasks/admin.ts:10 `limit = 20` ใน listOverdueTaskIds · src/shared-services/notifications/line/messages.ts:19 `t("overdue", { count: titles.length, ... })` ใช้ความยาวของรายการที่ถูก cap แล้ว |
| low |  | B21 | LINE ที่ผูกกับบัญชีอื่นอยู่แล้ว ถูกรายงานว่า "รหัสไม่ถูกต้อง" และการ์ด poll ต่อจนหมดอายุ | src/core/profile/admin.ts:58-71 linkLineAccount คืน `!error` (unique violation = false ไม่แยกสาเหตุ) · src/app/api/line/webhook/route.ts:90-93 `replyText(..., linked ? t("linkSuccess") : t("linkInvalid"))` · src/app/(app)/settings |
| low |  | B22 | Webhook ตอบข้อความจาก group/room ด้วย (ไม่เช็ค source.type === "user") | src/app/api/line/webhook/route.ts:65-66 เช็คแค่ `event.source?.userId` · :79-95 handle message โดยไม่ดู `source.type` |
| low |  | B23 | หน้าตั้งค่าบอกให้ไปตั้งตัวแปรผิดตัวเมื่อไม่ได้ตั้ง LINE_CHANNEL_SECRET | src/app/(app)/settings/page.tsx:27-38 lineConfig() catch ทุก error ของ getLineEnv() เป็น `configured:false` · :93-95 render `t("line.noBasicId")` · src/messages/th.json:403 ข้อความระบุ NEXT_PUBLIC_LINE_OA_BASIC_ID · src/lib/env.se |
| low |  | B24 | ไม่จำกัดช่วงปี — ?date=0050-06-15 หัวข้อขึ้น "มิถุนายน 2493" | src/lib/date.ts:29-35 `ISO_DATE = /^\d{4}-\d{2}-\d{2}$/` + isISODate เช็คแค่ regex กับ NaN ไม่จำกัดช่วงปี · src/lib/format.ts:97-101 monthYear formatter (LOCALE_BUDDHIST) |
| low |  | B25 | ปุ่ม "เพิ่มงาน" บนเป้าที่ archive แล้ว สร้างงานที่ไม่ผูกเป้าเงียบ ๆ และ domain กลับเป็น work | src/app/(app)/goals/[id]/page.tsx:226,246 ปุ่ม `?new=task&goal=${goal.id}` แสดงแม้ goal.status === "archived" · src/components/layout/QuickAddHost.tsx:91 หา goal จาก parentCandidates (มาจาก listParentCandidates ที่ตัด archived) →  |
| low |  | B26 | เปลี่ยนช่วงเวลาของเป้าแม่ ไม่ตรวจกับลูกที่มีอยู่ | src/core/goals/actions.ts:104-136 updateGoal ตรวจแค่ parent (`validateParent`) ไม่เคย query ลูกของ id ที่กำลังแก้ |
| low |  | B27 | ปุ่ม "เก็บเข้ากรุ" ไม่มี pending state → ดับเบิลคลิกได้ 2 toast | src/app/(app)/goals/[id]/goal-detail-actions.tsx:30 `const [, startTransition] = useTransition();` ทิ้งค่า isPending · :98 `<Button variant="ghost" onClick={archive}>` ไม่มี disabled |
| low |  | B28 | ตัวเลขงานบนแถบสัปดาห์/ช่องเดือน ไม่ตรงกับรายการข้างล่าง | src/app/(app)/calendar/page.tsx:135 `byDay = itemsByDay(...)` (ไม่รวมงานค้างยกมา) vs :136 `dayItems = [...plan.overdue, ...plan.due, ...plan.done]` · CalendarWeek.tsx:39 selectedCount จาก byDay · :89-91 แสดง tasksCount · CalendarM |
| low |  | B29 | scan-overdue วนดู 25 คนเดิมทุกวัน — ไม่มี order/cursor | src/core/profile/admin.ts:110-121 listOverdueScanCandidates มีแต่ `.limit(limit)` ไม่มี `.order(...)` และไม่มี cursor · src/shared-services/jobs/scan-overdue.ts:34-36 คนที่ไม่มีงานค้างถูก `continue` โดยไม่ mark |
| low |  | B30 | ข้อความ error ของ OTP ค้างอยู่หลังกด "เปลี่ยนอีเมล" | src/app/(auth)/login/login-form.tsx:104 และ :158 `onClick={() => setStep("email")}` ไม่เรียก setServerError(null) · :200-204 หน้ากรอกอีเมล render serverError |
| low |  | B31 | proxy สร้าง ?next= จาก pathname อย่างเดียว ทิ้ง query string | src/proxy.ts:51 `url.search = pathname !== "/" ? \`?next=${encodeURIComponent(pathname)}\` : ""` — ไม่รวม request.nextUrl.search |
| low |  | B32 | Sidebar ที่พับไว้ animate จากกางเป็นพับทุกครั้งที่โหลดหน้า | src/components/layout/ShellFrame.tsx:48 `useSyncExternalStore(subscribe, readCollapsed, () => false)` server snapshot = กางเสมอ · :63 `transition-[padding] duration-200` · src/components/layout/Sidebar.tsx:45 `transition-[width] d |
| low |  | B33 | loading.tsx ใช้ grid 2 คอลัมน์ แต่แดชบอร์ดจริงเป็นโครงอื่น → skeleton กระโดด | src/app/(app)/loading.tsx:15 `grid gap-4 lg:grid-cols-2` + WidgetSkeleton hero/list · src/app/(app)/dashboard/page.tsx:82-98 ตอนนี้เป็น ResponsiveSwitch → desktop-dashboard.tsx (KPI 4 ใบ + กราฟ + การ์ดเข็มทิศ + ตาราง) · :84 มือถือ |
| low |  | B34 | Install hint ไม่ขึ้นบน iPadOS 13+ | src/components/layout/InstallHint.tsx:61-62 `const isIOS = /iphone/ipad/ipod/i.test(navigator.userAgent); if (!isIOS && !canPrompt) return null;` |
| low |  | B35 | ข้อความไทย hardcode นอก th.json | src/app/manifest.ts:8-10 name/short_name/description เป็นไทยตรง ๆ · src/lib/format.ts:43,52 คำว่า "บาท" hardcode |
| low |  | B36 | TASK_PHOTO_LIMIT เป็น read-then-insert ไม่มี constraint ใน DB | src/core/photos/actions.ts:68-73 count แล้วค่อย insert (ไม่ atomic) · supabase/migrations/20260906120000_photos.sql:23-31 ตาราง task_photos ไม่มี constraint/trigger จำกัดจำนวน (comment :31 เขียนเองว่า "บังคับที่ action") |
| low |  | B37 | ข้อความใต้ปุ่มแนบรูปบอก "JPG, PNG" ทั้งที่ WebP รองรับทุกชั้น | src/messages/th.json:658 `"attachHint": "JPG, PNG · ไม่เกิน 10 MB ต่อรูป"` ขณะที่ :450 `"photoType": "รองรับเฉพาะ JPG, PNG, WebP"` และ bucket allowed_mime_types (photos.sql:83) รับ image/webp |
| low |  | B38 | ไฟล์ค้างใน bucket ถ้าปิดแท็บระหว่าง PUT สำเร็จกับ attachPhoto | src/hooks/use-photo-upload.ts:107-120 upload สำเร็จ → เรียก attachPhoto → ลบไฟล์เฉพาะกรณี `!result.ok` (ไม่มี cleanup ถ้า process ตายกลางทาง) |
| low |  | C5 | config.toml ชี้ seed ไปที่ไฟล์ที่ไม่เคยมี | supabase/config.toml:65-70 `[db.seed] enabled = true` + `sql_paths = ["./seed.sql"]` · `ls -la supabase/` แสดงแค่ config.toml, migrations/, queries/, templates/, .branches/, .temp/ — ไม่มี seed.sql |
| low |  | D2 | ไม่มีเทสต์ isAuthorizedCron (secret ว่าง, scheme ผิด, bearer ตัวเล็ก) | `isAuthorizedCron` อยู่ที่ src/lib/http/cron-auth.ts และถูกอ้างถึงจากแค่ 2 route (process-events, scan-overdue) — ไม่มีไฟล์ cron-auth.test.ts ในรายการ test ทั้ง 19 ไฟล์ |
| low |  | D3 | scan-overdue.test.ts มีแต่ happy path | src/shared-services/jobs/scan-overdue.test.ts มี `it(...)` ตัวเดียว: "สร้าง event เฉพาะ user ที่มีงานค้าง และ mark วันที่แจ้ง" — ไม่มีเคส insert ล้มเหลว |
| low |  | D4 | e2e/line.spec.ts รวมยอด sent ของ user ทุกคนแล้ว break ที่ตัวแรกที่ส่งได้ | e2e/line.spec.ts:75-90 `sent += summary.sent; if (summary.fetched === 0 // sent >= 1) break;` แล้ว `expect(sent).toBeGreaterThanOrEqual(1)` |
| low |  | D5 | dayplan.test.ts ครอบแค่ DAILY ที่ anchor อยู่ในอดีต | src/core/domain/dayplan.test.ts:47-51 describe("goalTaskItems") ใช้ task เดียว `recurrence_rule: "FREQ=DAILY"` due_date 2026-09-01 — ไม่มีเคส WEEKLY/BYDAY |
| info |  | LOG-1 | tracking-log ขาดรายการ "รอบ 20" ของ M10b-1 (desktop shell v3) | grep -n "^## " tracking-log.md แสดง "รอบ 19" (บรรทัด 168) แล้วข้ามไป "รอบ 21" (บรรทัด 178) · commit 18c881b (M10b-1) และ 68d6edf (follow-up) ไม่มี entry · grep -n "รอบ 20" tracking-log.md คืนผลว่าง |

---

*รายงานนี้ผลิตด้วย multi-agent workflow (35 agent: 16 survey + 16 adversarial verify + 3 completeness critic) — ทุกข้อในหมวด gap ผ่านรอบหักล้างที่ใช้คำค้นชุดอื่น และทุกข้อในหมวด deferred มี citation ของเอกสารที่เลื่อนไว้*
