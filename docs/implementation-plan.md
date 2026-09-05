# Kemtit — Implementation Plan (POC)

- **วันที่**: 2026-09-05
- **สถานะ**: รอรีวิว/อนุมัติ — ยังไม่เริ่ม implement
- **อ้างอิง**: `docs/kemtit-full-scope.md` (เรียกย่อว่า *Scope*) และ `docs/kemtit-ui-design-system.md` (เรียกย่อว่า *Design*)
- **ขอบเขต**: POC ตาม Scope §11 เท่านั้น — core goal cascade + task + persona Seller เดียว + LINE notification พื้นฐาน + dashboard layout คงที่ + ไม่มี billing

---

## ส่วนที่ 1 — วิเคราะห์เอกสาร

### 1.1 สรุปความเข้าใจ (10 บรรทัด)

1. Kemtit คือ PWA planner ภาษาไทย ที่รวม "เป้าธุรกิจ" กับ "ชีวิตส่วนตัว" ไว้ในระบบเดียว ผ่าน Goal Cascade (ปี → ไตรมาส → เดือน → สัปดาห์ → วัน) และ task เป็นหน่วยปฏิบัติการเล็กสุด ทุก goal/task ติด 1 ใน 6 life domain
2. Stack ตัดสินใจแล้ว: Next.js App Router + TypeScript บน Netlify, Supabase (Postgres + RLS, Auth email OTP, Storage), Zod validate ทุก input, Tailwind CSS v4 + shadcn/ui, next-intl (`messages/th.json`), Serwist สำหรับ PWA
3. Architecture = modular monolith: `core/` (goals, tasks, shared kernel) / `modules/*` (persona ละหนึ่ง module) / shared services (notifications, billing) — `modules/*` ห้าม import กันเอง คุยผ่าน `core/ports` หรือ `domain_events` เท่านั้น
4. Side effect (LINE, billing) ไม่ทำใน request หลัก แต่เขียนแถวลง `domain_events` แล้วให้ cron (GitHub Actions → Route Handler) มาประมวลผลเป็น batch เล็ก ๆ แล้ว mark `processed_at`
5. Dashboard = widget registry กลาง + layout ต่อ user (react-grid-layout บน desktop, stack แนวตั้งบนมือถือ) — แต่ใน POC ใช้ layout คงที่ ยังไม่ drag-drop
6. Persona แรก (beachhead) = Seller: เป้ายอดขายรายเดือนผูกกับ cascade, บันทึกยอดขายจริงรายวัน, widget "ยอดขาย vs เป้า", checklist ประจำร้านที่ซ้ำทุกวัน
7. UX หลัก: mobile-first บังคับ, bottom nav 4 แท็บ + FAB, onboarding 3 ขั้นจบใน 90 วินาที (OTP → เลือก persona → goal แรกจาก template), ทุกการลบใช้ undo toast ไม่ใช่ confirm
8. Design system: brand lavender + semantic token (component ห้ามใช้ hex ดิบ), IBM Plex Sans Thai line-height ≥1.7, radius ใหญ่กว่าปกติ, เงาสี brand, motion เฉพาะตอบสนอง user, ข้อความทั้งหมดผ่าน i18n, ตัวเลขผ่าน formatter, DoD 9 ข้อต่อ component
9. Admin ใน POC/MVP = Supabase Studio; วัดผล POC ด้วย 3 metric (สร้าง goal แรกได้เองใน session แรก, ทำ task ต่อเนื่อง 7 วัน, อธิบายความต่างจาก Notion/Griply ได้)
10. ตั้งใจไม่ทำ: AI (เปิด port `core/ports/ai-suggestion.ts` ไว้แต่ไม่ implement), native app, LINE Login, admin UI, หลายภาษา, dark mode UI จริง, drag-drop บนมือถือ, custom theme, mascot/gradient/glassmorphism

### 1.2 จุดที่เอกสารยังไม่ชัด หรือขัดแย้งกันเอง — คำถามที่ต้องตัดสินใจ

รูปแบบแต่ละข้อ: **เอกสารว่าอย่างไร → ทำไมสำคัญ → ตัวเลือก → ที่ผมแนะนำ** (ถ้ายังไม่ตอบ ผมจะใช้ "ที่แนะนำ" เป็นสมมติฐานตาม §2.1)

#### กลุ่ม A — ขอบเขต POC ที่ 2 เอกสารตีความไม่ตรงกัน

**Q1. "Dashboard แบบ fixed layout" หมายถึงอะไรกันแน่**
- Scope §11: fixed layout "ยังไม่ drag-drop" — แต่ Design §8.4 บอกว่า user เปลี่ยนตำแหน่ง widget ได้, ลบ widget หมดต้องมี EmptyState, มีปุ่ม "เพิ่ม widget" เปิด `WidgetPicker`, และ `WidgetShell` มี drag handle + menu; schema มีตาราง `dashboard_layouts`
- สำคัญเพราะ: กำหนดว่าต้องมี `dashboard_layouts`, `WidgetPicker`, เมนูใน `WidgetShell` ใน POC หรือไม่ (ต่างกัน ~2-3 วัน)
- ตัวเลือก: (a) คงที่จริง — ลำดับ widget ของ persona อยู่ใน code, ไม่มีเพิ่ม/ลบ/ย้าย, ยังไม่สร้าง `dashboard_layouts` / (b) กึ่งคงที่ — เพิ่ม/ลบ/ซ่อน widget ได้ผ่าน `WidgetPicker` แต่ไม่ลาก → ต้องมี `dashboard_layouts` ตั้งแต่ POC
- **แนะนำ (a)** — แต่เขียน widget registry และ `WidgetShell` ให้มี slot สำหรับ handle/menu ที่ยังไม่ render เพื่อให้ MVP ต่อ react-grid-layout ได้โดยไม่แก้ widget

**Q2. Widget ชุดไหนอยู่ใน POC และซ้อนทับกันตรงไหน**
- Design §6.3: seller = `SalesVsGoalWidget`, `ShopChecklistWidget`; ทุก persona = `TodayTasksWidget`, `GoalProgressWidget`, `DailyLifeWidget` → รวม 5 widget
- ปัญหา 3 จุด: (1) สำหรับ seller "goal หลักเดือนนี้" คือเป้ายอดขาย ดังนั้น `GoalProgressWidget` กับ `SalesVsGoalWidget` จะโชว์สิ่งเดียวกัน (2) ถ้า checklist ร้านเป็น recurring task, `TodayTasksWidget` จะโชว์ซ้ำกับ `ShopChecklistWidget` (3) `DailyLifeWidget` "สรุป domain ชีวิตส่วนตัว" ยังไม่นิยามว่าสรุปตัวเลขอะไร
- **แนะนำ**: POC มี 4 widget เรียงคงที่ — `SalesVsGoal` (บนสุด) → `TodayTasks` (ไม่รวม task ประจำร้าน) → `ShopChecklist` (เฉพาะ task ที่ `persona_data.seller.routine = true`) → `GoalProgress` (goal ที่เหลือทั้งหมดของเดือนนี้ รวม life domain เรียงตาม domain) — ตัด `DailyLife` ออกจาก POC เพราะข้อมูลซ้ำกับ `GoalProgress` เว้นแต่จะนิยามให้ต่างชัดเจน

**Q3. ปฏิทิน (Multi-view Calendar) อยู่ใน POC หรือไม่**
- Scope §5.1 ระบุ calendar 4 มุมมองใน Core และ bottom nav มีแท็บ "ปฏิทิน" — แต่ §11 บอก POC = "goal cascade + task" ไม่พูดถึงปฏิทิน
- ต้นทุน: 4 มุมมองประมาณ 4-5 วัน (มุมมอง "ปี" ยากสุดและมีค่าน้อยสุดใน POC)
- ตัวเลือก: (a) ตัดออก, nav เหลือ 3 แท็บ / (b) เฉพาะ "สัปดาห์" (7 วัน เริ่มอาทิตย์, task/goal เป็นจุดสี domain) ~1.5 วัน / (c) สัปดาห์ + เดือน ~3 วัน / (d) ครบ 4
- **แนะนำ (b)** — "งานสัปดาห์นี้" คือสิ่งที่แม่ค้าใช้จริง ส่วนปี/ไตรมาสดูจาก cascade tree ได้อยู่แล้ว

**Q4. Recurring task รองรับแค่ไหน และเก็บประวัติการทำเสร็จอย่างไร**
- Scope §5.1: recurring ด้วย RRULE; Seller checklist = "task ซ้ำรายวัน" — แต่ schema `tasks` มี `completed_at` ค่าเดียวต่อแถว → task รายวัน 1 แถวบอกไม่ได้ว่า "เสร็จวันนี้แต่ยังไม่เสร็จพรุ่งนี้" และ metric §14 "ทำ task ต่อเนื่อง 7 วัน" ต้องมีประวัติรายวัน
- ตัวเลือก: (a) เพิ่มตาราง `task_completions(task_id, completed_on date)` แล้ว expand occurrence ใน app ตามช่วงวันที่ / (b) cron สร้าง task instance ล่วงหน้าทุกวัน (แถวเยอะ, ต้องแยก template กับ instance) / (c) เทียบ `completed_at` กับวันนี้ (ไม่มีประวัติ — ไม่ผ่าน §14)
- **แนะนำ (a)** และ UI รองรับแค่ "ทุกวัน" กับ "ทุกสัปดาห์ (เลือกวัน)" แต่เก็บเป็น RRULE string subset (`FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=MO,WE`) เพื่อขยายเป็น RRULE เต็มทีหลังโดยไม่ต้อง migrate

