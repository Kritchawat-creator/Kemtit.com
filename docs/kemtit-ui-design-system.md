# Kemtit — UI Development & Design System Specification

เอกสารนี้ครอบคลุมทุกอย่างที่ต้องตัดสินใจก่อนเขียน UI จริง: technology stack, design tokens, color system, typography, spacing, component library, accessibility, i18n, performance และ testing

---

## 1. UI Technology Stack

| Layer | เลือกใช้ | เหตุผล |
|---|---|---|
| Framework | Next.js App Router + React + TypeScript | ตัดสินใจไว้แล้วใน architecture หลัก |
| Styling | **Tailwind CSS v4** | Utility-first, ไม่ต้องตั้งชื่อ class เอง, tree-shake ดี, มี design token ในตัวผ่าน CSS variables |
| Component primitives | **shadcn/ui** (Radix UI + Tailwind) | ไม่ใช่ dependency แต่ copy code เข้าโปรเจกต์ — แก้ได้อิสระ ไม่ติด vendor, Radix ให้ accessibility (keyboard nav, ARIA, focus trap) ฟรี |
| Icons | **Lucide React** | ชุดเดียวทั่วทั้งแอป น้ำหนักเบา tree-shakeable |
| Dashboard grid | **react-grid-layout** | drag-drop + resize + persist layout (ตัดสินใจไว้แล้ว) |
| Charts | **Recharts** | สำหรับ widget ยอดขาย/progress — API เรียบง่ายกว่า D3 พอสำหรับ use case นี้ |
| Form | **React Hook Form + Zod resolver** | ใช้ Zod schema ตัวเดียวกับฝั่ง server ไม่ต้องเขียน validation ซ้ำ |
| Date | **date-fns** + `date-fns-tz` | เบากว่า moment, tree-shakeable, รองรับ timezone Asia/Bangkok |
| Animation | **Motion (framer-motion)** | ใช้เท่าที่จำเป็น (ดู §11) |
| Toast/Notification | **Sonner** | เบา เข้ากับ shadcn/ui |

### ทำไมไม่เลือกตัวอื่น

- **ไม่ใช้ MUI/Ant Design** — component สำเร็จรูปเยอะเกิน override ยาก และทำให้แอปหน้าตาเหมือนแอปอื่นทั้งโลก ขัดกับ positioning ที่ต้องการเอกลักษณ์
- **ไม่ใช้ CSS-in-JS (styled-components/emotion)** — runtime overhead และเข้ากับ React Server Components ไม่ดี
- **ไม่ใช้ Chart.js** — Recharts เป็น React-native API เข้ากับ component model ดีกว่า

---

## 2. Design Direction

**Subject**: เครื่องมือวางแผนที่คนไทยเปิดใช้ทุกเช้า — แม่ค้าเช็คยอด, นักเรียนดูตารางอ่านหนังสือ
**Audience**: คนไทยทั่วไป เน้นกลุ่มอายุ 18-40 ที่คุ้นกับแอปสวย ๆ แบบ Palu, Lemon8, LINE Sticker
**Primary job**: ทำให้เห็นภายใน 3 วินาทีว่า "วันนี้ต้องทำอะไร และมันพาไปถึงเป้าไหม" — โดยที่เปิดแล้วรู้สึกอยากใช้ ไม่ใช่รู้สึกเหมือนเปิดโปรแกรมทำงาน

### โทนที่เลือก: สดใส น่ารัก แต่ยังดูเก๋ ไม่เด็ก

ความท้าทายคือ "น่ารัก" กับ "ใช้ทำธุรกิจจริงจัง" มักขัดกัน — แม่ค้าที่ดูยอดขายไม่อยากได้แอปที่ดูเหมือนของเล่น วิธีแก้คือ **สีสดใสอยู่ที่พื้นผิวและ accent ส่วนตัวเลข/ข้อมูลยังคงคมชัดจริงจัง**

**หลักการออกแบบ 5 ข้อ**

1. **ความคืบหน้าคือพระเอก** — ตัวเลข % และ progress ต้องเด่นที่สุด ไม่ใช่ปุ่มหรือเมนู
2. **สดใสที่พื้น จริงจังที่ข้อมูล** — พื้นหลัง card ใช้พาสเทลอ่อน แต่ตัวเลขและหัวข้อใช้สีเข้มจากตระกูลเดียวกัน (ไม่ใช่พาสเทลบนพาสเทล ซึ่งอ่านไม่ออก)
3. **มนกว่าปกติ** — radius ใหญ่กว่าแอป productivity ทั่วไปหนึ่งขั้น ทำให้ดูเป็นมิตรทันทีโดยไม่ต้องใส่ภาพประกอบ
4. **แตะง่ายบนมือถือ** — ทุก interactive element ≥44px
5. **ภาษาไทยเป็นพลเมืองชั้นหนึ่ง** — เลือก font/line-height/spacing ที่รองรับวรรณยุกต์ไทยตั้งแต่ต้น

**สิ่งที่ตั้งใจเลี่ยง** (เพราะเป็น default ที่แอปน่ารักทุกตัวใช้จนเกลื่อน): พื้นหลัง cream + accent terracotta, gradient สีรุ้งพาดทั้งหน้า, ตัวการ์ตูน mascot, emoji แทน icon, มุมโค้งเท่ากันหมดทุก element

---

## 3. Color System

### 3.1 Palette หลัก

