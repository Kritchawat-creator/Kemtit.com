# Kemtit (เข็มทิศ)
## Full Proposal & Scope of Work — Proof of Concept

*"เข็มทิศ" — เครื่องมือนำทางที่ชี้ให้เห็นว่าวันนี้ต้องก้าวไปทางไหน เพื่อไปถึงเป้าหมายที่วางไว้*

---

## 1. Executive Summary

Kemtit คือเว็บแอปพลิเคชัน (PWA) ที่รวม **เป้าหมายธุรกิจ** และ **ชีวิตส่วนตัว** เข้าไว้ในระบบเดียวกัน ผ่านกลไก **Goal Cascade** (ปี→ไตรมาส→เดือน→สัปดาห์→วัน) ที่ทุก persona ใช้ร่วมกัน บวกกับ **Persona Module** เฉพาะทาง 4 กลุ่ม (พ่อค้าแม่ค้าออนไลน์, Creator, นักเรียน, พนักงานออฟฟิศ) ออกแบบเป็นภาษาไทยเนทีฟ แจ้งเตือนผ่าน LINE และตั้งราคาที่ตลาดไทยจ่ายไหว

เอกสารนี้ให้รายละเอียดระดับ scope of work: โครงสร้างระบบ, ฟีเจอร์/ฟังก์ชันทุกตัวพร้อมจุดประสงค์การใช้งาน, data model, user flow, และการแบ่ง scope ระหว่าง Proof of Concept (POC) / MVP / Full Product เพื่อให้เห็นภาพการทำงานของระบบทั้งหมดก่อนเริ่มพัฒนาจริง

---

## 2. วัตถุประสงค์โครงการ

1. พิสูจน์ว่า "Goal Cascade + Life Domain + Business Persona" ในระบบเดียว แก้ปัญหาจริงให้กลุ่มเป้าหมายได้ (validate ด้วย POC)
2. สร้างรายได้แบบ subscription ที่ยั่งยืนจากราคาที่ตลาดไทยรับได้ (300-600 บาท/ปี)
3. วาง architecture ที่ solo developer ดูแลได้จริง ขยาย persona ใหม่ได้โดยไม่ rewrite

---

## 3. กลุ่มผู้ใช้เป้าหมาย (Personas)

| Persona | Pain point หลัก | สิ่งที่ Kemtit แก้ให้ | ลำดับความสำคัญ |
|---|---|---|---|
| **พ่อค้าแม่ค้าออนไลน์** | มีเป้ายอดขายในหัวแต่ไม่เคยแตกเป็นงานรายวันจริงจัง เครื่องมือที่มี (Page365 ฯลฯ) ทำแค่หลังบ้าน ไม่ช่วยวางแผน | ผูก "เป้ายอดขายเดือนนี้" เข้ากับ "งานที่ต้องทำวันนี้" โดยตรง | **Beachhead — POC/Phase 1** |
| **Creator** | คอนเทนต์กระจัดกระจายหลายแอป (Notion+Todoist+Canva) ไม่เชื่อมกับเป้ารายได้/follower | Content pipeline ผูกเป้าในที่เดียว | Beachhead ทางเลือก — Phase 1 |
| **นักเรียน/นักศึกษา** | นับถอยหลังสอบแยกจากแผนอ่านหนังสือ ไม่มีแอปไทยที่ผูกสองอย่างนี้เข้าด้วยกัน | Exam countdown + แผนอ่านหนังสือในที่เดียว | Phase 2 |
| **พนักงานออฟฟิศ** | มี Google Calendar/Todoist อยู่แล้วแต่ไม่มี goal cascade ระดับไตรมาส | OKR + weekly review ที่ไม่ต้องใช้เครื่องมือแพงแบบ Motion/Sunsama | Phase 2 |

---

## 4. System Architecture Overview

**รูปแบบ**: Modular Monolith + Event-driven overlay บน Serverless (Next.js + Netlify + Supabase)

```
                    ┌─────────────────────────────┐
                    │   Client (Browser, PWA)      │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │   Netlify (Next.js App Router)│
                    │   Server Components + Actions  │
                    └──────────────┬────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌───────▼────────┐       ┌─────────▼─────────┐      ┌─────────▼────────┐
│  core/          │       │  modules/          │      │ shared-services/ │
│  goals, tasks   │◄──────┤  seller, creator,   │      │ notifications,   │
│  shared kernel  │       │  student, office     │      │ billing          │
└───────┬─────────┘       └────────────────────┘      └────────┬──────────┘
        │                                                        │
        └──────────────────────┬─────────────────────────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │   Supabase                 │
                    │   Postgres+RLS, Auth,      │
                    │   Storage                  │
                    └────────────────────────────┘
```

