import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("เพิ่มงานให้เป้าสัปดาห์ ติ๊กเสร็จทั้งหมด แล้วเป้าสัปดาห์ครบ 100%", async ({ page }) => {
  await onboardNewUser(page, "tasks");

  await page.goto("/goals");
  await page.getByRole("link", { name: /สัปดาห์ที่ 1\// }).click();
  await expect(page).toHaveURL(/\/goals\/[0-9a-f-]+/);

  // task ตัวอย่างจาก template (Decision 1.4) 1 ตัว
  await expect(page.getByRole("checkbox")).toHaveCount(1);

  // เพิ่มงานอีก 1 ผูกกับเป้านี้ผ่านปุ่มในหน้า detail (?new=task&goal=)
  await page.getByRole("link", { name: "เพิ่มงาน" }).first().click();
  await page.getByLabel("ชื่องาน").fill("โทรหาลูกค้าเก่า 5 ราย");
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(2);

  // ติ๊กทั้งสอง → execution goal ถึง 100 → toast ทำได้แล้ว + ring 100%
  await page.getByRole("checkbox", { name: /โทรหาลูกค้าเก่า/ }).check();
  await page.getByRole("checkbox", { name: /ตั้งราคาและโปรโมชั่น/ }).check();
  await expect(page.getByText(/ทำได้แล้ว/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("100%").first()).toBeVisible({ timeout: 15_000 });
});

test("task ซ้ำทุกวัน: ติ๊กวันนี้เป็นเสร็จ คงอยู่หลัง reload และยกเลิกได้ (task_completions)", async ({ page }) => {
  await onboardNewUser(page, "recurring");

  // สร้าง task ซ้ำทุกวันผูกกับเป้าเดือน
  await page.goto("/goals?new=task");
  await page.getByLabel("ชื่องาน").fill("เช็คสต็อกสินค้า");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: /ยอดขาย/ }).click();
  await page.locator('label[for="recurrence-daily"]').click();
  await expect(page.getByRole("radio", { name: "ทุกวัน" })).toBeChecked();
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  await page.getByRole("link", { name: /ยอดขาย/ }).first().click();
  const box = page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ });
  await expect(box).toBeVisible();
  // UI ติ๊กแบบ optimistic ทันที — ต้องรอ response ของ server action (POST) ก่อน reload ไม่งั้น reload จะยกเลิก request
  const checked = page.waitForResponse((r) => r.request().method() === "POST");
  await box.check();
  await expect(box).toBeChecked();
  await checked;

  // ประวัติอยู่ใน task_completions → reload แล้วยังติ๊กอยู่
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ })).toBeChecked();

  const unchecked = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ }).uncheck();
  await expect(page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ })).not.toBeChecked();
  await unchecked;
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ })).not.toBeChecked();
});