**Brand — ลาเวนเดอร์ (lavender)** เป็นสีหลัก: สดใส น่ารัก แต่ยังดูมีรสนิยม ไม่หวานเกินแบบชมพูล้วน และแยกตัวจากคู่แข่งที่ใช้น้ำเงิน/เขียวกันหมด (Todoist แดง, TickTick น้ำเงิน, Notion ขาวดำ, Griply น้ำเงิน)

```css
@theme {
  /* Brand — lavender */
  --color-brand-50:  #F3F0FF;
  --color-brand-100: #DDD4FB;
  --color-brand-200: #B9A8F5;
  --color-brand-300: #A08CF0;
  --color-brand-400: #8B72EA;
  --color-brand-500: #7A5FE0;  /* primary */
  --color-brand-600: #6549C9;
  --color-brand-700: #513AA4;
  --color-brand-800: #3E2B84;  /* text on brand-50/100 */
  --color-brand-900: #281A57;

  /* Accent — peach pink (ใช้เน้นจุดเดียวต่อหน้าจอ) */
  --color-accent-50:  #FFF0F3;
  --color-accent-100: #FFD0DC;
  --color-accent-300: #FF9DB5;
  --color-accent-500: #F5648C;
  --color-accent-700: #C33862;
  --color-accent-900: #7D1F3C;

  /* Neutral — cool gray แต้มม่วงจาง (เข้ากับ brand ไม่ตีกัน) */
  --color-neutral-0:   #FFFFFF;
  --color-neutral-50:  #FBFAFF;
  --color-neutral-100: #F5F3FA;
  --color-neutral-200: #E9E6F2;
  --color-neutral-300: #D6D2E3;
  --color-neutral-400: #A8A3BA;
  --color-neutral-500: #7B7590;
  --color-neutral-600: #5B566E;
  --color-neutral-700: #423E52;
  --color-neutral-800: #2B2836;
  --color-neutral-900: #1A1822;

  /* Semantic — สดใสกว่าชุด corporate ทั่วไป */
  --color-success-50:  #E0F7F1;
  --color-success-500: #17A88C;
  --color-success-800: #0A5344;
  --color-warning-50:  #FFF3DA;
  --color-warning-500: #E09112;
  --color-warning-800: #6B4406;
  --color-danger-50:   #FFECEC;
  --color-danger-500:  #E14B52;
  --color-danger-800:  #6E1F23;
}
```

### 3.2 กฎการใช้สีคู่ (สำคัญที่สุดของโทนนี้)

พาสเทลสวยแต่พังเรื่อง contrast ง่ายมาก จึงกำหนดเป็นกฎตายตัว:

| พื้นหลัง | ตัวหนังสือบนพื้นนั้น | ห้ามใช้ |
|---|---|---|
| `brand-50` / `brand-100` | `brand-800` | ขาว, `brand-300`, สีเทา |
| `accent-50` / `accent-100` | `accent-900` | ขาว, `accent-300` |
| `success-50` | `success-800` | `success-500` |
| `brand-500` (ปุ่ม primary) | ขาว | `brand-800` |

**หลักจำง่าย**: พื้น 50-100 → ตัวหนังสือ 800-900 เสมอ · พื้น 500 → ตัวหนังสือขาวเสมอ

### 3.3 Life Domain Colors

6 domain ใช้สีสดใสแยกกันชัด แต่ทุกตัวจับคู่พื้นอ่อน + ตัวหนังสือเข้มตามกฎ §3.2 และแสดงเป็น **pill มน** (radius full) ให้ดูน่ารัก

| Domain | พื้น | จุดสี | ตัวหนังสือ |
|---|---|---|---|
| งาน | `#F3F0FF` | `#8B72EA` | `#3E2B84` |
| สุขภาพ | `#E0F7F1` | `#17A88C` | `#0A5344` |
| ครอบครัว | `#FFF0F3` | `#F5648C` | `#7D1F3C` |
| การเงิน | `#E4F3FF` | `#2E8FD8` | `#0F4670` |
| พัฒนาตัวเอง | `#FFF3DA` | `#E09112` | `#6B4406` |
| ความสัมพันธ์ | `#FDEEFF` | `#B457C9` | `#5C1B69` |

⚠️ ทุก domain ต้องมี **label ข้อความ** กำกับเสมอ ห้ามใช้สีสื่อความหมายเพียงอย่างเดียว (คนตาบอดสี ~8% ของผู้ชาย)

### 3.4 Semantic Token Layer

Component ห้ามเรียกสีดิบ ต้องผ่าน token กลาง เพื่อเปลี่ยน theme/dark mode ได้จุดเดียว:

```css
@theme {
  --color-bg-page:        var(--color-neutral-50);
  --color-bg-surface:     var(--color-neutral-0);
  --color-bg-subtle:      var(--color-neutral-100);
  --color-text-primary:   var(--color-neutral-900);
  --color-text-secondary: var(--color-neutral-600);
  --color-text-muted:     var(--color-neutral-400);
  --color-border:         var(--color-neutral-200);
  --color-border-strong:  var(--color-neutral-300);
}

[data-theme="dark"] {
  --color-bg-page:        var(--color-neutral-900);
  --color-bg-surface:     var(--color-neutral-800);
  --color-bg-subtle:      var(--color-neutral-700);
  --color-text-primary:   var(--color-neutral-50);
  --color-text-secondary: var(--color-neutral-300);
  --color-text-muted:     var(--color-neutral-400);
  --color-border:         var(--color-neutral-700);
  --color-border-strong:  var(--color-neutral-600);
}
```