**กฎ boundary**: `modules/*` ห้าม import กันเอง สื่อสารผ่าน `core/ports` หรือ `domain_events` เท่านั้น — ทำให้เพิ่ม persona ใหม่ในอนาคตไม่กระทบของเดิม

---

## 5. Full Feature Specification

### 5.1 Core Module (ใช้ร่วมกันทุก persona)

| Feature | Function | Purpose (ใช้ทำอะไร) |
|---|---|---|
| **Goal Cascade Engine** | สร้าง/แก้ไข goal แยกตาม period (ปี/ไตรมาส/เดือน/สัปดาห์/วัน), ผูก parent-child ระหว่าง goal, auto-suggest ช่วงวันที่ตาม parent | แตกเป้าใหญ่ระดับปีให้เป็นก้าวเล็กที่ลงมือทำได้จริงวันนี้ — แก้ปัญหา "ตั้งเป้าปีใหม่แล้วลืม" |
| **Progress Rollup** | คำนวณ % ความสำเร็จของ goal แม่จาก goal/task ลูกอัตโนมัติ | เห็นภาพรวมความคืบหน้าโดยไม่ต้องอัปเดตมือทุกระดับ |
| **Task Management** | CRUD, recurring task (RRULE), overdue detection, mark complete/undo | หน่วยปฏิบัติการย่อยที่สุด ผูกกับ goal ได้หรือเป็น standalone todo |
| **Domain Tagging** | ทุก goal/task มี `domain`: work / health / family / finance / growth / relationships | รวมเป้าธุรกิจกับชีวิตส่วนตัวในระบบเดียว ไม่ต้องสลับแอป |
| **Multi-view Calendar** | สลับมุมมอง วัน/สัปดาห์/เดือน/ปี | ดูภาพรวมได้ตามบริบทที่ต้องการ ณ ขณะนั้น |
| **Custom Dashboard** | Widget registry กลาง + drag-drop จัดวาง (desktop), stack แนวตั้ง (mobile), บันทึก layout ต่อ user | แต่ละ user เห็นสิ่งที่สำคัญกับตัวเองก่อนโดยไม่ต้องเหมือนกันทุกคน |
| **Auth & Onboarding** | สมัคร/ล็อกอิน email+OTP, เลือก persona ตอนแรกเข้า (สลับทีหลังได้), โหลด default dashboard layout ตาม persona | ลดขั้นตอน setup ให้ user เริ่มใช้งานได้ทันทีโดยไม่ต้องตั้งค่าเอง |

### 5.2 Persona Modules

**Seller (พ่อค้าแม่ค้าออนไลน์) — Beachhead**

| Feature | Function | Purpose |
|---|---|---|
| เป้ายอดขายรายเดือน | ตั้ง target_value เป็นยอดขาย ผูกกับ goal cascade หลัก | เป้าธุรกิจที่จับต้องได้เป็นตัวเลขชัดเจน |
| บันทึกยอดขายจริงรายวัน | กรอก current_value manual (Phase 1), import CSV จาก Page365 (Phase 2) | เทียบยอดขายจริงกับเป้าแบบ real-time |
| Widget "ยอดขาย vs เป้า" | แสดง progress bar/กราฟแท่งเทียบเป้าเดือนนี้ | เห็นสถานะทันทีที่เปิดแอป ไม่ต้องคำนวณเอง |
| Checklist ประจำร้าน | รายการ task ซ้ำรายวัน (เช็คสต็อก, แพ็คของ, ปิดยอด, ตอบแชท) | routine งานร้านที่ทำทุกวันไม่ต้องสร้างใหม่ทุกครั้ง |

**Creator**

| Feature | Function | Purpose |
|---|---|---|
| Content Pipeline | บอร์ดสถานะ ไอเดีย → ร่าง → ตารางโพสต์ → โพสต์แล้ว | เห็นภาพรวมงานคอนเทนต์ทุก stage ในที่เดียว |
| ปฏิทินคอนเทนต์ | แยกตาราง posting ตาม platform (IG/TikTok/YouTube) | วางแผนความถี่โพสต์แต่ละช่องทางแยกกันได้ |
| ผูกเป้า Follower/Engagement | goal ที่ผูกกับ content task โดยตรง | เห็นว่าทำคอนเทนต์วันนี้เพื่ออะไรในภาพใหญ่ |

**Student (Phase 2)**

