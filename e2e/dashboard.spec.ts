import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("แดชบอร์ด: เห็น % เป้าหลักเดือนนี้ + งานวันนี้ ติ๊กจาก widget และอัปเดตยอดได้", async ({
  page,
}) => {
  await onboardNewUser(page, "dashboard");

  await expect(page).toHaveURL(/\/dashboard/);
  const goalWidget = page.getByRole("region", { name: "เป้าหลักเดือนนี้" });
  await expect(goalWidget).toBeVisible();
  await expect(goalWidget.getByText("0%")).toBeVisible();
  await expect(goalWidget.getByRole("link", { name: /ยอดขาย/ }).first()).toBeVisible();

  const tasksWidget = page.getByRole("region", { name: "งานวันนี้" });
  await expect(tasksWidget).toBeVisible();

  // อัปเดตยอดจาก widget → 50%
  await goalWidget.getByRole("button", { name: "อัปเดตยอด" }).click();
  await page.getByLabel("ยอดตอนนี้").fill("25000");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("บันทึกยอดแล้ว")).toBeVisible();
  await expect(goalWidget.getByText("50%")).toBeVisible({ timeout: 15_000 });

  // เพิ่มงานวันนี้จาก widget แล้วติ๊กในที่ → streak 1 วัน
  await tasksWidget.getByRole("link", { name: "เพิ่มงาน" }).first().click();
  await page.getByLabel("ชื่องาน").fill("แพ็คของส่งลูกค้า");
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();
  const box = tasksWidget.getByRole("checkbox", { name: /แพ็คของส่งลูกค้า/ });
  const toggled = page.waitForResponse((r) => r.request().method() === "POST");
  await box.check();
  await toggled;
  await expect(tasksWidget.getByText(/ทำต่อเนื่อง 1 วัน/)).toBeVisible({ timeout: 15_000 });
});