**Dark mode**: วางโครงไว้ตั้งแต่วันแรก แต่ยังไม่ทำ UI จริงใน POC — โทนพาสเทลต้องปรับสูตรใหม่ในโหมดมืด (พื้นใช้ 800-900 ตัวหนังสือใช้ 100-200) ไม่ใช่แค่กลับสี

### 3.5 Contrast Requirements

WCAG AA: text ปกติ ≥4.5:1, text ใหญ่ (≥18px bold / ≥24px) ≥3:1, UI component/border ≥3:1 — คู่สีในตาราง §3.2/§3.3 ถูกเลือกมาให้ผ่านเกณฑ์แล้ว ถ้าเพิ่มคู่ใหม่ต้องตรวจก่อน merge เสมอ

---

## 4. Typography

### 4.1 Font Selection

**เลือก: IBM Plex Sans Thai** (ผ่าน `next/font/google`)

เหตุผล: ไทยกับละตินอยู่ในระบบเดียวกันจริง (ไม่ใช่เอา font ไทยไปแปะกับ font ฝรั่งคนละบุคลิก) วรรณยุกต์ถูกออกแบบมาไม่ชนบรรทัดบน มีน้ำหนักครบ และ open source ใช้เชิงพาณิชย์ได้

**ความน่ารักมาจาก weight และ radius ไม่ใช่จาก font แปลก ๆ** — ตั้งใจไม่ใช้ font ลายมือหรือ font กลม ๆ เพราะภาษาไทยที่เป็น font ตกแต่งมักอ่านยากในขนาดเล็ก และทำให้ตัวเลขยอดขายดูไม่น่าเชื่อถือ ใช้ weight 600 กับหัวข้อแทนเพื่อให้ดูสดใสมีพลัง

```tsx
// app/layout.tsx
import { IBM_Plex_Sans_Thai } from 'next/font/google'

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-sans',
})
```

**ตัวเลข**: ใช้ `font-variant-numeric: tabular-nums` ทุกที่ที่ค่าเปลี่ยนได้ (ยอดขาย, %, countdown) กันตัวเลขขยับซ้ายขวาเวลาอัปเดต

### 4.2 Type Scale

| Token | Size / Line-height | น้ำหนัก | ใช้ที่ไหน |
|---|---|---|---|
| `display` | 36px / 1.25 | 600 | ตัวเลข % ใหญ่บน dashboard (ใหญ่กว่าเดิมเพื่อให้ดูสดใสมีพลัง) |
| `h1` | 24px / 1.4 | 600 | ชื่อหน้า |
| `h2` | 20px / 1.45 | 600 | หัวข้อ section, ชื่อ widget |
| `h3` | 17px / 1.5 | 500 | ชื่อ goal |
| `body` | 15px / 1.7 | 400 | เนื้อหาทั่วไป |
| `small` | 13px / 1.6 | 400 | metadata, วันที่ |
| `caption` | 12px / 1.5 | 500 | label ใน pill (weight สูงขึ้นเพราะตัวเล็กบนพื้นสี) |

⚠️ **line-height ภาษาไทยต้องสูงกว่าอังกฤษ** — สระบน (ิ ี ื ํ) และวรรณยุกต์ซ้อน 2 ชั้น (เช่น "ที่") ทำให้ต้องใช้ body ที่ **1.7** ขั้นต่ำ และห้ามใช้ font-weight ต่ำกว่า 400

### 4.3 กฎการเขียน (Content Style)

โทนน่ารักต้องมาจาก **คำพูด** ด้วย ไม่ใช่แค่สี — แต่ยังต้องชัดเจน ไม่กวนหรือเยิ่นเย้อ

- ใช้ประโยคปกติ ไม่ใช่ ALL CAPS
- ปุ่มบอกสิ่งที่จะเกิดขึ้น: "บันทึกเป้าหมาย" ไม่ใช่ "ตกลง"
- Error บอกว่าเกิดอะไรและต้องทำอะไรต่อ: "ชื่อเป้าหมายซ้ำกับที่มีอยู่ ลองตั้งชื่ออื่น" ไม่ใช่ "เกิดข้อผิดพลาด"
- Empty state เป็นคำเชิญชวน: "ตั้งเป้าหมายแรกของเดือนนี้" ไม่ใช่ "ยังไม่มีข้อมูล"
- ตอนทำเป้าสำเร็จใช้คำชมสั้น ๆ ตรงไปตรงมา: "ทำได้แล้ว" ไม่ใช่ "ยินดีด้วยนะคะ คุณเก่งมากเลย!!!"
- **ไม่ใช้ emoji ในระบบ** — ใช้ icon จาก Lucide แทน เพราะ emoji render ต่างกันในแต่ละเครื่องและทำให้ดูไม่เป็นมืออาชีพ

---

## 5. Spacing, Radius, Elevation

### 5.1 Spacing Scale (4px base)

```
2xs: 4px   xs: 8px   sm: 12px   md: 16px   lg: 24px   xl: 32px   2xl: 48px   3xl: 64px
```
กฎ: ระยะภายใน component ใช้ xs-md, ระยะระหว่าง section ใช้ lg-2xl

### 5.2 Border Radius — ขั้นสำคัญของโทนน่ารัก

