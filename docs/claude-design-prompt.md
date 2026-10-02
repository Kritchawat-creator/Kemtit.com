# Prompt สำหรับ Claude Design — ออกแบบ UI/UX Template ของ Kemtit

**วิธีใช้**: แนบไฟล์ `kemtit-ui-design-system.md` เข้าไปด้วย (ถ้าแนบได้) แล้ว copy prompt ด้านล่างทั้งก้อน — ถ้าแนบไม่ได้ prompt นี้มี token สำคัญครบพอให้ออกแบบได้โดยไม่ต้องเปิดไฟล์

---

## Prompt หลัก — Client App (มือถือก่อน)

```
คุณคือ product designer ที่ออกแบบแอป planner สำหรับตลาดไทย ชื่อ "Kemtit" (เข็มทิศ)
ออกแบบ UI template ชุดแรกให้ผมตาม design system ด้านล่างอย่างเคร่งครัด — อย่าคิดสีหรือ font ใหม่เอง

## สินค้าคืออะไร
เว็บแอป (PWA) ที่รวม "เป้าหมายธุรกิจ" กับ "ชีวิตส่วนตัว" ไว้ในที่เดียว
แกนกลางคือ Goal Cascade: เป้ารายเดือน → แตกเป็นเป้ารายสัปดาห์ → งานรายวัน
ผู้ใช้กลุ่มแรก: พ่อค้าแม่ค้าออนไลน์ อายุ 20-40 ใช้มือถือเป็นหลัก คุ้นกับ LINE, Shopee, Lemon8

## Design Direction
สดใส น่ารัก แต่ยังดูเก๋ ไม่เด็ก — "สีสดใสอยู่ที่พื้นผิวและ accent ส่วนตัวเลข/ข้อมูลยังคมชัดจริงจัง"
เหตุผล: แม่ค้าที่ดูยอดขายต้องไม่รู้สึกว่ากำลังใช้ของเล่น แต่ต้องรู้สึกอยากเปิดทุกเช้า
Primary job ของทุกหน้าจอ: เห็นภายใน 3 วินาทีว่า "วันนี้ต้องทำอะไร และมันพาไปถึงเป้าไหม"

## Design Tokens (ใช้ค่านี้เท่านั้น)

สี Brand — lavender
- brand-50 #F3F0FF · brand-100 #DDD4FB · brand-200 #B9A8F5
- brand-500 #7A5FE0 (primary, ปุ่มหลัก) · brand-600 #6549C9 · brand-800 #3E2B84 (text บนพื้น brand-50/100)

สี Accent — peach pink (ใช้เน้นได้จุดเดียวต่อหน้าจอ)
- accent-50 #FFF0F3 · accent-100 #FFD0DC · accent-500 #F5648C · accent-900 #7D1F3C

สี Neutral — cool gray แต้มม่วงจาง
- พื้นหน้า #FBFAFF · พื้น card #FFFFFF · พื้นรอง #F5F3FA
- เส้นขอบ #E9E6F2 · text หลัก #1A1822 · text รอง #5B566E · text จาง #7B7590

สี Semantic
- success #17A88C (พื้น #E0F7F1, text #0A5344)
- warning #E09112 (พื้น #FFF3DA, text #6B4406)
- danger #E14B52 (พื้น #FFECEC, text #6E1F23)

สี Life Domain (6 ตัว แสดงเป็น pill มน พื้นอ่อน + จุดสี + text เข้ม)
- งาน: พื้น #F3F0FF จุด #8B72EA text #3E2B84
- สุขภาพ: พื้น #E0F7F1 จุด #17A88C text #0A5344
- ครอบครัว: พื้น #FFF0F3 จุด #F5648C text #7D1F3C
- การเงิน: พื้น #E4F3FF จุด #2E8FD8 text #0F4670
- พัฒนาตัวเอง: พื้น #FFF3DA จุด #E09112 text #6B4406
- ความสัมพันธ์: พื้น #FDEEFF จุด #B457C9 text #5C1B69

กฎสีคู่ (ห้ามละเมิด): พื้น 50-100 → text 800-900 เสมอ · พื้น 500 → text ขาวเสมอ · ห้ามพาสเทลบนพาสเทล

Typography
- Font: IBM Plex Sans Thai ทุกที่ (ห้ามใช้ font ลายมือหรือ font กลม)
- display 36px/1.25 weight 600 — ตัวเลข % ใหญ่บน dashboard
- h1 24px/1.4 weight 600 · h2 20px/1.45 weight 600 · h3 17px/1.5 weight 500
- body 15px/1.7 weight 400 (line-height 1.7 บังคับ เพราะวรรณยุกต์ไทย) · small 13px/1.6 · caption 12px/1.5 weight 500
- ตัวเลขทุกตัวใช้ tabular figures

Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48
Radius: input/badge 10px · button 14px · card/modal 20px · hero card 28px · avatar/pill/progress bar/FAB มนเต็ม
Shadow: ใช้เงาสีม่วงอ่อน rgba(122,95,224,0.10) ไม่ใช่เงาเทา
Icon: Lucide style, stroke 1.5px, ห้ามใช้ emoji
Touch target ทุกจุด ≥ 44px

## Signature System — สิ่งที่ทำให้ไม่เหมือน template (สำคัญที่สุดของ brief นี้)
หลัก: "โครงคุ้น ผิวมีลายเซ็น" — nav/form/card ใช้ pattern ที่คนคุ้น แต่ทุกอย่างที่แสดง "ความคืบหน้า" ต้องเป็นภาษาภาพของ Kemtit เท่านั้น

1. **Compass Dial แทน progress ring** — เป้าหมาย = ทิศเหนือ (N) บนสุด, เข็มหมุนจากทิศใต้ (0%) ตามเข็มนาฬิกาไปทิศเหนือ (100%), ตัวเลข % display 36px กลางหน้าปัด, ปลายเข็มด้านเหนือเป็นสี accent #F5648C และเป็น "ที่เดียว" ที่ accent ปรากฏบน dashboard, ขีดบอกทิศ 8 ขีดเส้นบาง #D6D2E3 ให้ดูเป็น "เครื่องมือ" ไม่ใช่ของเล่น
2. **Goal cascade เป็น "เส้นทาง" ไม่ใช่ tree** — goal แม่บนสุดเป็นจุดหมาย (ธง), goal ลูกเป็น waypoint เรียงลง เชื่อมเส้นประ, ผ่านแล้ว = จุดเต็มสี success / กำลังทำ = วงแหวน brand-500 / ยังไม่ถึง = จุดกลวง, สัปดาห์ปัจจุบันมี marker เข็มเล็ก "คุณอยู่ตรงนี้"
3. **Illustration monoline วาดเอง** สำหรับ 4 persona + 6 domain + empty state — เส้นเดียว 1.5px มุมมน ไม่มี fill ยกเว้นจุดเน้นสี domain; empty state ทุกหน้าใช้ "เข็มทิศเส้นเดียวที่เข็มยังไม่ชี้" ตัวเดียวกันทั้งแอป; ห้ามผสม 3D/flat สีตัน/isometric
4. **ตัวเลขคือตัวเอก** — % และยอดเงิน display 36px weight 600 ใหญ่กว่าหัวข้อทุกตัวในหน้า, ยอดเงินเป็น "50,000" + "บาท" ตัวเล็กห้อยท้าย ไม่ใช้ ฿
5. **ปุ่ม primary เป็น pill มนเต็ม** สูง 48px, **checkbox เป็นวงกลม** (checkpoint บนเส้นทาง) ติ๊กแล้วเป็นจุดเต็มสี success
6. **น้ำเสียง** ใช้อุปมาเดินทางแค่ 4 จุด: หัวข้อ dashboard "ทิศทางวันนี้" · pace badge "ตามเส้นทาง"/"ออกนอกเส้นทาง" · สำเร็จ "ถึงจุดหมายแล้ว" · empty "ยังไม่ได้ตั้งทิศ" — ที่เหลือใช้ภาษาตรง ๆ

กฎ: ใช้ compass dial กับความคืบหน้าเท่านั้น ห้ามเอาไปใส่โลโก้/loading/ปุ่ม · ถ้าต้องเลือกระหว่าง unique กับใช้ง่าย ใช้ง่ายชนะเสมอ

## หน้าจอที่ต้องออกแบบ (mobile 390×844 ทุกหน้า)

1. Login — ช่อง email + ปุ่ม "ส่งรหัส" · แล้วหน้ากรอก OTP 6 หลัก (แยก 6 ช่อง)
2. Onboarding ขั้น 2: เลือก persona — 4 card ใหญ่ (แม่ค้าออนไลน์ / Creator / นักเรียน / ออฟฟิศ) มี icon + ชื่อ + 1 บรรทัด, แสดง step indicator "2/3", ไม่มีปุ่มข้าม
3. Onboarding ขั้น 3: ตั้งเป้าแรก — card ที่ pre-fill "ยอดขายเดือนนี้ [____] บาท" ให้แก้แค่ตัวเลข + ปุ่ม "เริ่มเลย"
4. Dashboard — top bar (persona pill "แม่ค้าออนไลน์" + avatar) → หัวข้อ "ทิศทางวันนี้" → hero widget radius 28px "ยอดขายเดือนนี้" มี Compass Dial (signature #1) + current/target ใต้หน้าปัด → widget "งานวันนี้" (3-4 task พร้อม checkbox + domain pill) → bottom nav 4 แท็บ (แดชบอร์ด / เป้าหมาย / ปฏิทิน / ตั้งค่า) + FAB "+"
5. Dashboard — state ทำเป้าสำเร็จ 100%: เข็มล็อกทิศเหนือ ปลายเข็ม pulse ข้อความ "ถึงจุดหมายแล้ว" — ไม่มี confetti
6. เป้าหมาย (list) — tab "งาน | ชีวิตส่วนตัว" → GoalCard เรียงตาม period แต่ละ card มี progress bar ที่ปลายขวาเป็น "จุดเหนือ" สี accent + pace badge ("ตามเส้นทาง" เขียว / "ออกนอกเส้นทาง" ส้ม)
7. เป้าหมาย (detail) — hero card radius 28px มี Compass Dial → "เส้นทาง" waypoint แนวตั้งแสดงเป้าสัปดาห์ 4 ตัว (signature #2) พร้อม marker "คุณอยู่ตรงนี้" → รายการ task ที่ผูก
8. สร้าง task — bottom sheet: ชื่อ (ช่องเดียวก็ save ได้), วันครบกำหนด, เลือก domain เป็น pill 6 ตัว, toggle "ทำซ้ำ", ผูกเป้าหมาย (optional)
9. ปฏิทิน (สัปดาห์) — PeriodSwitcher "วัน | สัปดาห์ | เดือน" ด้านบน → 7 คอลัมน์ วันอาทิตย์เป็นวันแรก → task เป็นจุดสี domain
10. ตั้งค่า — โปรไฟล์ · persona · card "เชื่อม LINE" (สถานะยังไม่เชื่อม + ปุ่ม / สถานะเชื่อมแล้ว) · สวิตช์แจ้งเตือน · แถว subscription "Free" + ปุ่มอัปเกรด
11. Task sheet — ส่วน "รูปภาพ": grid 3 คอลัมน์ thumbnail 1:1 radius 14px + tile "+ เพิ่มรูป" แบบ dashed · ทำ 5 state: ยังไม่มีรูป / กำลังอัปโหลด (thumbnail จาง + ring เล็ก — ห้ามใช้ compass dial ตรงนี้) / ล้มเหลว (ขอบ danger + "ลองใหม่") / ถึงลิมิต Free (tile ล็อก "Pro ได้ 5 รูป") / โหลดไม่ได้
12. Action sheet เพิ่มรูป — 2 ตัวเลือก "ถ่ายรูป" / "เลือกจากคลัง" (ถ่ายรูปต้องอยู่บนสุด)
13. Lightbox — เต็มจอพื้นดำ 90%, indicator "2/5", caption ด้านล่าง, ปุ่มลบมุมขวาบน, toast undo หลังลบ

กฎเรื่องรูป: รูปผูกกับ task เท่านั้น · บน dashboard และ goal detail แสดงแค่ icon `image` + จำนวน หรือ thumbnail 40px ซ้อนสูงสุด 3 ท้ายแถว · ห้ามมีรูปใหญ่บน dashboard ห้ามใส่รูปที่ goal — รูปต้องไม่แย่งความสนใจจาก compass dial

## State ที่ต้องมีเพิ่มสำหรับ Dashboard และ เป้าหมาย(list)
- Empty state: icon + หัวข้อเชิญชวน ("ตั้งเป้าหมายแรกของเดือนนี้") + 1 บรรทัด + ปุ่ม CTA — ไม่ใช่หน้าขาว
- Loading: skeleton รูปทรงเดียวกับ content จริง ไม่ใช่ spinner กลางจอ
- Offline: banner บนสุด "ไม่มีอินเทอร์เน็ต" read-only

## Component ที่ต้องแสดงในหน้า "Component sheet" แยกหนึ่งหน้า
Button pill (primary / secondary / ghost / danger + disabled + loading) · Input + Label + error state · Checkbox วงกลม (ว่าง / ติ๊ก) · Switch · DomainTag pill ทั้ง 6 · Compass Dial (0%, 45%, 100%) ขนาดใหญ่และเล็ก · ProgressBar มีจุดเหนือ · AttachmentGrid ทั้ง 5 state · AttachmentStack (1/2/3 รูป) · Illustration monoline: 4 persona + empty-state compass · PaceBadge (ตามแผน / ตกเป้า / เสร็จแล้ว) · GoalCard · TaskRow (ปกติ / ติ๊กแล้ว / เลยกำหนด) · Bottom nav · FAB · Bottom sheet · Toast (สำเร็จ / ผิดพลาด / undo)

## กฎเนื้อหา
- ภาษาไทยทั้งหมด ประโยคปกติ ไม่ใช้ ALL CAPS
- ปุ่มบอกสิ่งที่จะเกิด: "บันทึกเป้าหมาย" ไม่ใช่ "ตกลง"
- ทำสำเร็จใช้คำสั้น: "ทำได้แล้ว" ไม่ใช่ "ยินดีด้วยนะคะ!!!"
- ตัวอย่างข้อมูลต้องสมจริงสำหรับแม่ค้าไทย: "ยอดขายเดือนกันยายน 50,000 บาท", "ตอบแชทลูกค้า", "แพ็คของส่ง 15 ออเดอร์", "โพสต์โปรวันศุกร์" — ไม่ใช้ lorem ipsum หรือชื่อภาษาอังกฤษ

## สิ่งที่ห้ามทำ
- ห้ามใช้ gradient พาดพื้นหลัง, mascot/ตัวการ์ตูน, glassmorphism, เงานีออน, sticker ประดับมุม
- ห้ามใช้พื้น cream/terracotta หรือสีอื่นนอก token
- ห้าม radius เท่ากันทุก element
- ห้ามใช้ emoji แทน icon
- ห้ามใส่ feature ที่ไม่อยู่ในรายการ (ไม่มี drag-drop widget, ไม่มี AI, ไม่มี dark mode ในชุดนี้, ไม่มีการแก้ไข/crop รูป, ไม่มีอัลบั้มรวมรูป)

## Deliverable
- Frame มือถือ 390×844 ทั้ง 10 หน้า + state เพิ่ม + component sheet
- ตั้งชื่อ frame เป็นภาษาอังกฤษตามลำดับ เช่น "01 Login", "04 Dashboard", "04b Dashboard - Goal Done"
- ใช้ auto-layout และตั้งชื่อ layer ให้อ่านออก เพราะจะส่งต่อให้ dev ทำตาม
- เริ่มจาก **Compass Dial component เดี่ยว ๆ 3 state** ก่อน แล้วค่อย Dashboard — ให้ผมดูทั้งสองอย่างก่อนทำหน้าอื่น เพราะ dial กำหนดบุคลิกทั้งแอป ถ้า dial ผิดทุกหน้าผิดตาม
```