**Q5. Offline: "จะบันทึกเมื่อกลับมาออนไลน์" (Design §8.6) = offline write queue**
- ข้อความ banner นี้สัญญาว่ามี queue การเขียน + replay + จัดการ conflict = offline-first sync ราว 1-2 สัปดาห์ และขัดกับการใช้ Server Actions
- **แนะนำ**: POC = PWA ติดตั้งได้ + banner "ไม่มีอินเทอร์เน็ต" แบบอ่านอย่างเดียว (ปุ่มบันทึก disabled) ไม่ queue การเขียน — แก้ข้อความ banner ใน `th.json` ให้ตรงความจริง

**Q6. Gesture บนมือถือ (swipe ลบ, long-press เลื่อนวัน) อยู่ใน POC หรือไม่**
- Design §8.5 ระบุไว้ — บนเว็บต้องเขียน touch handler เอง กัน scroll ชน และทดสอบหลายเครื่อง (~1-1.5 วัน)
- **แนะนำ**: POC ใช้ "แตะแถว → Sheet" ที่มีปุ่ม ติ๊ก / เลื่อนวัน (พรุ่งนี้, สัปดาห์หน้า, เลือกวัน) / ลบ+undo — function ครบเท่ากัน — แล้วเติม swipe เป็น polish ท้าย M6 ถ้าเหลือเวลา

**Q7. Persona picker ตอนมี persona เดียว**
- Design §8.3: 4 card บังคับเลือก ไม่มีปุ่มข้าม — แต่ POC มี seller เดียว
- ตัวเลือก: (a) ข้ามขั้นนี้ set seller อัตโนมัติ / (b) โชว์ 4 card แต่ 3 ใบ disabled พร้อม label "เร็ว ๆ นี้"
- **แนะนำ (b)** — ได้ signal ว่า tester อยากได้ persona ไหน (log event `persona.viewed`) โดยแทบไม่เพิ่มงาน

#### กลุ่ม B — กฎธุรกิจ/ข้อมูลที่ยังไม่ได้นิยาม (กระทบ schema — แก้ทีหลังแพง)

**Q8. Progress rollup คิดอย่างไร (สำคัญที่สุด)**
- Scope §5.1: "คำนวณ % ของ goal แม่จาก goal/task ลูกอัตโนมัติ" — แต่ `goals` มี `target_value`/`current_value` ที่ seller "กรอกมือ"
- ขัดกัน 2 จุด: ถ้ามี trigger คำนวณ `current_value` จาก task ลูก มันจะทับยอดขายที่กรอกมือ; และการติ๊ก "แพ็คของ" เสร็จไม่ควรทำให้ % ยอดขายขยับ
- **กฎที่เสนอ**:
  - goal มี 2 แบบโดยดูจาก `target_value`: **metric goal** (มี target) → `% = min(current / target, 1)` ไม่สน task; **execution goal** (ไม่มี target) → `%` = ค่าเฉลี่ยน้ำหนักเท่ากันของ "child goal แต่ละตัว (ใช้ % ของมัน)" และ "task ที่ผูกตรงแต่ละตัว (เสร็จ = 100, ไม่เสร็จ = 0)"; ไม่มีลูกเลย = 0%
  - คำนวณตอนอ่านด้วย pure function `core/goals/progress.ts` (มี unit test) ไม่ใช้ DB trigger; `current_value` ของ seller goal เป็น cache ที่ server action เขียนทับหลังบันทึกยอดขาย (ดู Q10)
  - `goal.completed` = ครั้งแรกที่ % ถึง 100 → set `goals.completed_at` (ต้องเพิ่มคอลัมน์) + `status = 'completed'` + insert `domain_events` ครั้งเดียว; ลดต่ำกว่า 100 ทีหลังไม่ยิงซ้ำ ไม่ reopen ใน POC
  - `status` enum: `active | completed | archived`
  - "ตกเป้า" (Design §8.2 สี warning) = `% จริง < % เวลาที่ผ่านไปของ period − 10 จุด` เฉพาะ goal ที่ยัง active
- ต้องการ: ยืนยันกฎนี้ หรือกำหนดใหม่

**Q9. ระดับ cascade ที่แสดงใน POC และ "auto cascade" หมายถึงอะไรเมื่อไม่มี AI**
- Scope Flow A ข้อ 5: "ระบบ cascade goal ปีนั้นอัตโนมัติเป็น task รายวันตัวอย่าง" — แต่ Design §8.3 onboarding ขั้น 3 สร้าง goal ระดับ **เดือน** ("ยอดขายเดือนนี้ [__] บาท") ไม่ใช่ปี และ AI ถูกตัดออก
- enum `period_type` มี 5 ระดับ; goal ระดับ "วัน" ซ้ำหน้าที่กับ task และทำให้ tree ลึกเกินจะดูบนมือถือ
- **เสนอ**: POC UI แสดง **ปี → เดือน → สัปดาห์** (goal) + **task** (หน่วยวัน); เก็บ `quarter`/`day` ไว้ใน enum แต่ไม่โชว์ใน form; "auto cascade" = template: สร้างเป้าเดือน X บาท → สร้าง week goal ลูกอัตโนมัติสำหรับทุกสัปดาห์ (เริ่มอาทิตย์) ที่ทับเดือนนั้น target แบ่งตามจำนวนวัน + seed checklist ร้าน 4 รายการ; **ไม่**สร้าง goal ปีอัตโนมัติ แต่ nudge "ตั้งเป้าทั้งปี" ในหน้า goal detail
- ต้องตัดสินใจ: (1) ซ่อน quarter/day ใน POC หรือไม่ (2) template สร้าง week goal อัตโนมัติหรือไม่ (3) onboarding ถามเป้าเดือนตาม Design (แนะนำ) หรือเป้าปีตาม Scope

**Q10. ยอดขายรายวันเก็บที่ไหน**
- Scope §5.2: "บันทึกยอดขายจริงรายวัน — กรอก `current_value` manual" และ widget เป็น "กราฟแท่ง" — ถ้าเก็บแค่ `current_value` จะวาดกราฟรายวันไม่ได้ และ import CSV (Phase 2) ไม่มีที่ลง
- **เสนอ**: ตาราง `seller_sales_entries(id, user_id, goal_id, entry_date, amount, note, created_at)` ใน seller module + RLS; `goals.current_value` ของเป้าเดือนและ week goal ลูก = sum ตามช่วงวันที่ (write-through ใน server action เดียวกัน)
- ต้องการ: ยืนยัน

#### กลุ่ม C — LINE และ infrastructure

**Q11. LINE แจ้งเตือนอะไรบ้างใน POC**
- Scope §5.3: "ใกล้ครบกำหนด หรือทำเป้าสำเร็จ"; Flow C ทำเฉพาะ `goal.completed`; §12 เรียกว่า "LINE reminder พื้นฐาน"; task มีแค่ `due_date` (ไม่มีเวลา) → "ใกล้ครบกำหนด" ได้แค่ระดับ "วันนี้/พรุ่งนี้"
- ตัวเลือก: (a) congrats เมื่อ goal สำเร็จ / (b) digest ตอนเช้า "งานวันนี้ N รายการ · ค้าง M · เป้าเดือนนี้ X%" / (c) เตือนรายตัวต่อ task
- **แนะนำ (a) + (b)** เวลา 07:30 Asia/Bangkok ปิดได้ในตั้งค่า; ไม่ทำ (c) — (b) คือตัวขับ retention 7 วันตาม §14 และเป็นข้อความเดียวต่อวันต่อคน (ประหยัด quota ดู R1)

**Q12. ผูก LINE กับบัญชีอย่างไรเมื่อไม่มี LINE Login**
- `user_profiles.line_user_id` มีใน schema แต่ไม่มี flow ใดในเอกสารที่ได้ค่านี้มา — Messaging API ให้ `userId` ผ่าน webhook เท่านั้น
- **เสนอ flow มาตรฐาน**: ตั้งค่า → "เชื่อม LINE" → แสดงรหัส 6 ตัว (หมดอายุ 10 นาที) + ปุ่ม/QR เพิ่มเพื่อน OA → user พิมพ์รหัสส่งในแชท → webhook (ตรวจ `X-Line-Signature`) จับคู่รหัส → บันทึก `line_user_id` → reply ยืนยัน (reply message ไม่กิน quota) → หน้าเว็บ poll สถานะทุก 3 วิ
- ต้องมี: Route Handler webhook สาธารณะ, คอลัมน์ `line_link_code` / `line_link_code_expires_at`, ปิด auto-reply ใน LINE OA Manager — ประมาณ 1.5 วัน ที่เอกสารไม่ได้นับ
- ต้องการ: ยืนยัน flow