ปรับใหญ่ขึ้นหนึ่งขั้นจาก productivity app ทั่วไป ทำให้ดูเป็นมิตรทันทีโดยไม่ต้องพึ่งภาพประกอบ

| Token | ค่า | ใช้กับ |
|---|---|---|
| `sm` | 10px | input, small badge |
| `md` | 14px | button, small card |
| `lg` | 20px | widget card, modal |
| `xl` | 28px | hero card, onboarding panel |
| `full` | 9999px | avatar, domain pill, progress bar, FAB |

**ห้ามใช้ radius เดียวกับทุกอย่าง** — ขนาด radius ต้องสัมพันธ์กับขนาด element (card ใหญ่ radius ใหญ่กว่า badge) ถ้าทุกอย่าง radius เท่ากันหมดจะกลายเป็น "SaaS card kit" ที่ดูเหมือน template

### 5.3 Elevation

โทนสดใสใช้ **เงาสีอ่อนจากตระกูล brand แทนเงาเทา** — เงาเทาทำให้สีพาสเทลดูหม่น

```css
--shadow-sm: 0 1px 3px rgba(122, 95, 224, 0.08);
--shadow-md: 0 4px 12px rgba(122, 95, 224, 0.10);
--shadow-lg: 0 12px 32px rgba(122, 95, 224, 0.14);
```

| ระดับ | ใช้กับ |
|---|---|
| flat | `border: 1px solid var(--color-border)` — widget card ปกติ |
| raised | border + `shadow-md` — card ที่กำลัง drag |
| overlay | `shadow-lg` ไม่มี border — modal, dropdown, popover |

จำกัด floating layer ไม่เกิน 2 ชั้นพร้อมกัน

### 5.4 Decorative Elements (เฉพาะโทนนี้)

องค์ประกอบตกแต่งที่อนุญาต ใช้อย่างจำกัด:

- **Progress ring แบบมนหัวท้าย** (`stroke-linecap: round`) — ให้ความรู้สึกนุ่มนวลกว่าปลายตัด
- **พื้นหลัง card แบบ tint อ่อน** ตาม domain ของ goal (เช่น goal สุขภาพ พื้น `success-50`) แทนที่จะขาวทั้งหมด
- **Celebration confetti ตอนทำเป้าสำเร็จ 100%** — ครั้งเดียว 800ms ไม่วนซ้ำ และปิดเมื่อ `prefers-reduced-motion`

**ห้ามใช้**: gradient พาดพื้นหลังทั้งหน้า, mascot/ตัวการ์ตูน, glassmorphism/blur, เงาสีนีออน, sticker ประดับมุมจอ — ทั้งหมดนี้ทำให้ดูเหมือนแอปเด็กและกินพื้นที่ที่ควรเป็นของข้อมูล

---

## 6. Component Inventory

### 6.1 Primitives (จาก shadcn/ui)
Button, Input, Textarea, Select, Checkbox, Radio, Switch, Dialog, Sheet (mobile drawer), Dropdown Menu, Popover, Tabs, Tooltip, Badge, Avatar, Skeleton, Toast

### 6.2 Domain Components (เขียนเอง)

| Component | หน้าที่ | Props สำคัญ |
|---|---|---|
| `GoalCard` | แสดง goal + progress + domain tag | goal, showChildren |
| `GoalCascadeTree` | tree view ปี→เดือน→วัน แบบพับได้ | rootGoalId, depth |
| `ProgressRing` | วงกลม % สำหรับ dashboard | value, size, domain |
| `ProgressBar` | แถบ % แนวนอน | value, target, showLabel |
| `TaskRow` | 1 บรรทัด task + checkbox + due date | task, onToggle |
| `TaskList` | รวม TaskRow + filter work/personal | tasks, groupBy |
| `DomainTag` | สี + ชื่อ domain | domain |
| `PeriodSwitcher` | สลับ วัน/สัปดาห์/เดือน/ปี | value, onChange |
| `DatePicker` | เลือกวันที่ (ปฏิทินไทย พ.ศ. ได้) | value, onChange |
| `WidgetShell` | กรอบ widget + drag handle + menu | title, onRemove |
| `WidgetPicker` | modal เลือก widget เพิ่ม | availableWidgets |
| `EmptyState` | หน้าจอว่าง + CTA | title, description, action |
| `StatTile` | ตัวเลขเด่น + label + delta | value, label, trend |

### 6.3 Widget Components (ต่อ persona)

| Widget | Persona | แสดงอะไร |
|---|---|---|
| `SalesVsGoalWidget` | seller | กราฟแท่งยอดขายเทียบเป้าเดือนนี้ |
| `ShopChecklistWidget` | seller | checklist ประจำร้านรายวัน |
| `ContentPipelineWidget` | creator | บอร์ด ไอเดีย→ร่าง→โพสต์ |
| `ExamCountdownWidget` | student | นับถอยหลังสอบ |
| `OKRWidget` | office | OKR ไตรมาสปัจจุบัน |
| `TodayTasksWidget` | ทุก persona | งานวันนี้ |
| `GoalProgressWidget` | ทุก persona | progress ของ goal หลัก |
| `DailyLifeWidget` | ทุก persona | สรุป domain ชีวิตส่วนตัว |

---

## 7. Layout & Responsive

### 7.1 Breakpoints

```
mobile:  < 640px    → single column, bottom nav, ไม่มี drag-drop
tablet:  640-1024px → 2 column grid
desktop: > 1024px   → 12-column react-grid-layout เต็มรูปแบบ + sidebar nav
```

