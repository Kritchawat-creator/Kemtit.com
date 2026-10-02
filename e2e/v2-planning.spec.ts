import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("V2 planner: Inbox → Today Top 3 → Time Block → Life Habit", async ({ page }) => {
  await onboardNewUser(page, "v2-planner");

  const firstTaskTitle = "เตรียมแผน V2 วันนี้";
  const secondTaskTitle = "ตรวจลำดับงานสำคัญ V2";
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "กล่องเข้า", exact: true })).toBeVisible();

  await page.getByRole("textbox", { name: "งานใหม่ในกล่องเข้า" }).fill(firstTaskTitle);
  await page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }).click();
  await expect(page.getByText("เก็บงานเข้ากล่องเข้าแล้ว")).toBeVisible();
  await expect(page.getByText(firstTaskTitle)).toBeVisible();

  const inboxRow = page.getByRole("listitem").filter({ hasText: firstTaskTitle });
  await inboxRow.getByRole("button", { name: "วางวันนี้" }).click();
  await expect(page.getByText("ย้ายงานไปแผนแล้ว")).toBeVisible();

  await page.getByRole("textbox", { name: "งานใหม่ในกล่องเข้า" }).fill(secondTaskTitle);
  await page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }).click();
  await expect(page.getByText("เก็บงานเข้ากล่องเข้าแล้ว")).toBeVisible();
  const secondInboxRow = page.getByRole("listitem").filter({ hasText: secondTaskTitle });
  await secondInboxRow.getByRole("button", { name: "วางวันนี้" }).click();
  await expect(page.getByText("ย้ายงานไปแผนแล้ว")).toBeVisible();

  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "วันนี้", exact: true })).toBeVisible();
  await expect(page.getByText(firstTaskTitle).first()).toBeVisible();
  await expect(page.getByText(secondTaskTitle).first()).toBeVisible();

  const planSettings = page.getByRole("region", { name: "ตั้งค่าแผนวันนี้" });
  for (const checkbox of await planSettings.getByRole("checkbox").all()) {
    if (await checkbox.isChecked()) await checkbox.uncheck();
  }
  await planSettings.getByRole("checkbox", { name: secondTaskTitle, exact: true }).check();
  await planSettings.getByRole("checkbox", { name: firstTaskTitle, exact: true }).check();
  await planSettings.getByRole("button", { name: "บันทึกแผน" }).click();
  await expect(page.getByText("บันทึกแผนวันนี้แล้ว")).toBeVisible();

  await page.reload();
  const todayPlan = page.getByRole("region", { name: "แผนวันนี้" });
  const taskButtons = todayPlan.locator('button[aria-label^="เปิดรายละเอียด "]');
  await expect(taskButtons.nth(0)).toHaveAttribute("aria-label", `เปิดรายละเอียด ${secondTaskTitle}`);
  await expect(taskButtons.nth(1)).toHaveAttribute("aria-label", `เปิดรายละเอียด ${firstTaskTitle}`);

  const schedule = page.getByRole("region", { name: "ตารางเวลาของวันนี้" });
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const todayFields = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
  const today = `${todayFields.year}-${todayFields.month}-${todayFields.day}`;
  await schedule.getByLabel("เริ่ม").fill(`${today}T09:00`);
  await schedule.getByLabel("จบ").fill(`${today}T09:30`);
  await schedule.getByRole("button", { name: "จัดช่วงเวลา" }).click();
  await expect(page.getByText("จัดช่วงเวลาแล้ว")).toBeVisible();

  // atomic DB guard: ช่วงเวลาเดิมห้ามสร้างซ้ำ/ชนกันได้แม้ action ถูกเรียกอีกครั้ง
  await schedule.getByRole("button", { name: "จัดช่วงเวลา" }).click();
  await expect(page.getByText("ช่วงเวลานี้ชนกับช่วงเวลาที่มีอยู่แล้ว")).toBeVisible();

  await page.goto("/life");
  await page.getByRole("textbox", { name: "ชื่อกิจวัตร" }).fill("เดิน 20 นาที");
  await page.getByRole("button", { name: "เพิ่มกิจวัตร" }).click();
  await expect(page.getByText("เพิ่มกิจวัตรแล้ว")).toBeVisible();
  await expect(page.getByText("เดิน 20 นาที")).toBeVisible();

  await page.getByRole("button", { name: "ทำเครื่องหมาย เดิน 20 นาที" }).click();
  await expect(page.getByText("ทำกิจวัตรแล้ว")).toBeVisible();
  await page.reload();
  await expect(page.getByText("เดิน 20 นาที")).toBeVisible();
});