**Q13. Cron cadence — GitHub Actions ทำ "ทุก ~2 นาที" ไม่ได้**
- GitHub Actions schedule ขั้นต่ำ 5 นาที และในทางปฏิบัติดีเลย์ 5-30 นาทีช่วง load สูง; หยุดเองหลัง 60 วันไม่มี commit (เอกสารรู้แล้ว)
- ตัวเลือก: (a) คง GitHub Actions ตาม decision log — ยอมรับ congrats ช้า 5-30 นาที และ digest เช้าอาจคลาดเวลา / (b) Supabase `pg_cron` + `pg_net` ยิง Route Handler เดิม ทุก 1 นาที ตรงเวลา ไม่มีปัญหา 60 วัน — trade-off: ตารางเวลาอยู่ใน migration, secret เก็บใน Supabase Vault, log ดูใน `cron.job_run_details` แทน GitHub UI / (c) Netlify Scheduled Functions — ผูกกับ Netlify มากขึ้น
- **แนะนำ (a) สำหรับ POC** เพื่อยึด decision log (สลับเป็น (b) ได้ในครึ่งวันเพราะ Route Handler ตัวเดียวกัน) — แต่ต้องยอมรับ latency และเขียน keepalive workflow ตั้งแต่ M5
- ต้องการ: ตัดสินใจ

#### กลุ่ม D — Token, UI และ DoD

**Q14. Token ของ shadcn vs semantic token ของ design system**
- shadcn ใช้ `--primary`, `--background`, `--muted-foreground` ฯลฯ; Design §3.4 ใช้ `--color-bg-surface`, `--color-text-primary` ฯลฯ; กฎ "ห้าม hex ดิบ" ไม่ได้บอกว่า class ของ shadcn (`bg-primary`) นับว่าผ่านหรือไม่
- **เสนอ**: map alias ของ shadcn ทั้งหมดไปหา semantic token ใน `globals.css` จุดเดียว (`--primary: var(--color-brand-500)` …) ถือว่า class ทั้งสองชุดคือ token ที่อนุญาต; เพิ่ม lint/grep ห้าม `#xxxxxx` และ `bg-[#…]` ใน `components/` และ `modules/`; radius ของ shadcn (`--radius`) แทนที่ด้วย scale sm 10 / md 14 / lg 20 / xl 28 ของ Design §5.2
- ต้องการ: ยืนยัน

**Q15. DoD "Storybook ≥3 state ทุก component" + Lighthouse CI ทุก PR ใน POC**
- Design §16 บังคับทุก component; §15 มี Lighthouse CI ทุก PR — เพิ่มงานราว 25-35% ของเวลา UI สำหรับ solo dev
- ตัวเลือก: (a) เต็มตามเอกสาร / (b) Storybook บังคับเฉพาะ `components/domain` + widget (ไม่รวม page, layout, form ที่ผูก server action) และ Lighthouse รันมือท้ายทุก milestone แทน CI ทุก PR; ข้ออื่นของ DoD คงเดิมทั้งหมด
- **แนะนำ (b)**
- ต้องการ: ตัดสินใจ (กระทบประมาณการ §2.7 ราว 3-4 วัน)

**Q16. แสดงปี พ.ศ. หรือ ค.ศ. เป็น default**
- Design §12: พ.ศ. เป็น "option ในหน้าตั้งค่า" — ไม่บอก default
- **แนะนำ**: พ.ศ. เป็น default ทุกที่ (`Intl` locale `th-TH` ให้ พ.ศ. อยู่แล้ว) ไม่มี toggle ใน POC; DatePicker (react-day-picker) ต้องเขียน formatter ปี พ.ศ. เอง (~0.5 วัน)

**Q17-Q19 (เล็ก ไม่บล็อก)**
- Q17: ชื่อ goal ต้อง unique ไหม — ตัวอย่าง error ใน Design §4.3 ("ชื่อเป้าหมายซ้ำ") บอกว่าใช่ แต่ schema ไม่มี unique → แนะนำไม่บังคับ ถือว่าเป็นตัวอย่างสำนวน
- Q18: template "เดือนนี้" ตอนเหลือไม่กี่วันในเดือน → แนะนำ ถ้าเหลือ < 7 วัน ให้ default เป็น "เดือนหน้า"
- Q19: Scope §10.2 บอก "หลักการ 4 ข้อ" แต่ Design §2 มี 5 ข้อ; รายการ primitives ต่างกัน (Textarea/Radio) → ยึด Design เป็นหลัก ไม่กระทบงาน

### 1.3 ความเสี่ยงทางเทคนิคที่เอกสารยังไม่ได้พูดถึง

| # | ความเสี่ยง | ผลกระทบ | การรับมือที่ใส่ไว้ในแผน |
|---|---|---|---|
| R1 | **LINE push quota แผนฟรี** — Messaging API push ทุกข้อความนับโควตารายเดือนของ OA (แผนฟรีของไทยอยู่ราว 300 ข้อความ/เดือน — ต้องเช็คตัวเลขปัจจุบันใน OA Manager) digest รายวัน × 10 tester × 30 วัน = 300 ข้อความ = เต็มโควตาพอดี | ต้นทุน POC ไม่ใช่ "~0 บาท" ตาม Scope §13 ถ้า tester > 10 คน หรือส่งมากกว่า 1 ข้อความ/วัน; อาจต้องจ่ายแผน Basic (~1,200 บาท/เดือน) เฉพาะเดือน field test | จำกัด digest 1 ข้อความ/วัน/คน, congrats เฉพาะ goal สำเร็จ (นาน ๆ ครั้ง), reply ผ่าน webhook ใช้แทน push ทุกที่ที่ทำได้ (ฟรี), จำกัด tester รอบ CP2 ที่ 8-10 คน หรือตั้งงบไว้ |
| R2 | **Supabase default SMTP เป็น dev-only** จำกัดไม่กี่ฉบับ/ชม. และอาจส่งได้เฉพาะอีเมลสมาชิกทีม | OTP onboarding พังตั้งแต่ tester คนที่ 2-3; และระหว่าง dev เองก็ชน limit เร็ว | ตั้ง custom SMTP (Resend ฟรี 3,000 ฉบับ/เดือน หรือ Brevo) + verify domain (SPF/DKIM) ใน M0 ก่อนเขียนหน้า login |
| R3 | **LINE in-app browser** — ลิงก์จากข้อความ LINE เปิดใน WebView ของ LINE ซึ่ง cookie แยกจาก Safari/Chrome | user ที่กดจาก LINE จะโดนขอ OTP ใหม่ทุกครั้ง และติดตั้ง PWA ไม่ได้ → ฆ่า retention loop ที่ LINE ควรสร้าง | ทุก URL ที่ส่งจาก LINE ต่อ `?openExternalBrowser=1` เพื่อเปิดใน browser หลักของเครื่อง; ทดสอบทั้ง iOS/Android ใน M5 |
| R4 | **Netlify Function timeout 10 วินาที** (sync) + cold start ~1-2 วินาที | Route Handler cron ที่ประมวลผล event มากเกินจะ timeout; cold start กระทบ LCP บน 4G | batch ≤ 20 event/รอบ, digest แบ่งเป็น batch ต่อ user, cron ทุก 5 นาทีช่วย warm; ตัวเลขบน widget บนสุด render เป็น Server Component |
| R5 | **Serwist กับ Turbopack** — `@serwist/next` เป็น webpack plugin แต่ Next 16 build เป็น Turbopack เป็นค่าเริ่มต้น | PWA build พังตอน M6 ถ้าไม่เตรียม | ทดสอบใน M0 ว่าจะใช้ `next build --webpack` หรือแยก build service worker ด้วย `@serwist/build` CLI; ถ้าติดจริง POC เหลือ manifest + ติดตั้งได้ (ไม่มี SW) |
| R6 | **Timezone** — Netlify/Node รันเป็น UTC แต่ "วันนี้" ของ user คือ Asia/Bangkok | งานวันนี้/ค้าง คลาดวันช่วง 00:00-07:00, digest ผิดวัน, streak ผิด | helper เดียว `lib/date.ts` (`todayBkk()`, `toBkkDate(timestamptz)`, period bounds, สัปดาห์เริ่มอาทิตย์) มี unit test ครอบคลุมช่วงเที่ยงคืน; `due_date`/`period_start` เป็น `date` (ถูกแล้ว), `completed_at` เก็บ `timestamptz` แต่ `task_completions.completed_on` เก็บวัน BKK |
| R7 | **Security ที่เอกสารไม่ระบุ** | endpoint cron/webhook เปิดสาธารณะ | cron ต้องมี `Authorization: Bearer CRON_SECRET`; webhook ตรวจ `X-Line-Signature` (HMAC-SHA256 ด้วย channel secret) ก่อน parse; `service_role` ใช้เฉพาะ cron/webhook ใน `lib/supabase/admin.ts`; RLS `domain_events`: user insert ของตัวเองเท่านั้น อ่าน/แก้เป็น service role |
| R8 | **Bundle budget 200KB gz** — Recharts (~100KB gz) + Motion (~35KB) + Supabase client (~30KB) + RHF/Zod (~25KB) | dashboard route เกิน budget ตั้งแต่ widget แรก | Recharts lazy-load ใต้ fold พร้อม Skeleton, KPI/progress bar render ฝั่ง server, Motion import เฉพาะ celebration; วัดด้วย `@next/bundle-analyzer` ท้าย M4 |
| R9 | **Supabase free tier** — pause หลัง 7 วันไม่มี activity, 2 project/org, ไม่มี branching | project dev/prod ต้องแยกกันด้วยวินัย migration; pause ระหว่าง field test = user เห็น error | cron 5 นาทีช่วยกัน pause; migration ทุกอันผ่าน `supabase/migrations` + `supabase db push` ห้ามแก้ใน Studio |
| R10 | **GitHub Actions cron** — latency, หยุดหลัง 60 วัน, ไม่มี UI retry | ดู Q13 | workflow มี `workflow_dispatch` สำหรับกดมือ + keepalive workflow commit ไฟล์ `.github/keepalive` ทุก 30 วัน |
| R11 | **iOS PWA** — ไม่มี `beforeinstallprompt`, ต้อง "เพิ่มไปยังหน้าจอโฮม" เอง, storage ถูกล้างได้ | tester iPhone ไม่รู้วิธีติดตั้ง | หน้าคำแนะนำติดตั้งสั้น ๆ ต่อ platform ใน M6 (ข้อความจาก `th.json`) |
| R12 | **E2E onboarding ต้องอ่าน OTP** | Playwright เข้าถึงอีเมลไม่ได้ | ใช้ `auth.admin.generateLink` (service role) ใน test setup หรือ Mailpit ของ local Supabase; ห้ามมี bypass ใน build production |
| R13 | **Metric §14 ไม่มี instrumentation** | วัดผล POC ไม่ได้ | ใช้ `domain_events` เป็น event log ด้วย (`onboarding.completed`, `goal.created`, `task.completed`, `sales.recorded`, `line.linked`) + ไฟล์ SQL `supabase/queries/poc-metrics.sql` รันใน Studio |
| R14 | **PDPA** — เก็บ email + `line_user_id` ของคนไทย | ความเสี่ยงทางกฎหมายแม้เป็น POC | ข้อความยินยอม 1 บรรทัดหน้า login + หน้านโยบายแบบ static (ดู "ข้อเสนอนอก scope") |
| R15 | **Node เครื่องนี้ v26.8.1** ใหม่กว่าที่ Netlify/Next รองรับเป็นทางการ | build ต่างกันระหว่าง local กับ Netlify | ปักหมุด Node 22 LTS ด้วย `.nvmrc` + `engines` + Netlify env `NODE_VERSION=22` |
| R16 | **Recurrence/completion schema (Q4)** ถ้าไม่ตัดสินก่อน M3 | migrate หลังมี user จริงแพงมาก | ตัดสินใน "3 สิ่งที่ต้องตัดสินใจ" ข้อ 1 |