### 7.2 Navigation

- **Mobile**: bottom nav 4 แท็บ (แดชบอร์ด / เป้าหมาย / ปฏิทิน / ตั้งค่า) + FAB สำหรับเพิ่ม task เร็ว
- **Desktop**: sidebar ซ้ายพับได้ + top bar (persona badge, avatar, subscription status)

### 7.3 Mobile-first คือข้อบังคับ ไม่ใช่ทางเลือก

คนไทยส่วนใหญ่เข้าเว็บผ่านมือถือ — เขียน CSS แบบ mobile-first เสมอ (base = mobile, `md:` `lg:` คือส่วนเพิ่ม) และทดสอบบนมือถือจริงก่อน desktop ทุกฟีเจอร์

---

## 8. UX/UI ฝั่ง Client (End-user App)

ใช้ design system เดียวกันทุกหน้าจอ ส่วนนี้กำหนด **โครงหน้าจอ (screen inventory), flow และกฎ UX** ที่เป็นของฝั่ง user โดยเฉพาะ

### 8.1 Information Architecture

```
Bottom nav (mobile) / Sidebar (desktop)
├── แดชบอร์ด        ← หน้าแรกหลัง login (default)
├── เป้าหมาย        ← goal cascade tree
├── ปฏิทิน          ← วัน/สัปดาห์/เดือน/ปี
└── ตั้งค่า          ← โปรไฟล์, persona, แจ้งเตือน, subscription

FAB (มือถือ) / ปุ่มมุมบนขวา (desktop): "+ เพิ่ม" → เมนู 2 ตัวเลือก: task / goal
```

**กฎ**: ทุกหน้าเข้าถึงได้ภายใน 2 แตะจากแดชบอร์ด ไม่มีเมนูซ้อนชั้นที่ 3

### 8.2 Screen Inventory

| หน้าจอ | องค์ประกอบหลัก | สิ่งที่ต้องเห็นใน 3 วินาที |
|---|---|---|
| **Onboarding (3 ขั้น)** | 1) email+OTP 2) เลือก persona 3) ตั้ง goal แรกจาก template | ขั้นที่กำลังอยู่ + ขั้นที่เหลือ |
| **แดชบอร์ด** | top bar (persona pill + avatar) → widget grid → bottom nav | ตัวเลข % ของ goal หลักเดือนนี้ |
| **เป้าหมาย (list)** | filter งาน/ชีวิตส่วนตัว → GoalCard เรียงตาม period | goal ไหนตกเป้า (แสดงสี warning) |
| **เป้าหมาย (detail)** | hero card (ชื่อ, %, target/current) → GoalCascadeTree → task ที่ผูก | ต้องทำอะไรต่อ (task ถัดไป) |
| **ปฏิทิน** | PeriodSwitcher → grid ตาม period → task/goal เป็นจุดสี domain | วันไหนแน่น วันไหนว่าง |
| **สร้าง/แก้ goal** | Sheet (มือถือ) / Dialog (desktop): ชื่อ, period, domain, target, parent | ช่องที่บังคับกรอก |
| **สร้าง/แก้ task** | Sheet/Dialog: ชื่อ, due date, domain, recurring, ผูก goal | ช่องเดียวก็ save ได้ (ชื่อ) |
| **ตั้งค่า** | โปรไฟล์ → persona → แจ้งเตือน LINE → subscription → ธีม | สถานะ LINE เชื่อมแล้วหรือยัง |
| **Subscription** | เทียบ Free vs Pro 2 คอลัมน์ → ปุ่มอัปเกรด → Omise checkout | ราคาต่อปีชัดเจน ไม่ซ่อน |

### 8.3 Onboarding Flow — จุดที่ user หลุดมากที่สุด

**เป้าหมาย**: ได้ goal แรก + เห็น dashboard ภายใน 90 วินาที

```
ขั้น 1  กรอก email → รับ OTP 6 หลัก → auto-submit เมื่อครบ (ไม่ต้องกดปุ่ม)
ขั้น 2  เลือก persona — 4 card ใหญ่ มี icon + ชื่อ + 1 บรรทัดอธิบาย
        (ไม่มีปุ่ม "ข้าม" — persona กำหนด default layout จำเป็นต้องเลือก)
ขั้น 3  ตั้ง goal แรก — ระบบ pre-fill template ตาม persona:
        seller  → "ยอดขายเดือนนี้ [____] บาท"
        creator → "โพสต์คอนเทนต์ [____] ชิ้นเดือนนี้"
        user แก้แค่ตัวเลข → กด "เริ่มเลย"
→ ไปแดชบอร์ดที่มี widget + goal นั้นแสดงอยู่แล้ว
```

**กฎ UX**: ห้ามขอข้อมูลที่ยังไม่จำเป็น (ชื่อเล่น, รูปโปรไฟล์, เชื่อม LINE) ในตอน onboarding — ย้ายไปหน้าตั้งค่าและ nudge ทีหลังตอน user ได้เห็นคุณค่าแล้ว

### 8.4 Dashboard — กฎการจัดวาง

**POC (ตาม POC Decisions 2026-09-05)**: layout **คงที่** 2 widget — `GoalProgressWidget` (goal หลักเดือนนี้) บนสุด แล้ว `TodayTasksWidget` — ไม่มีการย้าย/เพิ่ม/ลบ widget, ไม่มี `WidgetPicker`, ไม่มีตาราง `dashboard_layouts`; กฎที่ติดป้าย **(MVP)** ด้านล่างเริ่มใช้เมื่อมี drag-drop ใน MVP

