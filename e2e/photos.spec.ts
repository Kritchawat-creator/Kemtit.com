import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

// PNG 1×1 (โปร่งใส) — พอสำหรับทดสอบ flow อัปโหลด: client ย่อผ่าน canvas → JPEG → Storage → attachPhoto
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const file = (name: string) => ({ name, mimeType: "image/png", buffer: PNG_1x1 });

/**
 * รูปภาพ (Claude Design turn 5): ภาพเป้าหมาย · gallery ความคืบหน้า · รูปแนบงาน · รูปโปรไฟล์
 * ต้องมี Supabase local ที่เปิด storage (config.toml [storage] enabled = true) และ migration photos
 */
test("อัปโหลดภาพเป้าหมาย รูปความคืบหน้า รูปแนบงาน และรูปโปรไฟล์ แล้วลบได้", async ({ page }) => {
  await onboardNewUser(page, "photos");

  // เป้าเดือน → หน้า detail
  await page.goto("/goals");
  await page
    .getByRole("link", { name: /ยอดขาย/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/goals\/[0-9a-f-]+/);

  // ภาพเป้าหมาย (cover) — ช่องอยู่ใน hero (region ชื่อ = ชื่อเป้า)
  const hero = page.getByRole("region", { name: /ยอดขาย/ });
  await hero.locator('input[type="file"]').setInputFiles(file("cover.png"));
  await expect(page.getByText("เพิ่มรูปแล้ว")).toBeVisible({ timeout: 15_000 });
  await expect(hero.getByRole("img", { name: "ภาพเป้าหมาย" })).toBeVisible({ timeout: 15_000 });

  // gallery รูปความคืบหน้า
  const gallery = page.getByRole("region", { name: "รูปความคืบหน้า" });
  await expect(gallery.getByText("0 รูป")).toBeVisible();
  await gallery.locator('input[type="file"]').setInputFiles(file("progress.png"));
  await expect(gallery.getByText("1 รูป")).toBeVisible({ timeout: 15_000 });

  // ลบรูปจาก lightbox
  await gallery.getByRole("button", { name: "ดูรูปเต็มจอ" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "ลบรูป" }).click();
  await expect(page.getByText("ลบรูปแล้ว")).toBeVisible({ timeout: 15_000 });
  await expect(gallery.getByText("0 รูป")).toBeVisible({ timeout: 15_000 });

  // รูปแนบงาน: เปิดรายละเอียดงานตัวอย่างของสัปดาห์แรกจากแดชบอร์ด
  await page.goto("/dashboard");
  const tasksWidget = page.getByRole("region", { name: "งานวันนี้" });
  await tasksWidget
    .getByRole("button", { name: /เปิดรายละเอียด/ })
    .first()
    .click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("0/5 รูป")).toBeVisible();
  await sheet.locator('input[type="file"]').setInputFiles(file("task.png"));
  await expect(sheet.getByText("1/5 รูป")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(tasksWidget.getByText("1 รูป").first()).toBeVisible({ timeout: 15_000 });

  // รูปโปรไฟล์: อัปโหลดแล้ว avatar ใน header เป็นรูป → ลบกลับเป็นตัวอักษร
  await page.goto("/settings");
  await page.locator('input[type="file"]').first().setInputFiles(file("avatar.png"));
  await expect(page.getByText("เพิ่มรูปแล้ว")).toBeVisible({ timeout: 15_000 });
  const headerAvatar = page.getByRole("button", { name: "เมนูผู้ใช้" }).locator("img");
  await expect(headerAvatar).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "ลบรูป" }).first().click();
  await expect(page.getByText("ลบรูปแล้ว")).toBeVisible({ timeout: 15_000 });
  await expect(headerAvatar).toHaveCount(0, { timeout: 15_000 });
});
