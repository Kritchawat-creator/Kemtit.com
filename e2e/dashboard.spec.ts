import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("แดชบอร์ด: เห็น % เป้าหลักเดือนนี้ + งานวันนี้ ติ๊กจาก widget และอัปเดตยอดได้", async ({
  page,
  isMobile,
}) => {
  await onboardNewUser(page, "dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  // desktop ใช้โครง v3 (Claude Design turn 7): การ์ด "เข็มทิศเดือนนี้" บันทึกยอดได้ในที่
  // มือถือใช้ hero เดิม "เป้าหลักเดือนนี้" + ปุ่มอัปเดตยอด — ResponsiveSwitch เรนเดอร์ต้นไม้เดียว (§1.10)
  if (isMobile) {
    const goalWidget = page.getByRole("region", { name: "เป้าหลักเดือนนี้" });
    await expect(goalWidget).toBeVisible();
    await expect(goalWidget.getByText("0%")).toBeVisible();
    await expect(goalWidget.getByRole("link", { name: /ยอดขาย/ }).first()).toBeVisible();

    await goalWidget.getByRole("button", { name: "อัปเดตยอด" }).click();
    await page.getByLabel("ยอดตอนนี้").fill("25000");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("บันทึกยอดแล้ว")).toBeVisible();
    await expect(goalWidget.getByText("50%")).toBeVisible({ timeout: 15_000 });
  } else {
    // การ์ด v3 มีหลัง hydrate เท่านั้น (SSR ส่งต้นไม้มือถือมาก่อน) — รอให้เห็นก่อนค่อยกรอก
    const compass = page.getByRole("region", { name: "เข็มทิศเดือนนี้" });
    await expect(compass).toBeVisible({ timeout: 15_000 });
    await expect(compass.getByText("0%")).toBeVisible();

    await compass.getByRole("textbox", { name: "ยอดวันนี้" }).fill("25000");
    await compass.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText(/บันทึกแล้ว/)).toBeVisible();
    await expect(compass.getByText("50%")).toBeVisible({ timeout: 15_000 });
  }

  const tasksWidget = page.getByRole("region", { name: "งานวันนี้" });
  await expect(tasksWidget).toBeVisible();

  // เพิ่มงานวันนี้: มือถือผ่านลิงก์ "เพิ่มงาน" + ฟอร์ม · desktop พิมพ์ในบรรทัดท้ายลิสต์ (QuickTaskInput)
  if (isMobile) {
    await tasksWidget.getByRole("link", { name: "เพิ่มงาน" }).first().click();
    await page.getByLabel("ชื่องาน").fill("แพ็คของส่งลูกค้า");
    await page.getByRole("button", { name: "บันทึกงาน" }).click();
  } else {
    await tasksWidget.getByRole("textbox", { name: "เพิ่มงาน" }).fill("แพ็คของส่งลูกค้า");
    await tasksWidget.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  }
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  const box = tasksWidget.getByRole("checkbox", { name: /แพ็คของส่งลูกค้า/ });
  const toggled = page.waitForResponse((r) => r.request().method() === "POST");
  await box.check();
  await toggled;
  await expect(tasksWidget.getByText(/ทำต่อเนื่อง 1 วัน/)).toBeVisible({ timeout: 15_000 });
});
