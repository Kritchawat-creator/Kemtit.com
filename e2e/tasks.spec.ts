import { expect, test } from "@playwright/test";

import { addTaskToCurrentGoal, createWeeklyGoal, onboardNewUser } from "./helpers";

test("เพิ่มงานให้เป้าสัปดาห์ ติ๊กเสร็จทั้งหมด แล้วเป้าสัปดาห์ครบ 100%", async ({ page }) => {
  await onboardNewUser(page, "tasks");
  const goalTitle = "Test weekly goal for task progress";
  const firstTaskTitle = "Prepare weekly campaign";
  const secondTaskTitle = "Call five previous customers";
  const goalId = await createWeeklyGoal(page, goalTitle);
  await addTaskToCurrentGoal(page, firstTaskTitle);

  // A new workspace starts empty, so this task is created explicitly for the goal.
  await expect(page.getByRole("checkbox")).toHaveCount(1);

  await addTaskToCurrentGoal(page, secondTaskTitle);
  await page.goto(`/goals/${goalId}`);
  await expect(page.getByRole("checkbox")).toHaveCount(2);

  // ติ๊กทั้งสอง → execution goal ถึง 100 → toast ทำได้แล้ว + ring 100%
  await page.getByRole("checkbox", { name: new RegExp(firstTaskTitle) }).check();
  await page.getByRole("checkbox", { name: new RegExp(secondTaskTitle) }).check();
  await expect(page.getByText(/ทำได้แล้ว/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("100%").first()).toBeVisible({ timeout: 15_000 });
});

test("task ซ้ำทุกวัน: ติ๊ก occurrence วันนี้เป็นเสร็จ คงอยู่หลัง reload และยกเลิกได้", async ({
  page,
}) => {
  await onboardNewUser(page, "recurring");
  const goalId = await createWeeklyGoal(page, "Weekly goal for recurring task");

  // Add the recurring task from its own goal so the test does not depend on template data.
  await page.getByRole("link", { name: "เพิ่มงาน" }).first().click();
  await page.getByLabel("ชื่องาน").fill("เช็คสต็อกสินค้า");
  await page.locator('label[for="recurrence-daily"]').click();
  await expect(page.getByRole("radio", { name: "ทุกวัน" })).toBeChecked();
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  await page.goto(`/goals/${goalId}`);
  const box = page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ });
  await expect(box).toBeVisible();
  // UI ติ๊กแบบ optimistic ทันที — ต้องรอ response ของ server action (POST) ก่อน reload ไม่งั้น reload จะยกเลิก request
  const checked = page.waitForResponse((r) => r.request().method() === "POST");
  await box.check();
  await expect(box).toBeChecked();
  await checked;

  // occurrence state survives reload; legacy task_completions remains a read fallback.
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ })).toBeChecked();

  const unchecked = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ }).uncheck();
  await expect(page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ })).not.toBeChecked();
  await unchecked;
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /เช็คสต็อกสินค้า/ })).not.toBeChecked();
});

test("task ซ้ำ: เลื่อนหรือข้ามเฉพาะ occurrence โดยวันถัดไปยังอยู่ใน series", async ({ page }) => {
  await onboardNewUser(page, "occurrence-actions");

  const today = bkkDate();
  const tomorrow = addDays(today, 1);
  const rescheduledTitle = "เลื่อนเฉพาะครั้งนี้";

  await page.goto(`/calendar?view=day&date=${today}&new=task`);
  await page.getByLabel("ชื่องาน").fill(rescheduledTitle);
  await page.locator('label[for="recurrence-daily"]').click();
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  await page.goto(`/calendar?view=day&date=${today}`);
  await page
    .getByRole("button", { name: `เปิดรายละเอียด ${rescheduledTitle}` })
    .first()
    .click();
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "พรุ่งนี้" }).click();
  await expect(page.getByText(/เลื่อนไป .* แล้ว/)).toBeVisible();

  await page.goto(`/calendar?view=day&date=${today}`);
  await expect(
    page.getByRole("button", { name: `เปิดรายละเอียด ${rescheduledTitle}` }),
  ).toHaveCount(0);

  // DAILY series already has its own occurrence tomorrow. The moved source
  // occurrence must coexist with it instead of replacing/merging it.
  await page.goto(`/calendar?view=day&date=${tomorrow}`);
  await expect(
    page.getByRole("button", { name: `เปิดรายละเอียด ${rescheduledTitle}` }),
  ).toHaveCount(2);

  const skippedTitle = "ข้ามเฉพาะครั้งนี้";
  await page.goto(`/calendar?view=day&date=${today}&new=task`);
  await page.getByLabel("ชื่องาน").fill(skippedTitle);
  await page.locator('label[for="recurrence-daily"]').click();
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  await page.goto(`/calendar?view=day&date=${today}`);
  await page
    .getByRole("button", { name: `เปิดรายละเอียด ${skippedTitle}` })
    .first()
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "ข้ามครั้งนี้" }).click();
  await expect(page.getByText("ข้ามครั้งนี้แล้ว")).toBeVisible();
  await page.goto(`/calendar?view=day&date=${tomorrow}`);
  await expect(
    page.getByRole("button", { name: `เปิดรายละเอียด ${skippedTitle}` }).first(),
  ).toBeVisible();
});

function bkkDate(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