| Feature | Function | Purpose |
|---|---|---|
| Exam Countdown | นับถอยหลังวันสอบ ผูกกับแผนอ่านหนังสือ | สร้างความเร่งด่วนที่จับต้องได้ ไม่ใช่แค่ตัวเลขวันในปฏิทิน |
| ตารางเรียน/สอบ | บันทึกตารางเรียนรายสัปดาห์ | เห็นเวลาว่างจริงสำหรับวางแผนอ่านหนังสือ |
| เป้าเกรดต่อวิชา | ตั้งเป้าคะแนน ผูกกับ task อ่านหนังสือ | เชื่อมการอ่านหนังสือรายวันกับผลลัพธ์ที่ต้องการ |

**Office Worker (Phase 2)**

| Feature | Function | Purpose |
|---|---|---|
| OKR รายไตรมาส | Objective + Key Results ผูกกับ goal cascade ระดับไตรมาส | มาตรฐาน goal-setting ที่ใช้ในองค์กรจริง แต่เบากว่า tool องค์กรใหญ่ |
| Weekly Review Ritual | เช็คลิสต์ทบทวนทุกสัปดาห์ว่าตามเป้าไหม | ฟีเจอร์ที่ทำให้ Sunsama ติดตลาด แต่เวอร์ชันไทยที่เข้าใจง่ายกว่า |

### 5.3 Shared Services

| Feature | Function | Purpose |
|---|---|---|
| **LINE Notification** | ส่งข้อความผ่าน LINE Official Account เมื่องานใกล้ครบกำหนด หรือทำเป้าสำเร็จ | แจ้งเตือนในแอปที่ user เปิดอยู่แล้วทุกวัน ไม่ต้องพึ่ง native push |
| **Domain Event Log** | ทุก action สำคัญ (goal complete, task overdue) บันทึกลงตาราง `domain_events` | Decouple ระหว่าง action หลักกับ side-effect (แจ้งเตือน, billing) |
| **Subscription/Billing** | Free tier (จำกัด 1 persona) / Pro tier (ปลดล็อกทุก persona) ผ่าน Omise/Opn | โมเดลรายได้หลัก — จ่ายผ่านเว็บเลี่ยงค่าคอมมิชชั่น app store 15% |

### 5.4 Admin & Operations

| Feature | Function | Purpose | Phase |
|---|---|---|---|
| ดู/ค้นหา user, refund | จัดการบัญชี user รายคน | รองรับ support | POC: ใช้ Supabase Studio / Phase 2: UI เอง |
| Override subscription | เปลี่ยน tier manual | กรณี payment ผิดพลาดต้องแก้เอง | เหมือนกัน |
| Dashboard metrics | DAU, churn, conversion ต่อ persona | วัดผล product-market fit | Phase 2 |

---

## 6. Data Model (Schema หลัก)

```sql
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references goals(id) on delete cascade,
  period_type text not null check (period_type in ('year','quarter','month','week','day')),
  period_start date not null,
  domain text not null default 'work'
    check (domain in ('work','health','family','finance','growth','relationships')),
  title text not null,
  target_value numeric,
  current_value numeric default 0,
  persona_data jsonb default '{}',
  status text not null default 'active',
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  domain text not null default 'work'
    check (domain in ('work','health','family','finance','growth','relationships')),
  title text not null,
  due_date date not null,
  recurrence_rule text,
  completed_at timestamptz,
  persona_data jsonb default '{}',
  created_at timestamptz default now()
);

create table dashboard_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null default '[]',
  updated_at timestamptz default now()
);

create table domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  user_id uuid not null,
  processed_at timestamptz,
  created_at timestamptz default now()
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active_persona text check (active_persona in ('seller','creator','student','office')),
  subscription_tier text not null default 'free',
  line_user_id text,
  created_at timestamptz default now()
);

-- RLS ทุกตาราง: auth.uid() = user_id คือ security perimeter หลัก
```

---

## 7. Key User Flows

**Flow A — New user onboarding**
1. สมัครด้วย email → รับ OTP → ยืนยัน
2. เลือก persona (seller/creator/student/office)
3. ระบบโหลด default dashboard layout + widget ตาม persona ที่เลือก
4. สร้าง goal แรก (ระบบแนะนำ template ตาม persona เช่น "ตั้งเป้ายอดขายเดือนนี้")
5. ระบบ cascade goal ปีนั้นอัตโนมัติเป็น task รายวันตัวอย่าง

**Flow B — Daily usage**
1. เปิดแอป → เห็น dashboard ที่จัดเรียงเองไว้ (widget ยอดขาย, งานวันนี้, ชีวิตประจำวัน)
2. ทำ task เสร็จ → กดติ๊ก
3. ระบบอัปเดต progress rollup ของ goal แม่อัตโนมัติ
4. ถ้าทำเป้าสำเร็จ (100%) → insert `domain_events` (`goal.completed`)

