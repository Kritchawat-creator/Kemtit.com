import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("สร้างเป้าชีวิตส่วนตัวผ่านปุ่มเพิ่ม แล้วเห็นใน filter ชีวิตส่วนตัว", async ({ page }) => {
  await onboardNewUser(page, "goals");

  await page.goto("/goals?new=goal");
  await expect(page.getByRole("heading", { name: "เพิ่มเป้าหมาย" })).toBeVisible();
  await page.getByLabel("ชื่อเป้าหมาย").fill("ออกกำลังกายเดือนนี้");
  await page.getByRole("radio", { name: /สุขภาพ/ }).click();
  await page.getByRole("button", { name: "บันทึกเป้าหมาย" }).click();
  await expect(page.getByText("บันทึกเป้าหมายแล้ว")).toBeVisible();

  await page.goto("/goals?domain=life");
  await expect(page.getByRole("link", { name: /ออกกำลังกายเดือนนี้/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /ยอดขาย/ })).toHaveCount(0);
});