---

## ส่วนที่ 2 — แผนดำเนินการ POC

### 2.1 ขอบเขต POC ที่จะยึด และสมมติฐานระหว่างรอคำตอบ

**อยู่ใน POC (Scope §11)**: Auth email+OTP · onboarding 3 ขั้น · goals CRUD + cascade tree + progress · tasks CRUD + recurring subset + complete/undo + reschedule · domain tagging 6 domain · Seller module (เป้ายอดขายเดือน, บันทึกยอดรายวัน, widget ยอดขาย vs เป้า, checklist ร้าน) · dashboard layout คงที่ 4 widget · `domain_events` + cron + LINE (เชื่อมบัญชี, congrats, digest เช้า) · ตั้งค่า (ชื่อ, LINE, แจ้งเตือน, ออกจากระบบ) · ปฏิทินสัปดาห์ · PWA ติดตั้งได้ · ภาษาไทยผ่าน i18n · Admin = Supabase Studio

**ไม่อยู่ใน POC**: billing/subscription UI · drag-drop และ `dashboard_layouts` · persona อื่น · calendar เดือน/ปี · offline write queue · swipe/long-press · dark mode · LINE Login · admin UI · AI

**สมมติฐานที่ใช้ถ้ายังไม่ตอบคำถาม §1.2** (ทุกข้อคือ "ที่แนะนำ"): Q1(a) · Q2 4 widget ตัด DailyLife · Q3(b) สัปดาห์เท่านั้น · Q4(a) `task_completions` + daily/weekly · Q5 ไม่มี write queue · Q6 Sheet แทน gesture · Q7(b) · Q8 กฎ metric/execution · Q9 ปี/เดือน/สัปดาห์ + task, template สร้าง week goal · Q10 `seller_sales_entries` · Q11 congrats + digest 07:30 · Q12 รหัส 6 ตัวผ่าน webhook · Q13(a) GitHub Actions ทุก 5 นาที · Q14 map alias · Q15(b) · Q16 พ.ศ. default · goal ปีใช้ปีปฏิทิน (1 ม.ค.) · สัปดาห์เริ่มวันอาทิตย์

### 2.2 สิ่งที่ต้องตั้งค่าก่อนเขียนโค้ดบรรทัดแรก (Milestone 0)

**สถานะเครื่องปัจจุบัน**: Node v26.8.1 ✅ (ต้องเพิ่ม Node 22 LTS) · Docker ✅ · git + remote GitHub ✅ (`Kritchawat-creator/Kemtit.com`) · ยังไม่มี pnpm, supabase CLI, netlify CLI, gh

**A. บัญชี/บริการ (คุณต้องทำเอง — ผมทำแทนไม่ได้)**