**Flow C — Event → Notification (ตามที่ออกแบบ architecture ไว้)**
1. Task/Goal complete → insert แถวใน `domain_events`
2. GitHub Actions ยิง Route Handler ทุก ~2 นาที
3. ระบบดึง event ที่ยังไม่ processed (batch เล็ก กันชน timeout)
4. Listener ประมวลผลแบบขนาน: ส่ง LINE congrats + อัปเดต billing usage
5. Mark `processed_at`

---

## 8. Non-Functional Requirements

| ด้าน | ข้อกำหนด |
|---|---|
| Security | RLS ทุกตาราง, `service_role` key ใช้เฉพาะ server-side, validate ทุก input ด้วย Zod ก่อนแตะ DB |
| Performance | Cache เฉพาะข้อมูลที่ไม่ผ่าน RLS ในช่วงแรก, widget lazy-load แยก chunk ต่อ persona |
| Scalability | Connection pooling (Supavisor), batch size เล็กสำหรับ cron job กัน timeout |
| Reliability | Keepalive workflow กัน GitHub Actions หยุดทำงานเงียบหลัง repo ไม่มี commit 60 วัน |

---

## 9. Tech Stack

| Layer | เทคโนโลยี |
|---|---|
| Frontend | Next.js (App Router) + TypeScript |
| Hosting | Netlify (OpenNext runtime) |
| Database/Auth/Storage | Supabase (Postgres+RLS, Auth, Storage) |
| Validation | Zod |
| Dashboard | react-grid-layout + widget registry |
| Messaging | LINE Official Account (Messaging API) |
| Payment | Omise/Opn Payments |
| Scheduling | GitHub Actions → Next.js Route Handler |
| Event system | ตาราง `domain_events` |
| PWA | Serwist (service worker + manifest) |

---

## 10. UI/UX & Frontend Specification

*(รายละเอียดฉบับเต็มอยู่ในเอกสารแยก `kemtit-ui-design-system.md` — ส่วนนี้คือสรุปที่จำเป็นต่อ scope รวม UX ฝั่ง client §10.9 และ admin §10.10)*

### 10.1 UI Technology Stack

| Layer | เลือกใช้ | เหตุผล |
|---|---|---|
| Styling | Tailwind CSS v4 | Utility-first, design token ผ่าน CSS variables, tree-shake ดี |
| Component primitives | shadcn/ui (Radix + Tailwind) | copy code เข้าโปรเจกต์ ไม่ติด vendor, ได้ accessibility จาก Radix ฟรี |
| Icons | Lucide React | ชุดเดียวทั้งแอป tree-shakeable |
| Dashboard grid | react-grid-layout | drag-drop + resize + persist layout |
| Charts | Recharts | widget ยอดขาย/progress |
| Form | React Hook Form + Zod resolver | ใช้ Zod schema เดียวกับฝั่ง server |
| Date | date-fns + date-fns-tz | รองรับ Asia/Bangkok |
| Animation | Motion (framer-motion) | ใช้เท่าที่จำเป็นตาม §10.6 |
| Toast | Sonner | เข้ากับ shadcn/ui |

**ไม่เลือก**: MUI/Ant Design (override ยาก หน้าตาเหมือนแอปอื่นทั้งโลก), CSS-in-JS (runtime overhead, เข้ากับ RSC ไม่ดี)

### 10.2 Design Direction

**Primary job ของ UI**: ทำให้เห็นภายใน 3 วินาทีว่า "วันนี้ต้องทำอะไร และมันพาไปถึงเป้าไหม"

หลักการ 4 ข้อ: (1) ความคืบหน้าคือพระเอก — ตัวเลข % เด่นที่สุดในทุกหน้าจอ (2) เงียบเมื่อไม่มีอะไรต้องบอก — สีสงวนไว้สำหรับความหมายจริง (3) แตะง่ายบนมือถือ — ทุก interactive element ≥44px (4) ภาษาไทยเป็นพลเมืองชั้นหนึ่งตั้งแต่ต้น

### 10.3 Color System

**โทนที่เลือก: สดใส น่ารัก แต่ยังดูเก๋ ไม่เด็ก** — สีสดใสอยู่ที่พื้นผิวและ accent ส่วนตัวเลข/ข้อมูลยังคงคมชัดจริงจัง เพื่อไม่ให้แม่ค้าที่ดูยอดขายรู้สึกว่ากำลังใช้ของเล่น

