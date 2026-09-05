import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("ปฏิทิน: งานที่เพิ่มวันนี้ปรากฏในมุมมองสัปดาห์ เดือน และวัน", async ({ page }) => {
  await onboardNewUser(page, "calendar");

  await page.goto("/calendar?view=week&new=task");
  await page.getByLabel("ชื่องาน").fill("นัดส่งของหน้าปฏิทิน");
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  // สัปดาห์ (default) — เห็นชื่องานในคอลัมน์วันนี้
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "ปฏิทิน" })).toBeVisible();
  await expect(page.getByText("นัดส่งของหน้าปฏิทิน")).toBeVisible();

  // เดือน — วันนี้มีจำนวนงาน ≥ 1 (aria-label ของช่องวัน)
  await page.getByRole("link", { name: "เดือน" }).click();
  await expect(page).toHaveURL(/view=month/);
  await expect(page.getByRole("link", { name: /1 งาน|2 งาน|3 งาน/ }).first()).toBeVisible();

  // วัน — TaskList ของวันนี้ ติ๊กได้
  await page.getByRole("link", { name: "วัน", exact: true }).click();
  await expect(page).toHaveURL(/view=day/);
  await expect(page.getByRole("checkbox", { name: /นัดส่งของหน้าปฏิทิน/ })).toBeVisible();

  // เลื่อนไปสัปดาห์ถัดไปแล้วกลับ "วันนี้"
  await page.getByRole("link", { name: "สัปดาห์" }).click();
  await page.getByRole("link", { name: "ถัดไป" }).click();
  await expect(page.getByText("นัดส่งของหน้าปฏิทิน")).toHaveCount(0);
  await page.getByRole("link", { name: "วันนี้" }).click();
  await expect(page.getByText("นัดส่งของหน้าปฏิทิน")).toBeVisible();
});
