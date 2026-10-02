# Kemtit Planner — สรุปแผนสำหรับ Implementation

22 กันยายน 2026 · แผนลงมือพัฒนาต่อจากต้นแบบ ไม่ใช่คำยืนยันว่า backend ใหม่เสร็จแล้ว

## ผลลัพธ์ที่ต้องส่งมอบ

**ผู้ใช้บอกสิ่งที่ต้องทำครั้งเดียว เห็นแผนที่พอดีกับเวลาจริง และปรับแผนต่อได้เมื่อชีวิตเปลี่ยน**

จุดขายที่ต้องพิสูจน์คือความต่อเนื่องของการเลือกงาน → ลงเวลา → ปรับแผน → ทบทวน โดยผู้ใช้กรอกซ้ำและตัดสินใจซ้ำน้อยลง ใช้ความถูกต้องและความเข้าใจของผู้ใช้เป็นเกณฑ์ร่วมกับจำนวนการกด ไม่อ้างว่ามีฟีเจอร์มากกว่าหรือ AI มากกว่าแล้วดีกว่าโดยอัตโนมัติ

## สถานะก่อนเริ่ม

- มี clickable prototype 21 หน้า ตรวจเส้นทางหลักและ responsive แล้ว; ข้อมูลอยู่ใน browser และใช้วันที่เดโม ไม่ใช่ production data
- UI ล่าสุดใช้ IBM Plex Sans Thai พร้อม OFL, ไอคอน Lucide พร้อม ISC/MIT, ปุ่ม Google asset ทางการ; active Sidebar ใช้ตัวอักษรเข้มและไฮไลต์บางเฉพาะใต้ชื่อ ไม่มีรูปตกแต่งซ้อนไอคอนหรือแถบสีซ้าย
- แอปเดิมมี Next.js/Supabase, Tasks, Goals, Projects, Recurrence, Daily Plan, Time Blocks และ Reviews อยู่แล้ว ให้ต่อยอดของเดิมและคง route compatibility
- Baseline ที่ตรวจในรอบวิเคราะห์ยังไม่ผ่านทั้งหมด: 115 tests ผ่าน, 1 test ข้าม, 1 suite ล้มเหลว; TypeScript ยังมีข้อผิดพลาด ดู [QA และข้อจำกัด](prototypes/planner-vnext/QA.md)
- รอบนี้เปลี่ยน production เฉพาะการอ้างอิงฟอนต์และเอกสารสิทธิ์ ไม่ได้เชื่อม Google OAuth จริง ย้าย schema หรือ deploy

## ลำดับพัฒนา