**Brand — ลาเวนเดอร์**: `#7A5FE0` เป็น primary, ไล่ระดับ 50-900 — สดใสน่ารักแต่มีรสนิยม และแยกตัวจากคู่แข่งที่ใช้น้ำเงิน/เขียว/แดงกันหมด
**Accent — พีชชมพู**: `#F5648C` ใช้เน้นจุดเดียวต่อหน้าจอ
**Neutral — cool gray แต้มม่วงจาง**: `#FBFAFF` → `#1A1822` (เข้ากับ brand ไม่ตีกัน)
**Semantic**: success `#17A88C` / warning `#E09112` / danger `#E14B52` — สดใสกว่าชุด corporate ทั่วไป

**กฎการใช้สีคู่ (สำคัญที่สุดของโทนนี้)**: พาสเทลพัง contrast ง่ายมาก จึงกำหนดตายตัว — พื้น 50-100 → ตัวหนังสือ 800-900 เสมอ · พื้น 500 → ตัวหนังสือขาวเสมอ

**Life domain colors** (6 domain — แสดงเป็น pill มน แต่ละตัวจับคู่พื้นอ่อน+ตัวหนังสือเข้ม, ต้องมี label ข้อความกำกับเสมอ):
งาน `#8B72EA` · สุขภาพ `#17A88C` · ครอบครัว `#F5648C` · การเงิน `#2E8FD8` · พัฒนาตัวเอง `#E09112` · ความสัมพันธ์ `#B457C9`

**Semantic token layer**: component ห้ามเรียกสีดิบ ต้องผ่าน `--color-bg-surface`, `--color-text-primary` ฯลฯ — ทำให้เพิ่ม dark mode ทีหลังได้โดยไม่แตะ component แม้แต่ตัวเดียว

**Contrast**: ทุกคู่สีต้องผ่าน WCAG AA (text ≥4.5:1, UI element ≥3:1)

### 10.4 Typography

**Font: IBM Plex Sans Thai** — ไทยกับละตินอยู่ในระบบเดียวกันจริง วรรณยุกต์ถูกออกแบบมาไม่ชนบรรทัดบน open source ใช้เชิงพาณิชย์ได้

**ความน่ารักมาจาก weight และ radius ไม่ใช่จาก font ลายมือ** — font ไทยแบบตกแต่งอ่านยากในขนาดเล็กและทำให้ตัวเลขยอดขายดูไม่น่าเชื่อถือ ใช้ weight 600 กับหัวข้อแทน

Type scale: display 36/1.25 · h1 24/1.4 · h2 20/1.45 · h3 17/1.5 · body 15/1.7 · small 13/1.6 · caption 12/1.5 (weight 500)

⚠️ **line-height ภาษาไทยต้องสูงกว่าอังกฤษ** — สระบนและวรรณยุกต์ซ้อน 2 ชั้น (เช่น "ที่") ทำให้ต้องใช้ body ที่ 1.7 ขั้นต่ำ และห้ามใช้ font-weight ต่ำกว่า 400

**ตัวเลข**: `font-variant-numeric: tabular-nums` ทุกที่ที่ค่าเปลี่ยนได้ กันตัวเลขขยับเวลาอัปเดต

### 10.5 Spacing, Radius, Elevation

- Spacing scale 4px base: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Radius (ใหญ่กว่า productivity app ทั่วไปหนึ่งขั้น เพื่อความเป็นมิตร): sm 10px · md 14px (button) · lg 20px (card, modal) · xl 28px (hero) · full (avatar, domain pill, FAB)
- Elevation: **เงาสีอ่อนจากตระกูล brand แทนเงาเทา** (เงาเทาทำให้พาสเทลดูหม่น) — `0 4px 12px rgba(122,95,224,0.10)` เป็นต้น
- Decorative ที่อนุญาต: progress ring ปลายมน · พื้น card tint ตาม domain · confetti ตอนทำเป้าสำเร็จ (ครั้งเดียว)
- **ห้ามใช้**: gradient พาดทั้งหน้า, mascot/ตัวการ์ตูน, glassmorphism, เงานีออน, sticker ประดับมุมจอ

### 10.6 Motion

Motion ตอบสนองการกระทำของ user เท่านั้น **ห้าม animate เองตอนโหลดหน้า**

ติ๊ก task 150ms · progress เปลี่ยนค่า 400ms ease-out · เปิด modal 200ms · drag ตาม cursor ทันที · ทำเป้าสำเร็จ celebration ครั้งเดียว 800ms

ห้ามทำ: fade-in-up ทุก section ตอนโหลด, hover animation ทุก card, skeleton pulse ตลอดเวลา
`prefers-reduced-motion` ต้องปิด animation ทั้งหมด

### 10.7 Component Inventory

**Primitives (shadcn/ui)**: Button, Input, Select, Checkbox, Switch, Dialog, Sheet, Dropdown, Popover, Tabs, Tooltip, Badge, Avatar, Skeleton, Toast

