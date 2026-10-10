# หลักฐานตรวจต้นแบบ — 9 ตุลาคม 2026

ขอบเขต: standalone mockup ระยะ 0 ที่ `http://127.0.0.1:8767/life-planner-review/` ไม่ใช่ production QA ไม่มี unit/integration test สำหรับแอปจริงใน batch นี้

## ตรวจผ่านจาก UI

| พฤติกรรม | หลักฐานที่สังเกต |
| --- | --- |
| เพิ่มการ์ดข้อความ | จำนวน 4 → 5; ชื่องานแสดง; ยังไม่จัดเวลา |
| ลากการ์ดลงช่องเวลา | ลากจุดจับ “เดินเล่นหลังเลิกงาน” → 09:00; การ์ดและบล็อกเป็น 09:00–09:30 |
| ย้ายบล็อกเดิม | 09:00 → 11:00–11:30; จำนวนการ์ดยัง 5; reload รักษาเวลา |
| บันทึกล้มเหลวจาก drag | จำลอง failure แล้วย้าย 11:00 → 12:00; การ์ดและบล็อกยัง 11:00–11:30; แจ้งไม่สำเร็จ |
| Drag + Undo หลังปรับ layout ล่าสุด | “จัดมุมทำงานฯ” → 09:00–09:30 แล้ว Undo → ยังไม่จัดเวลา; จำนวนยัง 4 |
| ป้องกันเวลาทับซ้อน | จัด “อ่านหนังสือฯ” 10:00 ชนงานเดิม; dialog ยังเปิดและแจ้งทับซ้อน; เปลี่ยน 12:00 ผ่าน |
| ทางเลือกจัดเวลาบนจอ 390px | เปลี่ยนงานเดิมเป็น 10 ต.ค. 13:00–14:00; เลือกวันนั้นพบช่วงเวลา; จำนวนยัง 6 |
| สร้างกลุ่มผ่านปุ่ม | รวม 2 งาน; เปิดกลุ่มพบเวลาเดิมของสมาชิกทั้งสอง |
| เปลี่ยนชื่อ / ยุบ / Undo | เปลี่ยนชื่อ “พื้นที่งานและชีวิต”; ยุบแล้ว Undo กลับเป็นกลุ่มเดิม 2 งาน |
| ลากเข้ากลุ่มที่มีอยู่ | ลาก “อ่านหนังสือฯ” ลงกลุ่ม → แสดง 3 งาน |
| Group save failure | dialog ยังเปิด แสดง error ใน dialog ไม่เพิ่มสมาชิก |
| Cover ตามลำดับไฟล์ | เบราว์เซอร์ในแอป: เลือก PNG ที่สร้างเอง 2 รูป; DOM src ตรงไฟล์แรก; เอาปกออกแล้วตรงไฟล์ที่สอง; reload รักษาปก |
| งานย่อย | กด checkbox งานย่อยจากรายละเอียดและบันทึก |
| Wizard | ปฏิเสธ whitespace-only; 3 ขั้น; ย้อนขั้นรักษาข้อความ; ยืนยันแล้วเพิ่ม 1 เป้าหมาย/1 งานที่เชื่อม |
| ภาพรวม → งานที่เชื่อม | เป้าหมายงานแสดงการ์ดที่เชื่อม 2 ใบ และกดดูงานทั้งหมดได้ |
| สิ่งสำคัญวันนี้ | เลือกครบ 3 แล้วการเลือกใบที่ 4 ถูกปฏิเสธ; จำนวนยัง 3 |
| ทบทวน | กรอก บันทึก reload แล้วข้อความยังอยู่ |
| ข้อมูลว่าง / มาก | ว่างแสดง 0/0, 0 รายการ, เพิ่มงานแรก; รายการมากมีชื่อไทยยาว 15 ใบเพิ่มเติม |
| Keyboard บางส่วน | Escape ปิด dialog ได้; ยังไม่ใช่การตรวจ accessibility ครบโฟลว์ |