| ระยะ | งานหลัก | ผลลัพธ์ที่ผู้ใช้ได้ | เกณฑ์จบ |
| --- | --- | --- | --- |
| **P0 — ฐานข้อมูลและความถูกต้อง** | แก้ baseline checks, review อ่านผิดสัปดาห์, query error ที่กลายเป็น empty; กำหนด planned date/deadline และ task/occurrence/block identity; migration แบบ additive | ย้ายงานแล้วข้อมูลไม่หาย ไม่ซ้ำ และวันส่งไม่เปลี่ยนเงียบ ๆ | tests ของกฎข้อมูลผ่าน; task/block เปลี่ยนสอดคล้องกัน; RLS และ rollback ผ่านการตรวจ; required checks ผ่านก่อน release |
| **P1a — วันแรกและงานประจำวัน** | ย้าย UI foundations เข้าของเดิม; Google Sign-in + อีเมล OTP; Today, Capture, Inbox, Tasks และ Plan ใช้ task เดียวกัน | เข้ามาครั้งแรกแล้วพิมพ์งานได้เลย ทำเสร็จได้ในหน้าเดิม | ไม่บังคับสร้าง goal/project/integration; กรอกหนึ่งครั้งและบันทึกหนึ่งครั้ง; complete/undo สะท้อนทุก view; auth cancel/error ไม่เป็นทางตัน |
| **P1b — เวลาและปฏิทิน** | shared availability รวม work hours, busy events, breaks และ task blocks; Calendar สร้าง/ย้าย/แก้/ยกเลิก block; เชื่อมบริบท Goals/Projects/Routine/Finance ที่มีอยู่ | เห็นว่าทำอะไรไหวจริงโดยไม่ต้องตรวจหลายหน้า | ไม่หักเวลาซ้ำ; timezone/ข้ามวัน/occurrence ถูกต้อง; task ที่มี block ไม่ถูกนับซ้ำ; calendar อ่านไม่ได้ไม่แสดงเวลาว่างแบบมั่นใจ |
| **P2 — ปรับแผนและทบทวน** | Rescue แบบ preview → confirm → undo; Review เลือกงานไปสัปดาห์ถัดไป; Insights เฉพาะเมื่อมีหลักฐาน; Focus เป็นทางเลือก | มีงานแทรกแล้วไม่ต้องจัดใหม่ทั้งหมด และ review ทำให้เกิดแผนต่อ | รักษา locks/deadlines; แจ้งงานที่ลงไม่ได้; stale preview ต้องคำนวณใหม่; apply หลายรายการเป็น transaction; undo ไม่ทับการแก้ใหม่ของผู้ใช้ |
| **P3 — ภาษาไทยและ LINE** | ตีความข้อความไทยพร้อมแก้ผลก่อน save; เชื่อม LINE แบบ opt-in และติดตามการส่ง; ขยายตามผล pilot | จดและกลับมาทำงานสะดวกขึ้นในบริบทไทย | วันที่/เวลาที่กำกวมไม่ถูกบันทึกโดยเดาเงียบ ๆ; retry ไม่ซ้ำ; ใช้ต่อได้เมื่อ integration ปฏิเสธหรือขัดข้อง |

**MVP สำหรับทดลองจริง = P0 + P1a + P1b + เส้นทางหลักของ P2** ส่วนการปรับหน้าบริบททั้งหมดให้ละเอียด, Insights ขั้นสูง, Focus และ P3 ไม่ควรทำให้แกนหลักออกทดลองช้า ผู้ใช้ไม่ต้องเปิดครบ 21 หน้าเพื่อวางแผนหนึ่งวัน

## แบ่งเป็นงานที่ตรวจรับได้

1. **Baseline และ contract:** แก้ TypeScript/test environment โดยไม่ลบหรือลด assertions; บันทึก data/date semantics และกรณีข้อมูลเก่าก่อนแตะ migration
2. **Data integrity:** เพิ่ม planned-date/deadline ตามสัญญา, lifecycle ของ block, exact-week review และ query-error states พร้อม tests; ไม่ตีความ `due_date` เก่าทุกแถวว่าเป็น deadline โดยไม่มีหลักฐาน
3. **Shared UI:** port typography, buttons, task rows, navigation และ first-use states เข้าคอมโพเนนต์เดิม; ใช้ต้นแบบเป็นข้อกำหนด UX ไม่คัดลอก localStorage/demo logic ไปใช้แทน backend
4. **Auth และ first-use:** Google ผ่าน Supabase Auth เดิม, callback/redirect allowlist/session cookie, อีเมล OTP และ intended destination; แยกสิทธิ์ Calendar ออกจากการ Sign-in
5. **Capture → Today → Plan:** canonical task ID/occurrence identity, inline save/complete/undo, priority และเวลาประเมิน; เพิ่ม server validation/authorization และป้องกัน submit ซ้ำ
6. **Availability → Calendar:** domain calculation ชุดเดียวสำหรับ Today/Plan/Calendar, busy-interval union และ block mutations ที่สอดคล้องกับ task; เก็บ Calendar import เป็น read-only ตาม contract ปัจจุบัน
7. **Rescue → Review:** proposal ที่อธิบายได้, version/conflict guard, transactional apply/undo, carryover โดย task เดิมและ deadline เดิม; ไม่มีระบบ LLM เป็น dependency ของความถูกต้อง
8. **ตรวจรับและ pilot:** ทุก core flow ผ่านบนมือถือ แท็บเล็ต เดสก์ท็อป รวม error/offline/permission; ทดลองกับผู้ใช้กลุ่มแรก 5–8 คนก่อนขยาย P3