| บริการ | สิ่งที่ต้องทำ | ได้อะไรมา |
|---|---|---|
| Supabase | สร้าง org + project `kemtit-dev` (region Singapore) และ `kemtit-prod` (ใช้ตอน CP2) · Auth → Email provider เปิด · OTP length 6, expiry 600 วิ · แก้ template "Magic Link" ให้มี `{{ .Token }}` เป็นภาษาไทย · Site URL + Redirect URLs · **Custom SMTP** ชี้ไป Resend | `SUPABASE_URL`, anon/publishable key, service_role/secret key, project ref |
| Resend (หรือ Brevo) | สมัคร · เพิ่ม domain `kemtit.com` · ใส่ DNS SPF/DKIM · สร้าง SMTP credential สำหรับ Supabase | ผู้ส่ง `no-reply@kemtit.com` |
| DNS ของ kemtit.com | เพิ่ม record ของ Resend และ Netlify (custom domain ทำตอน CP2 ได้) | — |
| Netlify | Import repo · build `pnpm build` · `NODE_VERSION=22` · ใส่ env ทุกตัวแยก context (production / deploy-preview) · Next.js runtime ตรวจพบอัตโนมัติ | site URL สำหรับ `NEXT_PUBLIC_SITE_URL` และ webhook |
| LINE Developers | สร้าง Provider "Kemtit" → channel แบบ Messaging API (ได้ OA อัตโนมัติ) · issue channel access token (long-lived) · จด channel secret · ใน LINE OA Manager: ปิด auto-reply/greeting (หรือตั้ง greeting เป็นวิธีเชื่อมบัญชี) · เปิด "Use webhook" (ใส่ URL ตอน M5) · จด Basic ID + QR เพิ่มเพื่อน · เช็คโควตาแผนฟรี | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_OA_BASIC_ID` |
| GitHub | Actions เปิด · Secrets: `CRON_SECRET`, `CRON_BASE_URL` (ใช้ตอน M5) · branch protection ไม่จำเป็นสำหรับ solo | — |
| (ทางเลือก) Sentry | project Next.js ฟรี | `SENTRY_DSN` — ดู "ข้อเสนอนอก scope" |

**B. CLI ในเครื่อง**

```bash
brew install nvm pnpm supabase/tap/supabase netlify-cli gh
```
แล้ว `nvm install 22 && nvm use 22`, `gh auth login`, `netlify login`, `supabase login`

**C. Environment variables** (ไฟล์ `.env.local` — ไม่ commit; มี `.env.example` ให้ commit)

| ตัวแปร | ฝั่ง | ใช้ที่ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | Supabase client ทุกตัว |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (หรือ publishable key รูปแบบใหม่) | client+server | browser/server client ที่ผ่าน RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | `lib/supabase/admin.ts` — cron + webhook เท่านั้น |
| `NEXT_PUBLIC_SITE_URL` | client+server | ลิงก์ในอีเมล/LINE, redirect |
| `CRON_SECRET` | server | ตรวจ bearer ของ `/api/cron/*` |
| `LINE_CHANNEL_SECRET` | server | verify webhook signature |
| `LINE_CHANNEL_ACCESS_TOKEN` | server | push/reply |
| `NEXT_PUBLIC_LINE_OA_BASIC_ID` | client | ปุ่ม/QR เพิ่มเพื่อน |
| `SENTRY_DSN` (ทางเลือก) | server+client | error monitoring |

**D. Repo scaffold + tooling** (งานของผม หลังอนุมัติ — จะแจ้งรายการไฟล์ก่อนสร้างตามกฎ)

- `create-next-app` (TypeScript, Tailwind v4, App Router, `src/`, ESLint) ปักหมุด Next 16 + React 19; `.nvmrc` = 22
- Dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`, `next-intl`, `date-fns`, `date-fns-tz`, `lucide-react`, `sonner`, `motion` (ใช้เฉพาะ celebration), `recharts` (lazy) — react-grid-layout **ยังไม่ติดตั้ง** (MVP)
- `shadcn init` (Tailwind v4 preset) แล้ว map alias → semantic token ใน `src/styles/globals.css` (Q14)
- Tooling: Prettier + `prettier-plugin-tailwindcss` · ESLint + `eslint-plugin-jsx-a11y` + `eslint-plugin-boundaries` (กฎ: `modules/*` ห้าม import `modules/*` อื่น, `core/**` ห้าม import `modules/**` และ `services/**`, `app/**` เป็น composition root ที่ import ได้ทุกชั้น) · Vitest + React Testing Library · Storybook (react-vite) · Playwright (ติดตั้ง config ไว้ ใช้จริง M6)
- `supabase init` + `supabase link --project-ref <dev>` · migration แรก `0001_user_profiles.sql`
- GitHub Actions `ci.yml`: lint + typecheck + vitest ทุก PR (cron workflows เขียนตอน M5)
- ทดสอบ R5 ทันที: `next build` พร้อม `@serwist/next` แบบ `--webpack` ผ่านหรือไม่ (ถ้าไม่ผ่านตัดสินใจ fallback ตั้งแต่ตอนนี้)

**E. Migration แรก — `0001_user_profiles.sql`**
- `user_profiles` ตาม Scope §6 + `updated_at`, `onboarding_completed_at`, `line_linked_at`, `notify_daily_digest boolean default true`, `digest_time time default '07:30'`
- trigger `handle_new_user` บน `auth.users` insert → สร้างแถว profile อัตโนมัติ (pattern มาตรฐาน Supabase)
- RLS: `select`/`update` เฉพาะ `auth.uid() = id`; ไม่มี `insert`/`delete` จาก client
- ทดสอบ: สมัครผ่าน Studio → มีแถว profile; user A อ่าน profile ของ B ไม่ได้

**นิยาม "M0 เสร็จ"**: `pnpm dev` เปิดหน้า placeholder ภาษาไทยด้วยฟอนต์ IBM Plex Sans Thai · Storybook เปิดได้ · `supabase db push` migration แรกผ่านบน dev project · Netlify deploy preview ขึ้น · ส่ง OTP ทดสอบผ่าน Resend ถึงอีเมลนอกทีมได้ (พิสูจน์ R2 หาย)

### 2.3 โครงสร้างโฟลเดอร์ที่จะใช้ (รวม Scope §4 + Design §14 เป็นชุดเดียว)

```
src/
  app/                          # routes เท่านั้น (บาง) — composition root
    (auth)/login, (auth)/onboarding/{persona,first-goal}
    (app)/dashboard, (app)/goals, (app)/goals/[id], (app)/calendar, (app)/settings
    (app)/dashboard/registry.ts # widget registry: จุดเดียวที่ import ทั้ง core และ modules/seller
    api/cron/{process-events,daily-digest}/route.ts
    api/line/webhook/route.ts
    manifest.ts, sw.ts
  core/                         # shared kernel — ห้าม import modules/ และ services/
    goals/    {schema.ts, actions.ts, queries.ts, progress.ts, periods.ts, templates.ts}
    tasks/    {schema.ts, actions.ts, queries.ts, recurrence.ts}
    profile/  {schema.ts, actions.ts, queries.ts}
    events/   {emit.ts, types.ts}           # เขียน domain_events
    ports/    {ai-suggestion.ts, notifier.ts}   # interface เท่านั้น
  modules/
    seller/   {components/, widgets.ts, schema.ts, actions.ts, queries.ts, template.ts}
  services/
    notifications/line/ {client.ts, signature.ts, messages.ts}
    events/   {processor.ts, handlers/goal-completed.ts}
    digest/   {build-digest.ts}
  components/
    ui/        # shadcn primitives
    domain/    # GoalCard, GoalCascadeTree, ProgressRing, ProgressBar, TaskRow, TaskList, DomainTag,
               # PeriodSwitcher, DatePicker, EmptyState, StatTile
    widgets/   # WidgetShell + widget กลาง: TodayTasksWidget, GoalProgressWidget
    layout/    # AppShell, BottomNav, Sidebar, TopBar, Fab, PageHeader
  lib/         {utils.ts, format.ts, date.ts, supabase/{server,client,admin,proxy}.ts}
  i18n/        {request.ts}     # next-intl แบบไม่มี routing (ภาษาเดียว)
  messages/th.json
  styles/globals.css            # @theme token ทั้งหมดจุดเดียว
supabase/  {config.toml, migrations/, seed.sql, queries/poc-metrics.sql}
.github/workflows/ {ci.yml, cron-events.yml, cron-digest.yml, keepalive.yml}
```
หมายเหตุ: Design §14 ใส่ widget ของ seller ไว้ใต้ `modules/seller/components/` และ widget กลางไม่ได้ระบุที่ — ผมวางไว้ `components/widgets/` เพราะเป็นของ core; registry อยู่ที่ `app/` เพราะ core ห้ามรู้จัก modules

### 2.4 Work breakdown — Milestones (เรียงตาม dependency จริง ทุกก้อน "รันแล้วเห็นผล")

หลักการเรียง: สิ่งที่ทุกอย่างพึ่งพา (token, auth, profile) → goal (ไม่พึ่ง task) → task (พึ่ง goal) → seller + dashboard (พึ่งทั้งสอง) → event/LINE (พึ่ง action ที่ยิง event) → ส่วนที่เหลือและ polish

#### M1 — Foundation: token, app shell, auth OTP, onboarding ขั้น 1-2
- **Migration**: ใช้ `0001_user_profiles.sql` จาก M0
- **งาน**
  - `globals.css`: brand/accent/neutral/semantic/domain palette, semantic token layer + `[data-theme="dark"]` (แค่โครง), radius scale, shadow, type scale, `prefers-reduced-motion`, map alias ของ shadcn
  - ฟอนต์ IBM Plex Sans Thai ผ่าน `next/font/google` (weight 400/500/600, subset thai+latin)
  - shadcn primitives ชุดแรก: Button, Input, Label, Checkbox, Badge, Skeleton, Dialog, Sheet, Select, Switch, Tabs, Tooltip, Popover, DropdownMenu, Sonner (Toast)
  - `messages/th.json` + next-intl provider; `lib/format.ts` (`formatTHB`, `formatPercent`, `formatThaiDate` พ.ศ., `formatRelative`) + `lib/date.ts` (`todayBkk`, week/month/year bounds เริ่มอาทิตย์) พร้อม unit test
  - `lib/supabase/{server,client,admin}.ts` + `proxy.ts` (session refresh) + route guard: ไม่ login → `/login`; login แล้วแต่ยังไม่มี persona → onboarding
  - หน้า login: email → OTP 6 หลัก auto-submit เมื่อครบ, error inline ภาษาไทย, ข้อความยินยอม PDPA 1 บรรทัด
  - Onboarding ขั้น 2: persona 4 card (seller เท่านั้นที่กดได้) → บันทึก `active_persona`
  - AppShell: BottomNav (แดชบอร์ด / เป้าหมาย / ปฏิทิน / ตั้งค่า), Sidebar + TopBar บน desktop, FAB (เมนู task/goal — ยังไม่ทำงาน), หน้า placeholder ทุกแท็บ
  - Storybook: story โทเคน (สี/ตัวอักษร/radius) + primitives
- **รันแล้วเห็นผล**: สมัครด้วยอีเมลจริง → ใส่ OTP → เลือก seller → เห็น dashboard ว่าง ๆ พร้อม nav บน Netlify preview; refresh แล้ว session ยังอยู่
- **ทดสอบ**: unit test format/date; ทดสอบมือบน iPhone Safari + Android Chrome (mobile-first ตาม Design §7.3)

#### M2 — Goals: schema, cascade engine, progress, หน้าเป้าหมาย, onboarding ขั้น 3
- **Migration `0002_goals_tasks.sql`**: `goals` ตาม Scope §6 + `completed_at`, `updated_at`, `status` check (`active|completed|archived`); `tasks` ตาม §6 + `updated_at`; `task_completions(task_id, completed_on date, completed_at timestamptz, primary key(task_id, completed_on))`; index (`user_id, period_type, period_start`), (`user_id, due_date`), (`parent_id`), (`goal_id`); RLS ทุกตารางแบบ `auth.uid() = user_id`
- **งาน**
  - `core/goals/schema.ts` (Zod: create/update, ตรวจว่า period ลูกอยู่ใน period แม่) — ใช้ร่วม client (RHF resolver) และ server action
  - `core/goals/periods.ts`: คำนวณขอบเขต period, เสนอช่วงวันที่ลูกจากแม่ (Scope §5.1 "auto-suggest"), week goal ที่ทับเดือน — unit test หนัก
  - `core/goals/progress.ts`: กฎ Q8 (metric/execution, ตกเป้า) — unit test
  - Server actions: create/update/archive goal, `getGoalTree`, `listGoals(period, domain filter)`
  - Domain components + story: `DomainTag`, `ProgressBar`, `ProgressRing`, `StatTile`, `EmptyState`, `PeriodSwitcher`, `DatePicker` (พ.ศ., เริ่มอาทิตย์), `GoalCard`, `GoalCascadeTree` (พับได้ 3 ระดับ), `GoalForm` (Sheet มือถือ / Dialog desktop)
  - หน้า `/goals` (filter งาน/ชีวิต, กลุ่มตาม period, สี warning เมื่อตกเป้า) และ `/goals/[id]` (hero % + tree + ส่วน task ว่างไว้ให้ M3)
  - Onboarding ขั้น 3: template seller "ยอดขายเดือนนี้ [__] บาท" (Q18) → สร้างเป้าเดือน + week goal ลูกอัตโนมัติ (Q9) → `onboarding_completed_at` → ไป dashboard
  - `supabase/seed.sql` ข้อมูล demo สำหรับ dev/Storybook
- **รันแล้วเห็นผล**: onboarding จบใน 3 ขั้น เห็นเป้าเดือน + 4-5 week goal ใน tree; สร้าง goal ชีวิต (เช่น สุขภาพ) ผูกใต้ goal ปี; แก้ `current_value` มือแล้ว % และสีตกเป้าเปลี่ยน
- **ทดสอบ**: unit test periods/progress ≥ 90% coverage ของ 2 ไฟล์นี้; RLS test ผ่าน SQL (user A มองไม่เห็น goal ของ B)

#### M3 — Tasks: CRUD, recurring subset, ประวัติเสร็จ, undo, goal.completed
- **Migration**: ไม่มีใหม่ (ใช้ 0002) — เว้นแต่ Q4 เปลี่ยน
- **งาน**
  - `core/tasks/schema.ts` (Zod), `recurrence.ts` (parse/expand `FREQ=DAILY|WEEKLY;BYDAY`, ไม่ใช้ lib RRULE เต็มใน POC), queries: `getTodayTasks` = task เดี่ยวครบกำหนดวันนี้ + ค้าง (ยังไม่เสร็จ, due < วันนี้) + occurrence ของ recurring วันนี้ พร้อมสถานะจาก `task_completions`
  - Server actions: create/update/delete, `toggleComplete(taskId, date)` (task เดี่ยว → `completed_at`; recurring → upsert/delete `task_completions`), `reschedule(taskId, newDate)`
  - หลัง toggle: คำนวณ progress ของ goal แม่ → ถ้าถึง 100 ครั้งแรก set `completed_at`, status, `emit('goal.completed')`; emit `task.completed` ทุกครั้ง (R13)
  - Components + story: `TaskRow` (checkbox 150ms + strikethrough), `TaskList` (กลุ่ม ค้าง/วันนี้/เสร็จแล้ว หรือตาม domain), `TaskForm` (ช่องเดียว "ชื่อ" ก็บันทึกได้; due date, domain, recurring, ผูก goal), Sheet รายละเอียด task ที่มีปุ่ม เลื่อนวัน/ลบ (Q6), ลบ = เอาออกจาก UI ทันที + undo toast 5 วิ แล้วค่อยยิง delete
  - หน้า goal detail แสดง task ที่ผูก + เพิ่ม task จากในหน้า; FAB ทำงานจริง; celebration ครั้งเดียว 800ms เมื่อ goal ถึง 100 (ปิดเมื่อ reduced-motion)
- **รันแล้วเห็นผล**: วงจรใช้งานรายวันครบโดยยังไม่มี LINE — สร้าง task ซ้ำทุกวัน ติ๊กวันนี้ พรุ่งนี้กลับมาเป็นยังไม่เสร็จ แต่ประวัติเมื่อวานยังอยู่; ติ๊ก task ครบแล้ว goal execution ขึ้น 100 + confetti + มีแถวใน `domain_events`
- **ทดสอบ**: unit test recurrence (รวมกรณีข้ามเดือน/สัปดาห์เริ่มอาทิตย์); component test TaskRow keyboard (Space toggle)

#### M4 — Seller module + Dashboard คงที่ → หยุดทดสอบกับ user (CP1)
- **Migration `0003_seller_sales_entries.sql`**: ตารางตาม Q10 + RLS + index (`user_id, entry_date`)
- **งาน**
  - `modules/seller`: `template.ts` (เป้าเดือน + week goal + checklist ร้าน 4 รายการ: เช็คสต็อก, แพ็คของ, ตอบแชท, ปิดยอด — ทั้งหมดแก้/ลบได้), `actions.ts` `recordSale(date, amount)` write-through ไป `current_value` ของเป้าเดือนและ week goal ที่ครอบวันนั้น + emit `sales.recorded`
  - `SalesVsGoalWidget`: % ใหญ่ (display 36px) + ยอดจริง/เป้า + "ต้องขายอีกวันละ X" (server-rendered) + ปุ่มบันทึกยอดวันนี้ (Sheet) + กราฟแท่งรายวันของเดือน (Recharts lazy ใต้ fold, Skeleton ระหว่างโหลด) + empty state "บันทึกยอดขายวันแรก"
  - `ShopChecklistWidget`: `TaskList` กรองเฉพาะ routine ของวันนี้
  - `TodayTasksWidget` (ไม่รวม routine), `GoalProgressWidget` (goal อื่นของเดือนนี้เรียงตาม domain, ว่าง → CTA "ตั้งเป้าชีวิตส่วนตัวสักข้อ")
  - `WidgetShell` (หัว + slot เมนู/handle ที่ยังไม่ render), registry ที่ `app/(app)/dashboard/registry.ts`, layout คงที่ของ seller: มือถือ stack / desktop CSS grid 2-3 คอลัมน์ (ยังไม่ react-grid-layout), Skeleton รูปทรงเดียวกับ widget
  - วัด bundle (R8) + Lighthouse มือรอบแรก
- **รันแล้วเห็นผล**: เปิดแอปเห็น "3 วินาที" ตาม Design §2 — % เป้าเดือนนี้ใหญ่บนสุด, งานวันนี้, checklist ร้าน; กรอกยอดขายแล้วกราฟ/%/week goal ขยับพร้อมกัน
- **จากนั้น**: หยุดทำ feature → CP1 (§2.6)

#### M5 — Domain events, cron, LINE (เชื่อมบัญชี, congrats, digest)
- **Migration `0004_domain_events_line.sql`**: `domain_events` ตาม Scope §6 + `attempts int default 0`, `last_error text`, index partial `where processed_at is null`; RLS: insert เฉพาะ `auth.uid() = user_id`, ไม่มี select/update จาก client; `user_profiles` + `line_link_code text unique`, `line_link_code_expires_at`
- **งาน**
  - `services/notifications/line`: `pushText`, `replyText`, `verifySignature`, ข้อความภาษาไทยจาก `th.json` (ไม่ใช้ emoji ตาม Design §4.3), ทุกลิงก์ต่อ `?openExternalBrowser=1` (R3)
  - `POST /api/line/webhook`: verify signature → event `message` ที่ text เป็นรหัส 6 ตัว → จับคู่ → บันทึก `line_user_id`, `line_linked_at`, emit `line.linked` → reply ยืนยัน; `unfollow` → ล้าง `line_user_id`; ตอบ 200 เร็ว (< 1 วิ)
  - หน้าตั้งค่า → การ์ด "เชื่อม LINE": สร้างรหัส, QR/ปุ่มเพิ่มเพื่อน, poll สถานะ, ปุ่มยกเลิกการเชื่อม
  - `POST /api/cron/process-events` (bearer `CRON_SECRET`, admin client, ดึง ≤ 20 แถวที่ยังไม่ processed เรียงเวลา, handler ต่อ event type, สำเร็จ → `processed_at`, ล้มเหลว → `attempts+1`, `last_error`, หยุด retry เมื่อ ≥ 5)
  - handler `goal.completed` → push congrats ถึงคนที่เชื่อม LINE (ถ้าไม่เชื่อม mark processed เฉย ๆ)
  - `POST /api/cron/daily-digest`: เลือก user ที่ `line_user_id` ไม่ว่าง และ `notify_daily_digest` และยังไม่ส่งวันนี้ (คอลัมน์ `last_digest_sent_on`) → สร้างข้อความ "วันนี้ N งาน · ค้าง M · เป้าเดือนนี้ X% (ตกเป้า/ตามเป้า)" → push → batch ≤ 25 คน/รอบ
  - GitHub Actions: `cron-events.yml` (`*/5 * * * *` + `workflow_dispatch`), `cron-digest.yml` (`*/10 0-1 * * *` UTC = 07:00-08:59 BKK ให้ endpoint เป็นคนตัดสินว่าถึงเวลาส่งหรือยัง), `keepalive.yml` (commit ทุก 30 วัน)
  - dev ท้องถิ่น: `netlify dev --live` หรือ cloudflared tunnel สำหรับทดสอบ webhook
- **รันแล้วเห็นผล**: เชื่อม LINE จากหน้าตั้งค่าใน < 1 นาที; ทำเป้าสำเร็จ → ได้ข้อความใน LINE ภายใน ~5-10 นาที; เช้าวันถัดไปได้ digest; กดลิงก์แล้วเปิด browser หลักโดยไม่ต้อง OTP ใหม่
- **ทดสอบ**: unit test signature + digest text; ทดสอบมือ `workflow_dispatch`; ดูแถว `domain_events` ใน Studio

#### M6 — ตั้งค่า, ปฏิทินสัปดาห์, PWA, DoD sweep, E2E, metrics → CP2
- **Migration**: ไม่มี (เว้นแต่ CP1 ทำให้ต้องแก้)
- **งาน**
  - ตั้งค่า: ชื่อที่แสดง, การ์ด LINE (จาก M5), toggle digest + เวลา, ออกจากระบบ; ซ่อน persona/subscription/ธีม (นอก POC)
  - ปฏิทินสัปดาห์ (Q3): `PeriodSwitcher` เลื่อนสัปดาห์, 7 คอลัมน์เริ่มอาทิตย์, task เป็นจุดสี domain + label, แตะวัน → รายการวันนั้น
  - PWA: `manifest.ts` + icons, Serwist SW แบบ precache static shell เท่านั้น (ไม่ cache หน้า RSC), banner offline อ่านอย่างเดียว (Q5), หน้าคำแนะนำติดตั้ง iOS (R11)
  - DoD sweep ทุก component: token-only (grep hex), keyboard + focus ring, loading/empty/error, contrast (ตรวจคู่สีใหม่ที่เพิ่ม), i18n ครบ, formatter, reduced-motion, story ≥ 3 state (ตาม Q15)
  - Playwright 3 flow ตาม Design §15: onboarding (OTP ผ่าน admin generateLink), สร้าง goal, ติ๊ก task
  - Lighthouse มือถือ 4G throttling: LCP < 2.5s, CLS < 0.1, JS เริ่มต้น < 200KB gz — แก้จนผ่านหรือบันทึกเหตุผล
  - `supabase/queries/poc-metrics.sql`: อัตราสร้าง goal แรกใน session แรก, streak 7 วัน, อัตราเชื่อม LINE, DAU tester
  - ตั้ง `kemtit-prod` project + `supabase db push` + Netlify production env + (ถ้ามี) custom domain
- **รันแล้วเห็นผล**: build production ผ่าน CI, ติดตั้งเป็นแอปบน Android/iOS ได้, E2E เขียว, Lighthouse ผ่าน budget → ปล่อยให้ tester CP2

### 2.5 ลำดับการสร้าง component (ก่อน → หลัง ตามการพึ่งพา)

| ลำดับ | สร้าง | เพราะ |
|---|---|---|
| 0 | `globals.css` token → ฟอนต์ → alias shadcn | ทุก component อ้าง token; แก้ทีหลัง = แก้ทุกที่ |
| 1 | shadcn primitives (Button, Input, Label, Checkbox, Badge, Skeleton, Dialog, Sheet, Select, Switch, Tabs, Tooltip, Popover, DropdownMenu, Sonner) | domain component ทุกตัวประกอบจากชุดนี้ |
| 2 | `lib/format.ts`, `lib/date.ts`, `core/goals/periods.ts`, `core/goals/progress.ts` (pure + test) | UI แสดงตัวเลข/วันที่/% ผ่านฟังก์ชันเหล่านี้เท่านั้น (DoD) |
| 3 | `DomainTag`, `ProgressBar`, `ProgressRing`, `StatTile`, `EmptyState` | leaf component ไม่พึ่งข้อมูล ทำ story ง่าย ใช้ในทุกหน้า |
| 4 | `AppShell`, `BottomNav`, `Sidebar`, `TopBar`, `Fab`, `PageHeader` | ทุกหน้าอยู่ในกรอบนี้; ต้องมีก่อนหน้า login/onboarding จะ "เห็นผล" |
| 5 | `DatePicker` (พ.ศ.), `PeriodSwitcher` | `GoalForm`/`TaskForm`/ปฏิทินพึ่งพา |
| 6 | `GoalForm` → `GoalCard` → `GoalCascadeTree` | tree ประกอบจาก card; card ต้องการ progress (ลำดับ 2) และ tag (ลำดับ 3) |
| 7 | `TaskForm` → `TaskRow` → `TaskList` | list ประกอบจาก row; form ต้องเลือก goal ได้ (ลำดับ 6) |
| 8 | `WidgetShell` → `TodayTasksWidget`, `GoalProgressWidget` → `SalesVsGoalWidget`, `ShopChecklistWidget` | widget ห่อด้วย shell และประกอบจาก list/card/progress ข้างบน |
| 9 | Dashboard page + registry → ปฏิทินสัปดาห์ → การ์ด LINE ในตั้งค่า | ประกอบทุกอย่างเข้าด้วยกัน; ทำสุดท้ายเพราะพึ่งทุกชั้น |

### 2.6 จุดที่ควรหยุดทดสอบกับ user จริงก่อนเดินหน้าต่อ

| จุดหยุด | เมื่อไหร่ | ทำอะไร | ตัดสินอะไร |
|---|---|---|---|
| **CP0** | ระหว่าง M1 (1-2 ชั่วโมง ไม่ต้องรอโค้ด) | ให้แม่ค้า 3 คนดู mock หน้าเดียว (Storybook หรือภาพนิ่ง) ของ onboarding ขั้น 3 และ dashboard | คำว่า "เป้ายอดขาย" ตรงภาษาเขาไหม · ถามเป้าเดือนหรือเป้าปี (Q9) · แถบ % แบบไหนอ่านง่าย — ราคาถูกที่สุดที่จะแก้ copy/template ตอนนี้ |
| **CP1** | หลัง M4 (1 สัปดาห์ รวมสรุปและแก้) | moderated 5-6 คน คนละ 30 นาที ยังไม่มี LINE — ให้ทำเองไม่ช่วย: สมัคร → เป้า → กรอกยอด 1 วัน → ติ๊ก checklist → สร้าง goal ชีวิต 1 ข้อ | metric §14 ข้อ 1 (สร้าง goal แรกได้เองไหม) · เข้าใจ cascade/week goal หรือรก · จะกรอกยอดขายทุกวันจริงไหม · ต้องมีปฏิทินไหม (Q3) · widget ไหนไม่มีใครดู (Q2) — **ถ้าข้อ 1 ตก ห้ามไป M5** ให้แก้ onboarding ก่อน (M5 เริ่มส่วน infra ที่ไม่ขึ้นกับผลได้ระหว่างรอ แต่ข้อความ digest ทำหลังสรุป) |
| **CP2** | หลัง M6 (field test 2 สัปดาห์) | 8-10 คน (ตามโควตา LINE — R1) ใช้จริงบนเครื่องตัวเอง ได้ digest ทุกเช้า; สัปดาห์ที่ 2 สัมภาษณ์ "ต่างจาก Notion/Griply ยังไง" | metric §14 ข้อ 2-3 · อัตราเชื่อม LINE · **go/no-go MVP** (billing, drag-drop, Creator) และจัดลำดับ backlog จาก feedback |

### 2.7 ประมาณการเวลา (solo dev, 5 วัน/สัปดาห์, มี DoD ตาม Q15(b), รวม deploy + แก้บั๊ก, ไม่รวมช่วง field test)

| Milestone | วันทำงาน | สะสม (สัปดาห์) |
|---|---|---|
| M0 ตั้งค่า + scaffold + migration แรก | 2-3 | 0.5 |
| M1 foundation + auth + onboarding 1-2 | 5-6 | 1.5-2 |
| M2 goals + cascade + progress + onboarding 3 | 7-8 | 3-3.5 |
| M3 tasks + recurring + undo + goal.completed | 5-6 | 4-4.5 |
| M4 seller + dashboard | 5-6 | 5-5.5 |
| CP1 ทดสอบ + แก้ | 2-3 | 5.5-6 |
| M5 events + cron + LINE | 5-6 | 6.5-7 |
| M6 ตั้งค่า + ปฏิทินสัปดาห์ + PWA + DoD + E2E | 6-8 | 8-8.5 |
| **รวม** | **37-46 วัน** | **≈ 7.5-9 สัปดาห์** |

- ถ้าใช้ "รายการตัด" ใน §3.1 ทั้งหมด (ไม่มีปฏิทิน, ไม่มี SW, story เฉพาะ domain, E2E 1 flow, ตัด DailyLife/gesture) → ≈ 30-34 วัน ≈ **6-7 สัปดาห์**
- Scope §12 ประเมิน 3-5 สัปดาห์ "ไม่รวมทดสอบ" — ต่ำกว่าความเป็นจริงราว 40-60% เมื่อรวม DoD, flow เชื่อม LINE, ปฏิทิน, PWA และการตั้งค่า SMTP/OA ที่ไม่ได้อยู่ในตาราง

---

## ส่วนที่ 3 — ตรวจสอบความเป็นไปได้ (พูดตรง ๆ)

### 3.1 ส่วนของ POC ที่ใหญ่เกินไป ควรตัดหรือลด

| ส่วน | ทำไมใหญ่เกิน | ข้อเสนอ | ประหยัด |
|---|---|---|---|
| ปฏิทิน 4 มุมมอง | มุมมองปี/เดือนบนมือถือต้อง virtualize + ออกแบบ density; ไม่ตอบคำถาม POC ("คนใช้ cascade + persona ไหม") | เหลือสัปดาห์ (Q3) หรือตัดทั้งแท็บ | 3-4 วัน |
| Offline write queue | offline-first sync เป็นระบบทั้งระบบ ขัดกับ Server Actions | banner อ่านอย่างเดียว (Q5) | 5-10 วัน |
| Swipe / long-press | touch gesture บนเว็บมี edge case มากและทดสอบยาก | Sheet มีปุ่มครบ (Q6) | 1-1.5 วัน |
| `DailyLifeWidget` | ยังไม่นิยาม และซ้อนกับ `GoalProgressWidget` | ตัดหรือรวม (Q2) | 0.5-1 วัน |
| `WidgetPicker` + `dashboard_layouts` | fixed layout ไม่ต้องใช้; เป็นของ MVP อยู่แล้ว | เลื่อนไป MVP (Q1) | 2-3 วัน |
| RRULE เต็ม | UI recurrence เต็ม (ทุก N วัน, รายเดือนวันที่ X, วันสุดท้ายของเดือน) ไม่มี use case ใน seller | daily/weekly subset เก็บใน format RRULE (Q4) | 1-2 วัน |
| goal ระดับ วัน/ไตรมาส ใน UI | tree 5 ชั้นบนมือถือดูไม่รู้เรื่อง; "วัน" ซ้ำกับ task | ซ่อนใน POC เก็บ enum (Q9) | 1 วัน + UX ดีขึ้น |
| Service worker เต็มรูปแบบ | cache หน้า RSC + Server Actions มีบั๊กเยอะ, ปัญหา Turbopack (R5) | precache static shell เท่านั้น หรือแค่ manifest ถ้า R5 ติด | 1-2 วัน |
| Storybook ทุก component + Lighthouse CI | ภาระ solo dev (Q15) | เฉพาะ domain + widget; Lighthouse มือท้าย milestone | 3-4 วัน |

### 3.2 ส่วนที่เอกสารประเมินง่ายเกินจริง

1. **"POC 3-5 สัปดาห์"** — ดู §2.7: ตัวเลขนี้ไม่ได้รวม DoD 9 ข้อ, flow เชื่อม LINE (Q12), SMTP/domain, ปฏิทิน, PWA, และ user test; ประมาณจริง 6-9 สัปดาห์แล้วแต่รายการตัด
2. **"LINE notification พื้นฐาน"** — ซ่อน 4 งานย่อย: webhook + signature, flow จับคู่บัญชี, digest scheduler ที่ต้องรู้ "วันนี้" ตาม BKK, และโควตาที่มีต้นทุน (R1) — รวม ≈ 5-6 วัน ไม่ใช่ 1-2
3. **"Email + OTP"** — Supabase ให้ OTP มาจริง แต่ต้อง custom SMTP + verify domain + แก้ template ก่อนใช้กับคนนอกทีม (R2); ความเร็วส่งอีเมล (Gmail ~5 วิ, Hotmail อาจเป็นนาที) กระทบเป้า "onboarding 90 วินาที" โดยตรง — ต้องวัดจริงใน CP1
4. **"คำนวณ progress อัตโนมัติ"** — ไม่มีกฎ (Q8) และมี 2 แหล่งความจริง (ยอดขายกรอกมือ vs task) ถ้าไม่นิยามก่อน จะได้ % ที่ user ไม่เชื่อถือ ซึ่งทำลาย "ความคืบหน้าคือพระเอก" ทั้งแอป
5. **Recurring + "ทำต่อเนื่อง 7 วัน"** — schema เดิมเก็บประวัติไม่ได้ (Q4) → metric สำคัญของ POC วัดไม่ได้เลยถ้าไม่แก้ตอนนี้
6. **DatePicker พ.ศ. + สัปดาห์เริ่มอาทิตย์** — react-day-picker ไม่มี พ.ศ. ในตัว ต้องเขียน formatter caption/dropdown ปีเอง และตรวจทุกที่ที่ format วัน (~0.5-1 วัน)
7. **GitHub Actions "ทุก ~2 นาที"** — ทำไม่ได้ (Q13); ขั้นต่ำ 5 นาที และไม่ตรงเวลา
8. **Bundle < 200KB gz** กับ Recharts + Motion บนหน้าแรก — ถึงได้ต่อเมื่อ lazy อย่างมีวินัย (R8); ต้องวัดตั้งแต่ M4 ไม่ใช่ท้าย POC
9. **"~0 บาท/เดือน"** — จริงตอน dev แต่ช่วง field test อาจต้องจ่าย LINE Basic plan และค่าโดเมน/DNS ที่มีอยู่แล้ว

### 3.3 Dependency ภายนอกที่อาจบล็อกงาน

| Dependency | เสี่ยงบล็อกตรงไหน | เริ่มเมื่อไหร่ / ทางหนี |
|---|---|---|
| **LINE Official Account + Messaging API** | สร้าง channel ได้ทันที (ไม่ต้องรอ verify) แต่โควตาแผนฟรีจำกัดจำนวน tester (R1); webhook ต้องมี HTTPS สาธารณะ (Netlify มีให้; dev ท้องถิ่นต้องใช้ tunnel) | ทำใน M0 เพื่อให้มี token ก่อน M5; ตั้งงบสำรอง ~1,200 บาทสำหรับเดือน CP2 |
| **Resend/SMTP + โดเมน kemtit.com** | ถ้าไม่มีสิทธิ์แก้ DNS ของโดเมน จะส่ง OTP ให้คนนอกไม่ได้เลย → บล็อก CP1 ทั้งหมด | ทำใน M0; ทางหนี: ใช้ subdomain/โดเมนอื่นที่คุมได้, หรือ Brevo/Postmark |
| **Supabase free tier** | pause 7 วัน (R9), จำกัด 2 project, ไม่มี branching | วินัย migration ผ่าน CLI ตั้งแต่ M0; cron ช่วยกัน pause ระหว่าง CP2 |
| **Netlify free tier** | ราคาแบบ credit (ปี 2025) และ function timeout 10 วิ (R4) | เช็คโควตาปัจจุบันตอน M0; ปริมาณ POC (cron ทุก 5 นาที ≈ 9,000 invocation/เดือน + user) ควรอยู่ในแผนฟรี |
| **GitHub Actions** | latency/หยุด 60 วัน (Q13, R10) | keepalive ตั้งแต่ M5; ทางหนี pg_cron ครึ่งวัน |
| **Apple/iOS** | PWA ไม่มี install prompt, ไม่มี push (ไม่กระทบเพราะใช้ LINE) | คู่มือติดตั้ง (R11) |
| **Omise/Opn** | **ไม่บล็อก POC** (ไม่มี billing) แต่ onboarding บัญชี merchant + KYC ใช้เวลา 1-3 สัปดาห์ | เริ่มยื่นช่วง CP2 ถ้าตั้งใจไป MVP เพื่อไม่ให้บล็อกตอนนั้น |
| **Node/Next/Netlify version drift** | Node 26 ในเครื่อง vs Netlify (R15); Next 16 Turbopack vs Serwist (R5) | ปักหมุด Node 22 + ทดสอบ build ใน M0 |

---

## ข้อเสนอนอก scope (ไม่ทำใน POC เว้นแต่คุณอนุมัติ — แยกไว้ตามที่ขอ)

1. **Sentry (ฟรี)** — field test 2 สัปดาห์โดยไม่มี error monitoring จะไม่รู้ว่า tester เจออะไร; ติดตั้ง 1 ชั่วโมง เก็บ error ฝั่ง server action + client
2. **PDPA ขั้นต่ำ** — ข้อความยินยอม 1 บรรทัดหน้า login + หน้านโยบายความเป็นส่วนตัว static (ครึ่งวัน) — ไม่ใช่ feature แต่เป็นข้อกฎหมายเมื่อเก็บอีเมล/LINE ของคนจริง
3. **pg_cron เป็นตัวสำรอง** ของ GitHub Actions (Q13) — เตรียม migration ไว้แต่ปิด comment จนกว่าจะตัดสินใจเปิด
4. **หน้า "ติดตั้งบน iPhone/Android"** — รวมไว้ใน M6 แล้วในรูปแบบสั้นที่สุด ถ้าเห็นว่าเกิน ให้ตัด
5. **เริ่มยื่น Omise merchant ล่วงหน้า** ช่วง CP2 (ดู §3.3) — ไม่มีโค้ด แค่กระบวนการ
6. **`analytics` ผ่าน `domain_events`** (R13) — ผมนับว่าอยู่ใน scope "Domain Event Log" อยู่แล้ว แต่แจ้งไว้เพราะเพิ่ม event type ที่เอกสารไม่ได้ระบุ (`onboarding.completed`, `goal.created`, `sales.recorded`, `line.linked`, `persona.viewed`)

---

## 3 สิ่งที่ผมควรตัดสินใจก่อนคุณเริ่มลงมือ

1. **กฎของ goal และ schema ที่ล็อกใน migration 0002** — ตอบ Q8 (metric vs execution progress, นิยาม completed/ตกเป้า), Q9 (ระดับ ปี→เดือน→สัปดาห์ + task, template สร้าง week goal อัตโนมัติ, onboarding ถามเป้าเดือน), Q4 (`task_completions` + recurrence subset), Q10 (`seller_sales_entries`) — สี่ข้อนี้กำหนดตารางที่แก้ทีหลังแพงที่สุด และเป็นแกนของสิ่งที่ POC ต้องพิสูจน์
2. **ขอบเขต LINE และ cron** — ตอบ Q11 (congrats + digest 07:30), Q12 (เชื่อมบัญชีด้วยรหัสผ่าน webhook), Q13 (คง GitHub Actions ทุก 5 นาที ยอมรับ latency หรือไป pg_cron) และจำนวน tester รอบ CP2 เทียบโควตาฟรี (R1) — กำหนดงาน M5 ทั้งก้อนและงบประมาณเดือน field test
3. **รายการตัดของ POC** — ตอบ Q1 (fixed จริง ไม่มี WidgetPicker), Q2 (4 widget ตัด DailyLife), Q3 (ปฏิทินสัปดาห์เท่านั้น), Q5 (ไม่มี offline queue), Q6 (Sheet แทน gesture), Q15 (Storybook เฉพาะ domain + widget) — ชุดคำตอบนี้คือความต่างระหว่าง POC 6-7 สัปดาห์ กับ 8-9 สัปดาห์

**ขั้นตอนหลังอนุมัติ**: เริ่ม M0 (ส่วน A ของ §2.2 เป็นของคุณ ส่วน B-E ผมทำโดยแจ้งรายการไฟล์ก่อนสร้างทุกครั้ง) → M1 เท่านั้น ตามกฎใน prompt ต่อเนื่อง — ไม่ข้าม milestone
