import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

/**
 * Uploads (Design §6A): รูปแนบงาน (task เท่านั้น) + รูปโปรไฟล์ ใต้ flag NEXT_PUBLIC_FLAG_UPLOADS
 * - flag = 1: flow อัปโหลด/ลบเต็ม (CI: job `e2e-uploads` ใน ci.yml — ห้ามให้ spec นี้ถูก skip เงียบใน CI)
 * - flag ≠ 1 (ค่าเริ่มต้น POC/CP1): ยืนยันว่าไม่มี UI อัปโหลดเลย
 * ต้องมี Supabase local ที่เปิด storage (config.toml [storage] enabled = true) และ migration photos + uploads_private
 */
const UPLOADS_ENABLED = process.env.NEXT_PUBLIC_FLAG_UPLOADS === "1";
if (process.env.CI && !UPLOADS_ENABLED) {
  throw new Error(
    "e2e/photos.spec.ts ใน CI ต้องรันด้วย NEXT_PUBLIC_FLAG_UPLOADS=1 (job e2e-uploads) — ไม่ให้ skip เงียบ",
  );
}

// PNG 1×1 (โปร่งใส) — พอสำหรับทดสอบ flow อัปโหลด: client ย่อผ่าน canvas → JPEG → Storage → attachPhoto
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const file = (name: string) => ({ name, mimeType: "image/png", buffer: PNG_1x1 });
const SIGNED_URL = /\/storage\/v1\/object\/sign\/photos\//;

test.describe("flag เปิด", () => {
  test.skip(!UPLOADS_ENABLED, "ตั้ง NEXT_PUBLIC_FLAG_UPLOADS=1 เพื่อรัน flow อัปโหลด");

  test("แนบรูปที่งาน: sheet อัปโหลด/ลบ · dashboard เห็นแค่ icon+จำนวน · goal detail เห็น thumbnail · URL เป็น signed", async ({
    page,
  }) => {
    await onboardNewUser(page, "photos");

    // รายละเอียดงานจาก dashboard (งานตัวอย่างของสัปดาห์แรก)
    const tasksWidget = page.getByRole("region", { name: "งานวันนี้" });
    const openTask = tasksWidget.getByRole("button", { name: /เปิดรายละเอียด/ }).first();
    const taskTitle = (await openTask.getAttribute("aria-label"))!.replace("เปิดรายละเอียด ", "");
    await openTask.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("0/5 รูป")).toBeVisible();
    await sheet.locator('input[type="file"]').setInputFiles(file("task.png"));
    await expect(sheet.getByText("1/5 รูป")).toBeVisible({ timeout: 15_000 });
    // bucket เป็น private → รูปต้องมาจาก signed URL ไม่ใช่ /object/public/
    const src = await sheet.getByRole("img").first().getAttribute("src");
    expect(src).toMatch(SIGNED_URL);
    expect(src).not.toContain("/object/public/");
    await page.keyboard.press("Escape");

    // dashboard/TodayTasks: icon + จำนวน เท่านั้น ไม่มี thumbnail (§6A.3)
    await expect(tasksWidget.getByRole("img", { name: "1 รูป" })).toBeVisible({ timeout: 15_000 });
    await expect(tasksWidget.locator("img")).toHaveCount(0);

    // goal detail ของเป้าสัปดาห์ที่ 1 (เจ้าของงานตัวอย่าง): thumbnail stack 40px
    await page.goto("/goals");
    await page.getByRole("link", { name: /สัปดาห์ที่ 1\// }).click();
    await expect(page).toHaveURL(/\/goals\/[0-9a-f-]+/);
    const row = page.getByRole("listitem").filter({ hasText: taskTitle }).first();
    await expect(row.getByRole("img", { name: "1 รูป" })).toBeVisible({ timeout: 15_000 });
    await expect(row.locator("img").first()).toHaveAttribute("src", SIGNED_URL);

    // ลบจาก lightbox
    await row.getByRole("button", { name: /เปิดรายละเอียด/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ดูรูปเต็มจอ" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "ลบรูป" }).last().click();
    await expect(page.getByText("ลบรูปแล้ว")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("dialog").getByText("0/5 รูป").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("รูปโปรไฟล์: อัปโหลดแล้ว header เป็นรูป (signed) → ลบกลับเป็นตัวอักษร", async ({ page }) => {
    await onboardNewUser(page, "avatar");
    await page.goto("/settings");
    // เลือกไฟล์ผ่านการคลิกช่อง avatar → filechooser ยิงเฉพาะเมื่อ React hydrate แล้ว (setInputFiles ตรง ๆ แพ้ race ใน dev)
    await expect(async () => {
      const chooser = page.waitForEvent("filechooser", { timeout: 2_000 });
      await page.getByRole("button", { name: "รูปโปรไฟล์" }).click();
      await (await chooser).setFiles(file("avatar.png"));
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("เพิ่มรูปแล้ว")).toBeVisible({ timeout: 15_000 });
    const headerAvatar = page.getByRole("button", { name: "เมนูผู้ใช้" }).locator("img");
    await expect(headerAvatar).toBeVisible({ timeout: 15_000 });
    await expect(headerAvatar).toHaveAttribute("src", SIGNED_URL);
    await page.getByRole("button", { name: "ลบรูป" }).first().click();
    await expect(page.getByText("ลบรูปแล้ว")).toBeVisible({ timeout: 15_000 });
    await expect(headerAvatar).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe("flag ปิด (ค่าเริ่มต้น POC/CP1)", () => {
  test.skip(UPLOADS_ENABLED, "รันเมื่อ NEXT_PUBLIC_FLAG_UPLOADS ไม่ใช่ 1");

  test("ไม่มี UI อัปโหลดที่งาน ฟอร์ม และโปรไฟล์ · header เป็นตัวอักษร", async ({ page }) => {
    await onboardNewUser(page, "noupload");

    const tasksWidget = page.getByRole("region", { name: "งานวันนี้" });
    await tasksWidget
      .getByRole("button", { name: /เปิดรายละเอียด/ })
      .first()
      .click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("button", { name: "แก้ไข" })).toBeVisible();
    await expect(sheet.locator('input[type="file"]')).toHaveCount(0);
    await expect(sheet.getByText(/รูป/)).toHaveCount(0);
    await sheet.getByRole("button", { name: "แก้ไข" }).click();
    await expect(sheet.locator('input[type="file"]')).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.goto("/settings");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "เมนูผู้ใช้" }).locator("img")).toHaveCount(0);
  });
});