**Domain components (เขียนเอง)**: `GoalCard` · `GoalCascadeTree` · `ProgressRing` · `ProgressBar` · `TaskRow` · `TaskList` · `DomainTag` · `PeriodSwitcher` · `DatePicker` (รองรับ พ.ศ.) · `WidgetShell` · `WidgetPicker` · `EmptyState` · `StatTile`

**Widgets ต่อ persona**: `SalesVsGoalWidget`, `ShopChecklistWidget` (seller) · `ContentPipelineWidget` (creator) · `ExamCountdownWidget` (student) · `OKRWidget` (office) · `TodayTasksWidget`, `GoalProgressWidget`, `DailyLifeWidget` (ทุก persona)

### 10.8 Layout & Responsive

- mobile < 640px: single column, bottom nav 4 แท็บ + FAB, **ไม่มี drag-drop**
- tablet 640-1024px: 2 column
- desktop > 1024px: 12-column react-grid-layout เต็มรูปแบบ + sidebar

**Mobile-first เป็นข้อบังคับ** — คนไทยส่วนใหญ่เข้าผ่านมือถือ เขียน CSS mobile-first และทดสอบมือถือจริงก่อน desktop ทุกฟีเจอร์

### 10.9 UX ฝั่ง Client (End-user)

**Information architecture**: bottom nav 4 แท็บ (แดชบอร์ด / เป้าหมาย / ปฏิทิน / ตั้งค่า) + FAB "เพิ่ม" — ทุกหน้าเข้าถึงได้ใน 2 แตะ ไม่มีเมนูซ้อนชั้นที่ 3

**Screen inventory**: Onboarding 3 ขั้น · แดชบอร์ด · เป้าหมาย (list/detail + cascade tree) · ปฏิทิน · สร้าง/แก้ goal · สร้าง/แก้ task · ตั้งค่า · Subscription

**Onboarding — จุดที่ user หลุดมากสุด**: เป้าหมายคือได้ goal แรก + เห็น dashboard ใน 90 วินาที — email+OTP (auto-submit) → เลือก persona (บังคับ ไม่มีข้าม) → ตั้ง goal แรกจาก template ที่ pre-fill ตาม persona แก้แค่ตัวเลข → ไปแดชบอร์ด · **ห้ามขอข้อมูลที่ยังไม่จำเป็น** (ชื่อเล่น, รูป, เชื่อม LINE) ในขั้นนี้

**Dashboard**: widget แรกบนสุดเสมอคือ goal หลักเดือนนี้ · empty state ภายใน widget เมื่อยังไม่มีข้อมูล · WidgetPicker แสดงเฉพาะ widget ของ persona ปัจจุบัน + widget กลาง

**Task interaction**: ติ๊กเสร็จ / แตะแก้ (Sheet บนมือถือ, Dialog บน desktop) / swipe ลบ + **undo toast 5 วินาที แทน confirm dialog** / long-press เลื่อนวัน

**State ครบทุกหน้า**: Skeleton รูปทรงเดียวกับ content · EmptyState + CTA · error inline บอกวิธีแก้ · offline banner สำหรับ PWA

**Subscription touchpoint**: feature gating **บอกก่อนชน** — widget Pro-only แสดงใน picker พร้อม badge, ไม่มี popup ขายสุ่ม, nudge เฉพาะตอนชนขีดจำกัดจริง

### 10.10 UX ฝั่ง Admin Console

ใช้ token/font/spacing ชุดเดียวกับ client แต่ปรับ: **แน่นกว่า** (font 14px, spacing ลดหนึ่งขั้น) · **พื้นขาว/เทากลาง** สีสงวนสำหรับ status · **radius md 14px** · **ตาราง+ฟอร์ม** เป็นหลัก · **ไม่มี motion** ยกเว้น feedback · **sidebar ถาวร desktop only** (ไม่ทำ mobile)

**IA**: ภาพรวม (DAU, ผู้ใช้ใหม่, Pro, churn, conversion ต่อ persona) · ผู้ใช้ (list/detail แสดงสิ่งที่ user เห็น) · Subscription/refund · Events (`domain_events` ค้าง + retry) · Feature flag · ค้นหาทั่วระบบ Cmd+K

**Data table**: bordered row 44px · tabular-nums ชิดขวา · วันที่ relative + tooltip · Badge สี+ข้อความ · 50 แถว/หน้า server-side · bulk action bar