- Widget แรกบนสุดเสมอคือ **goal หลักเดือนนี้** (ตาม persona) — (MVP) user เปลี่ยนตำแหน่งได้ แต่ default ต้องเป็นแบบนี้
- (MVP) Empty dashboard (user ลบ widget หมด) แสดง EmptyState "เพิ่ม widget แรก" ไม่ใช่หน้าขาวเปล่า
- Widget ที่ยังไม่มีข้อมูล (เช่น ยังไม่กรอกยอดขาย) แสดง **empty state ภายใน widget** พร้อม CTA ไม่ใช่กราฟเปล่า — ใช้ตั้งแต่ POC
- (MVP) ปุ่ม "เพิ่ม widget" เปิด WidgetPicker แสดงเฉพาะ widget ของ persona ปัจจุบัน + widget กลาง (ไม่โชว์ของ persona อื่น กันสับสน)

### 8.5 Task Interaction

| การกระทำ | Mobile | Desktop |
|---|---|---|
| ติ๊กเสร็จ | แตะ checkbox | คลิก checkbox หรือกด Space เมื่อ focus |
| แก้ไข | แตะที่แถว → เปิด Sheet | คลิกที่แถว → เปิด Dialog |
| ลบ | swipe ซ้าย → ปุ่มลบ + undo toast 5 วินาที | hover → icon ลบ + undo toast |
| เลื่อนวัน | long-press → เมนู "พรุ่งนี้ / สัปดาห์หน้า / เลือกวัน" | right-click หรือ icon ปฏิทิน |

**ทุกการลบต้องมี undo** — ห้ามใช้ confirm dialog "แน่ใจหรือไม่?" เพราะ user จะกดผ่านโดยไม่อ่านอยู่ดี undo toast ปลอดภัยกว่าและเร็วกว่า

### 8.6 Empty / Loading / Error States (บังคับทุกหน้า)

| State | รูปแบบ |
|---|---|
| Loading | Skeleton รูปทรงเดียวกับ content จริง (ไม่ใช่ spinner กลางจอ) |
| Empty | icon + หัวข้อเชิญชวน + 1 บรรทัดอธิบาย + ปุ่ม CTA |
| Error (กู้ได้) | inline ใต้ช่องที่ผิด สีแดง + บอกวิธีแก้ |
| Error (กู้ไม่ได้) | full-width card: เกิดอะไร + ปุ่ม "ลองอีกครั้ง" |
| Offline (PWA) | banner บนสุด "ไม่มีอินเทอร์เน็ต — จะบันทึกเมื่อกลับมาออนไลน์" |

### 8.7 Subscription Touchpoints — ที่ที่ Free user จะเจอกำแพง

Feature gating ต้อง **บอกก่อนชน** ไม่ใช่ error หลังกด:

- Widget ที่เป็น Pro-only ยังแสดงใน WidgetPicker แต่มี badge "Pro" และ preview จาง — แตะแล้วเปิดหน้า upgrade
- เมื่อ Free user พยายามเปิด persona ที่ 2 → Sheet อธิบายว่า Pro ปลดล็อกทุก persona พร้อมราคา
- ไม่มี popup ขาย Pro แบบสุ่ม — nudge เฉพาะตอน user ชนขีดจำกัดจริงเท่านั้น

---

## 9. UX/UI ฝั่ง Admin Console

Admin ใช้ **token, font, spacing ชุดเดียวกับ client** แต่ปรับ 3 อย่างให้เหมาะกับงาน operations ที่ต้องดูข้อมูลเยอะและทำงานเร็ว

### 9.1 หลักการที่ต่างจาก Client

| ด้าน | Client | Admin |
|---|---|---|
| ความหนาแน่น | โปร่ง สบายตา | **แน่นกว่า** — spacing ลดหนึ่งขั้น, font body 14px |
| สีสัน | พาสเทลอบอุ่นบนพื้น card | **พื้นขาว/เทากลางเป็นหลัก** สีสงวนไว้สำหรับ status เท่านั้น |
| Radius | lg 20px | **md 14px** — ดูเป็นเครื่องมือมากขึ้น |
| Layout | widget อิสระ | **ตาราง + ฟอร์ม** เป็นหลัก |
| Motion | มี celebration | **ไม่มีเลย** ยกเว้น feedback การกระทำ |
| Navigation | bottom nav 4 แท็บ | **sidebar ถาวร** (desktop only — admin ไม่ทำ mobile) |

**เหตุผลที่ยังใช้ design system เดียวกัน**: solo dev ไม่ควรดูแล 2 ชุด component และ admin ที่ดูเป็นญาติกับ client ช่วยให้ตอน support เห็นสิ่งเดียวกับที่ user เห็น

### 9.2 Information Architecture

```
Sidebar (ซ้าย ถาวร)
├── ภาพรวม          ← metrics dashboard
├── ผู้ใช้           ← ค้นหา, รายละเอียด, override
├── Subscription    ← รายการชำระเงิน, refund
├── Events          ← domain_events ค้าง/ล้มเหลว
└── ระบบ            ← feature flag, ประกาศ

Top bar: ค้นหา user ทั่วระบบ (Cmd+K) + ชื่อ admin ที่ login
```

