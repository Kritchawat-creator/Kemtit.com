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