**Destructive action — ตรงข้ามกับ client**: การกระทำที่กระทบเงิน/บัญชีคนอื่น **ต้อง confirm** (undo ทำไม่ได้กับ refund ที่ส่ง Omise แล้ว) — override tier ต้องกรอกเหตุผล, refund ต้องพิมพ์จำนวนเงินยืนยัน, ลบ user ต้องพิมพ์ email ยืนยัน · ทุก action ลง audit log

**Security UX**: `/admin` route group แยก layout · badge "ADMIN" สีแดงจางทุกหน้ากันสับสน · session 8 ชม.

**Phase**: POC/MVP ใช้ Supabase Studio → Phase 2 ภาพรวม+ผู้ใช้+override+events → Phase 3 refund UI+feature flag+audit viewer

### 10.11 Accessibility (บังคับทุก component)

Focus ring มองเห็นชัด · touch target ≥44px · icon-only button มี `aria-label` · form มี `<label>` จริงไม่ใช่ placeholder · error ผ่าน `aria-live` · keyboard navigate ได้ครบทุก flow · เคารพ `prefers-reduced-motion`

### 10.12 i18n & Localization

แม้ทำภาษาไทยอย่างเดียวในเฟสแรก แต่วางโครงไว้: ห้าม hardcode ข้อความ (ใช้ `next-intl`/`messages/th.json`) · timezone fix `Asia/Bangkok` เก็บ UTC ใน DB · รองรับปฏิทิน พ.ศ. เป็น option · สกุลเงินผ่าน `Intl.NumberFormat('th-TH')` · **วันแรกของสัปดาห์เป็นวันอาทิตย์**

### 10.13 Performance Budget

LCP < 2.5s (4G) · CLS < 0.1 · INP < 200ms · initial JS < 200KB gzipped

วิธีถึงเป้า: widget lazy-load แยก chunk ต่อ persona · Server Component เป็นค่าเริ่มต้น · `next/image` ทุกรูป · font `display: swap` + preload subset ไทย · Skeleton กัน layout shift

### 10.14 Frontend Tooling

Storybook (พัฒนา component แยก ดูทุก state) · ESLint + `jsx-a11y` · Prettier + `prettier-plugin-tailwindcss` · Vitest + RTL · Playwright (E2E: onboarding, สร้าง goal, ติ๊ก task) · Lighthouse CI ทุก PR

### 10.15 Definition of Done ต่อ UI Component

ก่อน merge ต้องผ่านครบ: ใช้ semantic token ไม่มี hex ดิบ · รองรับ mobile+desktop · keyboard navigate ได้ + focus ring · มี loading/empty/error state ครบ · contrast ผ่าน AA · ข้อความจาก i18n · ตัวเลขผ่าน formatter · `prefers-reduced-motion` ทำงาน · มี Storybook story ≥3 state

---

## 11. Scope Definition: POC vs MVP vs Full Product

| Scope | รวมอะไรบ้าง | เป้าหมายของ scope นี้ |
|---|---|---|
| **POC** | Core (goal cascade+task) + persona เดียว (Seller) + LINE notification พื้นฐาน + dashboard แบบ fixed layout (ยังไม่ drag-drop) + **ไม่มี billing** | พิสูจน์ว่า concept ใช้งานได้จริงทางเทคนิคและ user เห็นคุณค่า ก่อนลงทุนทำ payment/subscription |
| **MVP** | POC + drag-drop dashboard + Subscription ผ่าน Omise + Persona ที่ 2 (Creator) | พิสูจน์ว่ามีคนยอมจ่ายเงินจริง — จุดตัดสิน go/no-go ธุรกิจ |
| **Full Product** | MVP + Persona ที่เหลือ (Student, Office) + Admin UI เต็มรูปแบบ + LINE Login + AI (เปิด port ที่เตรียมไว้) + Native app wrapper (Capacitor) | ขยายตลาดเต็มรูปแบบหลังพิสูจน์ product-market fit แล้ว |

**คำแนะนำ**: เริ่มจาก POC ก่อนเสมอ — ใช้เวลาน้อยที่สุด ต้นทุนต่ำสุด (ไม่มี payment integration ให้ debug) และตอบคำถามสำคัญที่สุดก่อน: "คนจะใช้ goal cascade + persona จริงไหม" ก่อนไปตอบคำถามเรื่องเงิน

---

## 12. Development Roadmap (โดยประมาณ, solo developer)

| Phase | ขอบเขต | ประมาณเวลา* |
|---|---|---|
| POC | Core + Seller persona + LINE reminder พื้นฐาน | 3-5 สัปดาห์ |
| MVP | + Dashboard drag-drop + Billing + Creator persona | 4-6 สัปดาห์ |
| Full Product | + Student/Office + Admin UI + AI + native wrapper | ต่อเนื่องตาม traction |