### 9.3 Screen Inventory

| หน้าจอ | องค์ประกอบ | จุดประสงค์ |
|---|---|---|
| **ภาพรวม** | StatTile 4 ตัว (DAU, ผู้ใช้ใหม่วันนี้, Pro ทั้งหมด, churn 30 วัน) → กราฟ signup 30 วัน → ตาราง conversion ต่อ persona | เห็นสุขภาพธุรกิจใน 5 วินาที |
| **ผู้ใช้ (list)** | ตาราง: email, persona, tier, สมัครเมื่อ, active ล่าสุด · filter tier/persona · ค้นหา | หา user ที่ต้อง support ให้เจอเร็ว |
| **ผู้ใช้ (detail)** | header (email, tier, persona) → tab: goal/task ของเขา (read-only) · ประวัติชำระเงิน · event log | เห็นสิ่งที่ user เห็นตอน support |
| **Override tier** | Dialog: เลือก tier ใหม่ + เหตุผล (บังคับกรอก) + วันหมดอายุ | comp บัญชี/แก้ payment พลาด |
| **Subscription** | ตารางชำระเงินจาก Omise: วันที่, user, จำนวน, สถานะ · ปุ่ม refund | ตรวจสอบรายได้ + คืนเงิน |
| **Events** | ตาราง `domain_events`: type, user, สถานะ, เวลา · filter "ยังไม่ประมวลผล" · ปุ่ม retry | debug cron/LINE ที่ค้าง |
| **Feature flag** | toggle list: ชื่อ flag, เปิด/ปิด, % rollout | เปิด feature ทีละกลุ่มโดยไม่ต้อง deploy |

### 9.4 Data Table — component หลักของ Admin

| กฎ | รายละเอียด |
|---|---|
| แถว | bordered row (ไม่ใช่ card) สูง 44px, hover เปลี่ยนพื้นเป็น `neutral-100` |
| ตัวเลข | `tabular-nums` ชิดขวาเสมอ |
| วันที่ | relative ("3 ชม. ที่แล้ว") + tooltip เวลาเต็ม |
| สถานะ | Badge สี semantic + ข้อความ (ไม่ใช่สีอย่างเดียว) |
| Pagination | 50 แถว/หน้า, server-side |
| Empty | "ไม่พบผลลัพธ์" + ปุ่มล้าง filter |
| Bulk action | checkbox หน้าแถว → action bar ลอยด้านล่างเมื่อเลือก ≥1 |

### 9.5 Destructive Actions — ตรงข้ามกับ Client

ฝั่ง user ใช้ undo แทน confirm แต่ฝั่ง admin **การกระทำที่กระทบเงินหรือบัญชีคนอื่นต้อง confirm** เพราะ undo ทำไม่ได้กับ refund ที่ส่งไป Omise แล้ว

| การกระทำ | รูปแบบ confirm |
|---|---|
| Override tier | Dialog + เหตุผลบังคับกรอก |
| Refund | Dialog + พิมพ์จำนวนเงินยืนยัน + เหตุผล |
| ลบ user | Dialog + พิมพ์ email ของ user นั้นยืนยัน |
| Retry event ทั้ง batch | Dialog แสดงจำนวน event ที่จะ retry |

ทุก destructive action บันทึกลง audit log: ใคร ทำอะไร กับใคร เมื่อไหร่ เหตุผล

### 9.6 Access & Security UX

- หน้า admin ทั้งหมดอยู่ใต้ `/admin` route group แยก layout ห้าม share component ที่มี business logic กับ client
- ไม่มี admin บน mobile — ถ้าเปิดจากมือถือแสดง "กรุณาใช้ desktop" (ลด surface ที่ต้องทดสอบ)
- Session admin หมดอายุใน 8 ชม. (สั้นกว่า user ปกติ)
- ทุกหน้ามี badge "ADMIN" มุมบนซ้ายสีแดงจาง — กันสับสนตอนเปิด client กับ admin สองแท็บพร้อมกัน

### 9.7 Phase

| Phase | สิ่งที่มี |
|---|---|
| POC/MVP | ใช้ Supabase Studio ตรง ๆ ไม่มี admin UI |
| Phase 2 | ภาพรวม + ผู้ใช้ (list/detail) + Override tier + Events |
| Phase 3 | Subscription/refund UI + Feature flag + audit log viewer |

---

## 10. Accessibility (บังคับทุก component)

- ทุก interactive element มี focus ring มองเห็นชัด (`focus-visible:ring-2 ring-brand-500 ring-offset-2`)
- Touch target ≥44×44px ทุกจุดบนมือถือ
- ทุก icon-only button มี `aria-label`
- ทุกรูปมี `alt` (decorative ใช้ `alt=""`)
- Form ทุกช่องมี `<label>` ผูกจริง ไม่ใช่ placeholder แทน label
- Error ประกาศผ่าน `aria-live="polite"` ให้ screen reader อ่าน
- ทดสอบ keyboard-only navigate ได้ครบทุก flow ก่อน ship
- `prefers-reduced-motion` ต้องปิด animation ทั้งหมด

---

## 11. Motion Guidelines

**หลัก: motion ตอบสนองการกระทำของ user เท่านั้น ห้าม animate เองตอนโหลดหน้า**