---

## Prompt ต่อเนื่อง 1 — Desktop (ใช้หลังมือถือผ่านแล้ว)

```
ต่อจากชุดมือถือที่อนุมัติแล้ว ทำ desktop 1440×900 สำหรับ 4 หน้านี้: Dashboard, เป้าหมาย (list), เป้าหมาย (detail), ปฏิทิน (เดือน)
เปลี่ยนแค่ layout: sidebar ซ้ายพับได้แทน bottom nav · top bar มี persona pill + avatar มุมขวา · เนื้อหากว้างสุด 1200px กึ่งกลาง
Dashboard ใช้ grid 12 คอลัมน์: widget "ยอดขายเดือนนี้" กว้าง 8 คอลัมน์ / "งานวันนี้" 4 คอลัมน์
ทุก token และกฎเดิมทั้งหมดยังใช้ — ห้ามเพิ่มสีหรือ component ใหม่
```

---

## Prompt ต่อเนื่อง 2 — Admin Console (Phase 2 ทำทีหลังได้)

```
ออกแบบ Admin console ของ Kemtit สำหรับ desktop 1440×900 เท่านั้น (ไม่มี mobile)
ใช้ token ชุดเดียวกับ client แต่ปรับ: body 14px · spacing ลดหนึ่งขั้น · radius สูงสุด 14px · พื้นขาว/เทากลางเป็นหลัก สีใช้เฉพาะ status badge · ไม่มี motion/celebration
Layout: sidebar ถาวรซ้าย (ภาพรวม / ผู้ใช้ / Subscription / Events / ระบบ) · top bar มีช่องค้นหา Cmd+K · badge "ADMIN" สีแดงจางมุมบนซ้ายทุกหน้า

หน้าที่ต้องทำ:
1. ภาพรวม — StatTile 4 ตัว (DAU / ผู้ใช้ใหม่วันนี้ / Pro / churn 30 วัน) + กราฟ signup 30 วัน + ตาราง conversion ต่อ persona
2. ผู้ใช้ (list) — data table: email, persona, tier, สมัครเมื่อ, active ล่าสุด · filter · 50 แถว/หน้า · แถวสูง 44px · ตัวเลขชิดขวา
3. ผู้ใช้ (detail) — header + tab (goal/task read-only · ประวัติชำระเงิน · event log)
4. Dialog "Override tier" — เลือก tier + ช่องเหตุผลบังคับกรอก + วันหมดอายุ
5. Events — ตาราง domain_events + filter "ยังไม่ประมวลผล" + ปุ่ม retry + dialog ยืนยันแสดงจำนวน event

ทุก destructive action ต้องมี confirm dialog (ต่างจาก client ที่ใช้ undo) — refund ต้องพิมพ์จำนวนเงินยืนยัน
```