*ประมาณการคร่าวๆ สำหรับ solo dev ที่คุ้นเคย stack นี้แล้ว ไม่รวมเวลาทดสอบกับ user จริงและปรับตาม feedback

---

## 13. Cost Estimate (ไม่รวม AI)

| สเกล | ต้นทุนรวม/เดือน |
|---|---|
| POC/Dev | ~0 บาท (ทุกบริการมีแผนฟรี/sandbox เพียงพอ) |
| MVP (~300-500 user) | ~2,800 บาท |
| Growth (~50,000 MAU) | ~9,850 บาท |

**ราคาสมัครสมาชิกที่แนะนำ**: 300-600 บาท/ปี (อ้างอิงเทียบ TickTick ~1,200 บาท/ปี, Griply ~1,000 บาท/ปี ซึ่งพิสูจน์แล้วว่าตลาดจ่ายกับ pattern นี้)

---

## 14. Success Metrics สำหรับ POC

- User ทดสอบสร้าง goal แรกสำเร็จภายใน session แรกโดยไม่ต้องมีคนอธิบาย (วัด onboarding friction)
- อัตราการทำ task ต่อเนื่อง 7 วันติดต่อกัน (วัด retention เบื้องต้น)
- Feedback เชิงคุณภาพ: user ตอบคำถาม "ต่างจาก Notion/Griply ยังไง" ได้เองหรือไม่หลังใช้งานจริง (วัดว่า positioning ชัดจริง)

---

## 15. ความเสี่ยงหลักและการรับมือ

| ความเสี่ยง | การรับมือ |
|---|---|
| Feature creep ก่อนพิสูจน์ concept | ล็อก POC scope ตามข้อ 11 เคร่งครัด ห้ามเพิ่ม persona/ฟีเจอร์ระหว่างทำ POC |
| Griply/Notion ทำ pattern คล้ายกันในระดับโลก | Pitch ที่ compound differentiator (business persona + life domain + ไทย/LINE) เท่านั้น |
| GitHub Actions cron หยุดเงียบหลัง 60 วันไม่มี commit | Keepalive workflow ตั้งแต่ POC |
| ต้นทุน AI บานในอนาคตถ้าเปิดใช้ | Gate หลัง subscription tier + cache ตั้งแต่วันแรกที่เปิด (Phase 3) |

---

## 16. Out of Scope (ชัดเจนว่ายังไม่ทำในรอบนี้)

- AI แตกเป้าอัตโนมัติ (มี port เตรียมไว้ใน `core/ports/ai-suggestion.ts` แต่ไม่ implement)
- Native mobile app (iOS/Android แยก codebase)
- Custom field/schema แบบ Notion (เลือกทำแค่ drag-drop widget)
- LINE Login (ใช้ email/OTP ก่อน)
- Admin UI แบบเต็มรูปแบบ (ใช้ Supabase Studio ไปก่อนใน POC/MVP)
- Multi-language (ภาษาไทยเท่านั้นในทุก phase ที่ระบุไว้นี้ แต่วางโครง i18n พร้อมรองรับ)
- Dark mode UI จริง (วาง semantic token ไว้แล้ว แต่ยังไม่ทำใน POC)
- Drag-drop บนมือถือ (mobile stack แนวตั้งอย่างเดียว)
- Custom theme ให้ user เลือกสีเอง
- Animation ซับซ้อน/micro-interaction เกินที่ระบุใน §10.6
- Mascot, sticker, gradient decoration, glassmorphism

---

## 17. Decision Log

| หัวข้อ | การตัดสินใจ |
|---|---|
| ชื่อโปรเจกต์ | Kemtit (เข็มทิศ) |
| Hosting | Netlify |
| Cron/Scheduler | GitHub Actions → Route Handler |
| AI | ตัดจาก scope ปัจจุบัน ออกแบบเป็น pluggable port |
| Custom template | Drag-drop dashboard (ไม่ใช่ full custom schema) |
| Mobile strategy | Web PWA ก่อน ไม่ทำ native ในเฟสแรก |
| Payment | Omise/Opn (เลี่ยง in-app purchase) |
| Beachhead persona | พ่อค้าแม่ค้าออนไลน์ (Seller) |
| UI styling | Tailwind CSS v4 + shadcn/ui (ไม่ใช้ MUI/Ant Design) |
| Design tone | สดใส น่ารัก เก๋ — สีอยู่ที่พื้นผิว ข้อมูลยังคมชัด |
| Brand color | Lavender `#7A5FE0` + accent peach pink `#F5648C` |
| Font | IBM Plex Sans Thai (line-height 1.7 ขั้นต่ำสำหรับวรรณยุกต์ไทย) |