ตรวจ drag ผ่าน Chrome ด้วย pointer UI จริง; อ่าน DOM หลัง action เพื่อยืนยัน ไม่เรียก mutation จาก JavaScript เพื่อทำให้ผลผ่าน

## Responsive

ตรวจ layout ใน Chrome ด้วย viewport override: 1440×900, 768×1024, 390×844 และ 360×800; คืนขนาดเดิมแล้วหลังตรวจ

- พบ overflow 377px บน viewport 360px ในรอบแรก แก้ขนาด grid และตรวจซ้ำชุดรายการมากแล้ว `scrollWidth === innerWidth === 360`
- 1440/768/390px ตรวจซ้ำหลังปรับแล้ว `scrollWidth === innerWidth`
- หน้าจอแคบเปลี่ยนเป็นวันเดียว และการ์ดอยู่ใต้ตาราง แสดงหลายงานด้วยการเลื่อนหน้า
- การเปลี่ยน viewport เป็นการตรวจขนาดหน้า ไม่ใช่หลักฐานใช้งานบนเครื่องจริงหรือการจำลอง touch/Pencil

## ข้อจำกัดของการตรวจ

- ยังไม่ตรวจ drag ค้างบนการ์ดเพื่อ **สร้าง** กลุ่มด้วย UI automation; ตรวจสร้างด้วยปุ่ม และ drag **เข้า** กลุ่มแล้วเท่านั้น
- ยังไม่ตรวจ touch long press, การเลื่อนขณะลากข้ามพื้นที่, pointer cancel/rotation, Pencil, physical iPad/iPhone/Android, screen reader, keyboard ครบ, focus restoration, contrast audit หรือ 200% zoom
- ยังไม่มี user study 5 คน, baseline ระยะเวลา/ความผิดพลาด หรือการอนุมัติต้นแบบ
- Chrome file upload ถูกส่วนขยายจำกัดสิทธิ์เข้าถึง file URL จึงตรวจรูปด้วยเบราว์เซอร์ในแอป ไม่ได้เปลี่ยนสิทธิ์ส่วนขยาย
- Console ที่อ่านช่วงตรวจมี warning จากส่วนขยาย EverBee; ไม่พบ error ของ prototype ในรายการที่เครื่องมือคืนมา ไม่ใช่การรับรองว่าไม่เคยเกิด error ทุกกรณี
- LocalStorage persistence/Undo ไม่ยืนยัน production storage, authorization, expected version, multi-tab concurrency, offline retry, API idempotency หรือ calendar integration

## ภาพหลักฐาน

- [วันนี้ desktop](evidence/today-desktop.png)
- [ภาพรวม desktop](evidence/overview-desktop.png)
- [วันนี้ tablet](evidence/today-tablet.png)
- [วันนี้ phone](evidence/today-phone.png)
- [Cover detail ในเบราว์เซอร์ในแอป](evidence/cover-detail.png)
- [Wizard ตรวจแผนก่อนยืนยัน](evidence/wizard-preview.png)

## ตรวจไฟล์

ก่อนส่งมอบตรวจผ่าน: `node --check docs/prototypes/life-planner-review/app.js`, Prettier check สำหรับ HTML/CSS/JS/README/QA, ลิงก์ไฟล์ในเอกสารต้นแบบและแผนหลัก, trailing whitespace ในไฟล์ต้นแบบ และ `git diff --check` ของ tracked checkout (ไฟล์ต้นแบบใหม่ตรวจ whitespace แยกแล้ว)

GitNexus impact ของ `renderLifePlannerMockup` และ `combine` คืน UNKNOWN (target ไม่อยู่ใน index) จึงไม่ถือเป็น low risk ตรวจข้อความประกอบพบฟังก์ชันใหม่ในต้นแบบเท่านั้น ไม่มีการแก้ caller ของแอป production; index สร้างก่อนต้นแบบนี้ ไม่มี commit ใน batch นี้
