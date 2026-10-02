import { expect, test } from "@playwright/test";

import { signInWithOtp, uniqueEmail } from "./helpers";

test("Starter Workspace ไม่ persist suggestion จนกว่าจะ Add และรองรับ Edit/Skip", async ({ page }) => {
  const email = uniqueEmail("starter-semantics");
  await signInWithOtp(page, email);

  await expect(page).toHaveURL(/\/onboarding\/persona/);
  await expect(page.getByText("พนักงาน", { exact: true })).toBeVisible();
  await expect(page.getByText("ผู้ขาย / ร้านค้า", { exact: true })).toBeVisible();
  await expect(page.getByText("นักเรียน / นักศึกษา", { exact: true })).toBeVisible();
  await expect(page.getByText("ฟรีแลนซ์", { exact: true })).toBeVisible();

  await page.getByText("ผู้ขาย / ร้านค้า", { exact: true }).click();
  await page.getByRole("button", { name: "เลือกบทบาทนี้" }).click();

  await expect(page).toHaveURL(/\/onboarding\/focus/, { timeout: 15_000 });
  await page.getByText("งาน", { exact: true }).first().click();
  await page.getByText("การเงิน", { exact: true }).first().click();
  await page.getByRole("button", { name: "เตรียมพื้นที่เริ่มต้น" }).click();

  await expect(page).toHaveURL(/\/onboarding\/starter/, { timeout: 15_000 });
  await expect(page.getByText("ยังไม่มีอะไรถูกเพิ่มเป็นข้อมูลจริง")).toBeVisible();

  const workSuggestion = page
    .locator("article")
    .filter({ hasText: "เลือกงานสำคัญที่สุดของวันนี้" });
  await workSuggestion.getByRole("button", { name: "แก้ไข" }).click();
  const editingWorkSuggestion = page.locator("article").filter({
    has: page.getByRole("textbox", { name: "เลือกงานสำคัญที่สุดของวันนี้" }),
  });
  await editingWorkSuggestion.getByRole("textbox").fill("งานสำคัญที่ฉันเลือกเอง");
  await editingWorkSuggestion.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  const acceptedWorkSuggestion = page
    .locator("article")
    .filter({ hasText: "งานสำคัญที่ฉันเลือกเอง" });
  await expect(acceptedWorkSuggestion.getByText("เพิ่มแล้ว")).toBeVisible();

  const financeSuggestion = page.locator("article").filter({ hasText: "กำหนดงบประมาณเดือนนี้" });
  await financeSuggestion.getByRole("button", { name: "ข้าม" }).click();
  await expect(financeSuggestion).toHaveCount(0);

  // Role goal is intentionally left untouched. It must not become USER data.
  await page.getByRole("button", { name: "ไปหน้าวันนี้" }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 20_000 });

  await expect(page.getByText("งานสำคัญที่ฉันเลือกเอง", { exact: true }).first()).toBeVisible();

  await page.goto("/goals");
  await expect(page.getByText("วางเป้าหมายหลักของร้านเดือนนี้", { exact: true })).toHaveCount(0);
});

test("Accepted Habit จาก Starter Workspace กลายเป็นข้อมูลจริง แต่ suggestion อื่นไม่ถูกสร้าง", async ({
  page,
}) => {
  const email = uniqueEmail("starter-habit");
  await signInWithOtp(page, email);

  await page.getByText("พนักงาน", { exact: true }).click();
  await page.getByRole("button", { name: "เลือกบทบาทนี้" }).click();

  await expect(page).toHaveURL(/\/onboarding\/focus/, { timeout: 15_000 });
  await page.getByText("สุขภาพ", { exact: true }).click();
  await page.getByRole("button", { name: "เตรียมพื้นที่เริ่มต้น" }).click();

  await expect(page).toHaveURL(/\/onboarding\/starter/, { timeout: 15_000 });
  const habitSuggestion = page.locator("article").filter({ hasText: "ขยับร่างกาย 20 นาที" });
  await habitSuggestion.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  await expect(habitSuggestion.getByText("เพิ่มแล้ว")).toBeVisible();

  await page.getByRole("button", { name: "ไปหน้าวันนี้" }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 20_000 });

  await page.goto("/life");
  await expect(page.getByText("ขยับร่างกาย 20 นาที", { exact: true })).toBeVisible();

  await page.goto("/goals");
  await expect(page.getByText("กำหนดผลลัพธ์สำคัญของเดือนนี้", { exact: true })).toHaveCount(0);
});