แต่ละงานต้องอ่าน source ปัจจุบันใหม่ รัน GitNexus impact ก่อนแก้ และใช้ขอบเขต commit/PR เล็กที่ตรวจและย้อนกลับได้ ประเมิน effort หลังงาน 1–2 ทำให้ dependency และ migration ชัดเจน ไม่ให้วันส่งมอบจากจำนวนหน้าต้นแบบ

## กติกา UX ที่ห้ามหลุดตอนทำระบบจริง

- ครั้งแรกเปิด Today แล้วมีช่องสร้างงานพร้อมตัวอย่างที่เลือกแก้ได้; หน้าอื่นที่ยังไม่มีข้อมูลมีทางเริ่มตรงบริบท ไม่แสดงตัวเลขส่วนตัวแต่งขึ้น
- ข้อมูลตัวอย่างอยู่ในโหมดทดลองแยกจากข้อมูลจริงและมีป้ายชัดเจน
- การกระทำหลักหนึ่งเรื่องต่อบริบท; advanced fields เปิดเมื่อขอ; inline actions และ undo สำหรับการเปลี่ยนที่ย้อนกลับได้
- เป้าหมายการใช้งาน: capture = พิมพ์หนึ่งครั้ง + save หนึ่งครั้ง; complete = หนึ่งครั้ง; daily plan = ดูข้อเสนอ + ยืนยันเมื่อข้อเสนอถูกต้อง ตัวเลขเป็นเป้าออกแบบ ต้องวัด error และเวลาที่ใช้แก้ตามด้วย
- ต้นแบบ active menu รุ่นล่าสุดเป็น label highlight; ไม่ใช้ colored left-border badge/calendar chip และไม่คืนปุ่ม gray native default
- แยก normal/loading/done/empty/error/offline/permission ตาม [state contracts ในแผนเต็ม](planner-development-plan-2026-09-22.md) ไม่ใช้หน้า empty แทนข้อผิดพลาด

## เกณฑ์ก่อนเปิดใช้งานจริง

**ระบบ:** lint/typecheck/build และ required tests ผ่าน; unit tests ตรวจ availability/date/recurrence; integration ตรวจ Supabase RLS, transaction, concurrent edits และ idempotency; E2E ตรวจ auth, fresh start, capture/complete, block move, rescue/undo และ review carryover

**สิทธิ์ asset:** เก็บแหล่งที่มาและ notices ให้ตรงชุดเผยแพร่ตาม [นโยบาย asset](asset-usage-policy.md) และ [ผลตรวจ](asset-rights-audit-2026-09-22.md); ปิดช่องว่าง `server-only` notice, ตรวจ dependencies ที่รวมอยู่ใน release จริง และตรวจชื่อ/โลโก้ Kemtit ตามตลาดที่จะใช้ก่อนกล่าวว่า trademark-cleared ไม่มีการรับรองว่า open-source asset “ไม่มีลิขสิทธิ์” หรือครอบคลุมภาพที่ผู้ใช้อัปโหลด

**คุณค่าต่อผู้ใช้:** งานหลักสำเร็จโดยไม่กรอกซ้ำ, เวลาวางแผน/ปรับแผนลดลงโดยข้อผิดพลาดไม่เพิ่ม, ผู้ใช้เข้าใจข้อเสนอและย้อนกลับได้ ทดลองกับผู้ใช้ 5–8 คนช่วยค้นหาปัญหาเชิงคุณภาพ ไม่ใช่หลักฐานทางสถิติว่า productivity สูงกว่าแอปอื่น

## เอกสารอ้างอิงสำหรับผู้ลงมือทำ

- [Research 9 ผลิตภัณฑ์และข้อจำกัดของ positioning](planner-competitor-research-2026-09-22.md)
- [แผนเต็ม: source audit, contracts, 21 หน้า และ acceptance criteria](planner-development-plan-2026-09-22.md)
- [Prototype และวิธีรัน](prototypes/planner-vnext/README.md)
- [ผล QA และ baseline ที่ยังต้องแก้](prototypes/planner-vnext/QA.md)
- [ข้อเสนอจุดขายและ workflow](planner-presentation-2026-09-22.md)