| การกระทำ | Motion | ระยะเวลา |
|---|---|---|
| กดติ๊ก task เสร็จ | checkbox fill + strikethrough | 150ms |
| Progress เปลี่ยนค่า | เลขนับขึ้น + bar ขยาย | 400ms ease-out |
| เปิด modal/sheet | fade + scale เล็กน้อย | 200ms |
| Drag widget | ตาม cursor ทันที + shadow ขึ้น | ไม่มี delay |
| ทำเป้าสำเร็จ 100% | one-time celebration (ครั้งเดียว ไม่วนซ้ำ) | 800ms |

**ห้ามทำ**: fade-in-up ทุก section ตอนโหลดหน้า, hover animation ทุก card, skeleton ที่ pulse ตลอดเวลา — สามอย่างนี้คือสัญญาณของ UI ที่ generate มาโดยไม่คิด

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. Internationalization & Localization

แม้ทำภาษาไทยอย่างเดียวในเฟสแรก แต่ต้องเตรียมโครงไว้:

- ห้าม hardcode ข้อความไทยใน component — ใช้ `next-intl` หรือไฟล์ `messages/th.json` ตั้งแต่วันแรก
- **Timezone**: fix เป็น `Asia/Bangkok` ทุกการคำนวณวันที่ — เก็บ UTC ใน DB แสดงผลเป็น local เสมอ
- **ปฏิทินไทย**: รองรับแสดง พ.ศ. (`buddhist` calendar) เป็น option ในหน้าตั้งค่า
- **สกุลเงิน**: `Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })` ไม่ format เอง
- **วันแรกของสัปดาห์**: ไทยเริ่มวันอาทิตย์ ไม่ใช่จันทร์ — ตั้งค่าให้ถูกใน DatePicker/Calendar

---

## 13. Performance Budget

| ตัวชี้วัด | เป้าหมาย |
|---|---|
| LCP | < 2.5s บน 4G |
| CLS | < 0.1 |
| INP | < 200ms |
| JS bundle (initial) | < 200KB gzipped |

**วิธีทำให้ถึงเป้า**
- Widget ทุกตัว `lazy()` แยก chunk — user สาย seller ไม่โหลด JS ของ creator (ตามที่ระบุไว้ใน architecture)
- ใช้ Server Component เป็นค่าเริ่มต้น เติม `'use client'` เฉพาะที่ต้อง interactive จริง
- รูปทุกใบผ่าน `next/image`
- Font ใช้ `display: swap` + preload subset ไทย
- ใส่ `<Skeleton>` ระหว่างโหลด widget กัน layout shift

---

## 14. Frontend Folder Structure

```
src/
  components/
    ui/              # shadcn primitives (button.tsx, dialog.tsx, ...)
    domain/          # GoalCard, TaskRow, ProgressRing, ...
    widgets/         # WidgetShell, WidgetPicker
    layout/          # AppShell, BottomNav, Sidebar
    admin/           # DataTable, AuditLogRow, ConfirmDialog (admin เท่านั้น)
  modules/
    seller/components/    # SalesVsGoalWidget, ShopChecklistWidget
    creator/components/
    student/components/
    office/components/
  styles/
    globals.css      # @theme tokens ทั้งหมดอยู่ที่นี่จุดเดียว
  lib/
    utils.ts         # cn() helper
    format.ts        # formatCurrency, formatThaiDate
  messages/
    th.json
```

---

## 15. Development Workflow & Tooling

| เครื่องมือ | ใช้ทำอะไร |
|---|---|
| **Storybook** | พัฒนา component แยกจากแอป ดูทุก state (loading/empty/error) ได้โดยไม่ต้องปั้นข้อมูลจริง |
| **ESLint + `eslint-plugin-jsx-a11y`** | จับปัญหา accessibility ตั้งแต่ตอนเขียน |
| **Prettier + `prettier-plugin-tailwindcss`** | เรียง class Tailwind อัตโนมัติ ลด diff noise |
| **Vitest + React Testing Library** | unit test component logic |
| **Playwright** | E2E test flow สำคัญ (onboarding, สร้าง goal, ติ๊ก task) |
| **Lighthouse CI** | เช็ค performance budget ทุก PR |

---

## 16. Definition of Done สำหรับทุก UI Component

ก่อน merge component ใด ๆ ต้องผ่านครบทุกข้อ:

- [ ] ใช้ semantic token เท่านั้น ไม่มี hex ดิบใน component
- [ ] รองรับ mobile (< 640px) และ desktop
- [ ] Keyboard navigate ได้ครบ + focus ring มองเห็น
- [ ] มี loading state, empty state, error state ครบ
- [ ] Contrast ผ่าน WCAG AA
- [ ] ข้อความทั้งหมดมาจากไฟล์ i18n ไม่ hardcode
- [ ] ตัวเลขทุกตัวผ่าน formatter (ไม่มี float artifact)
- [ ] `prefers-reduced-motion` ทำงานถูกต้อง
- [ ] มี Storybook story อย่างน้อย 3 state

---

## 17. สิ่งที่ตั้งใจไม่ทำ (UI Out of Scope)

- Dark mode UI จริง (วาง token ไว้แล้ว แต่ยังไม่ทำใน POC)
- Drag-drop บนมือถือ (mobile stack แนวตั้งอย่างเดียว)
- Custom theme ให้ user เลือกสีเอง
- Animation ซับซ้อน / micro-interaction เกินที่ระบุใน §11
- ภาษาอื่นนอกจากไทย (แต่โครง i18n พร้อมรองรับ)
