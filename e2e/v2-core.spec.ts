import { expect, test } from "@playwright/test";

import { onboardNewUser, signInWithOtp, uniqueEmail } from "./helpers";

async function onboardProfessional(page: import("@playwright/test").Page) {
  const email = uniqueEmail("professional-v2");
  await signInWithOtp(page, email);
  await expect(page).toHaveURL(/\/onboarding\/persona/);
  await page.getByText("พนักงาน", { exact: true }).click();
  await page.getByRole("button", { name: "เลือกบทบาทนี้" }).click();

  await expect(page).toHaveURL(/\/onboarding\/focus/, { timeout: 15_000 });
  await page.getByText("งาน", { exact: true }).first().click();
  await page.getByRole("button", { name: "เตรียมพื้นที่เริ่มต้น" }).click();

  await expect(page).toHaveURL(/\/onboarding\/starter/, { timeout: 15_000 });
  await page.getByRole("button", { name: "ไปหน้าวันนี้" }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 20_000 });
}

test("V2 Inbox → วางวันนี้ → เลือก Top priority → Today แสดงงานสำคัญ", async ({ page }) => {
  await onboardNewUser(page, "v2-inbox");

  await page.goto("/inbox");
  await page.getByLabel("งานใหม่ในกล่องเข้า").fill("เตรียมแผนเปิดตัวสินค้า");
  await page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }).click();
  await expect(page.getByText("เก็บงานเข้ากล่องเข้าแล้ว")).toBeVisible();
  await page.reload();
  await expect(page.getByText("เตรียมแผนเปิดตัวสินค้า", { exact: true })).toBeVisible();

  const item = page.getByRole("listitem").filter({ hasText: "เตรียมแผนเปิดตัวสินค้า" });
  await item.getByRole("button", { name: "วางวันนี้" }).click();
  await expect(page.getByText("ย้ายงานไปแผนแล้ว")).toBeVisible();

  await page.goto("/today");
  await expect(
    page.getByRole("button", { name: "เปิดรายละเอียด เตรียมแผนเปิดตัวสินค้า" }),
  ).toBeVisible();

  const planSettings = page.getByRole("region", { name: "ตั้งค่าแผนวันนี้" });
  await planSettings.getByRole("checkbox", { name: /เตรียมแผนเปิดตัวสินค้า/ }).check();
  await page.getByRole("button", { name: "บันทึกแผน" }).click();
  await expect(page.getByText("บันทึกแผนวันนี้แล้ว")).toBeVisible();

  await page.reload();
  await expect(page.getByText("เตรียมแผนเปิดตัวสินค้า").first()).toBeVisible();
});

test("V2 Professional → สร้าง Project", async ({ page }) => {
  await onboardProfessional(page);

  await page.goto("/work/projects");
  await page.getByLabel("ชื่อโปรเจกต์").fill("China Sync");
  await page.getByRole("button", { name: "สร้างโปรเจกต์" }).click();

  await expect(page.getByText("สร้างโปรเจกต์แล้ว")).toBeVisible();
  await expect(page.getByRole("heading", { name: "China Sync" })).toBeVisible();
});

test("V2 Project detail → แก้ไข เพิ่มงาน และจัดการงานย่อย", async ({ page }) => {
  await onboardProfessional(page);

  const projectTitle = "Project detail QA";
  await page.goto("/work/projects");
  await page.getByLabel("ชื่อโปรเจกต์").fill(projectTitle);
  await page.getByLabel("รายละเอียด").fill("รายละเอียดก่อนแก้ไข");
  await page.getByRole("button", { name: "เปิดปฏิทิน" }).click();
  await page.getByRole("button", { name: /วันนี้,/ }).click();
  const targetDatePicker = page.getByRole("button", { name: "เปิดปฏิทิน" });
  const targetDateLabel = (await targetDatePicker.innerText()).trim();
  await expect(targetDatePicker).not.toHaveText("เลือกวันที่");
  await page.getByRole("button", { name: "สร้างโปรเจกต์" }).click();
  await expect(page.getByText("สร้างโปรเจกต์แล้ว")).toBeVisible();

  await page.reload();
  await page.getByRole("link", { name: projectTitle, exact: true }).click();
  await expect(page.getByRole("heading", { name: projectTitle, exact: true })).toBeVisible();
  await expect(page.getByText("0/0 · 0%")).toBeVisible();
  await expect(page.getByRole("button", { name: "เปิดปฏิทิน" })).toHaveText(targetDateLabel);

  await page.getByLabel("รายละเอียด").fill("รายละเอียดที่แก้ไขแล้ว");
  await page.getByRole("button", { name: "บันทึกโปรเจกต์" }).click();
  await expect(page.getByText("บันทึกโปรเจกต์แล้ว")).toBeVisible();
  await expect(page.getByLabel("รายละเอียด")).toHaveValue("รายละเอียดที่แก้ไขแล้ว");

  await page.getByRole("link", { name: "เพิ่มงาน", exact: true }).first().click();
  const taskDialog = page.getByRole("dialog");
  await taskDialog.getByLabel("ชื่องาน").fill("งานในโปรเจกต์");
  await taskDialog.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  await page.goto(page.url().split("?")[0]);
  await page.reload();
  const task = page.getByRole("button", { name: "เปิดรายละเอียด งานในโปรเจกต์" });
  await expect(task).toBeVisible();
  await task.click();
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "แก้ไข" }).click();
  await expect(detail.getByRole("combobox", { name: "ผูกกับโปรเจกต์" })).toBeVisible();
  await detail.getByRole("button", { name: "ปิด" }).click();

  await task.click();
  const reopenedDetail = page.getByRole("dialog");
  await expect(reopenedDetail.getByRole("heading", { name: "งานย่อย" })).toBeVisible();

  await reopenedDetail.getByRole("textbox", { name: "เพิ่มงานย่อย" }).fill("ตรวจ API");
  await reopenedDetail.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  await expect(reopenedDetail.getByText("ตรวจ API")).toBeVisible();
  const subtask = reopenedDetail.getByRole("listitem").filter({ hasText: "ตรวจ API" });
  await subtask.getByRole("checkbox", { name: "ตรวจ API" }).click();
  await expect(subtask.getByRole("checkbox", { name: "ตรวจ API" })).toBeChecked();

  await subtask.getByRole("button", { name: "แก้ไขงานย่อย" }).click();
  await reopenedDetail.getByRole("textbox", { name: "แก้ไขงานย่อย" }).fill("ตรวจ API v2");
  await reopenedDetail.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(reopenedDetail.getByText("ตรวจ API v2")).toBeVisible();
  const editedSubtask = reopenedDetail.getByRole("listitem").filter({ hasText: "ตรวจ API v2" });
  await editedSubtask.getByRole("button", { name: "ลบงานย่อย" }).click();
  await expect(reopenedDetail.getByText("ตรวจ API v2")).toHaveCount(0);

  await reopenedDetail.getByRole("button", { name: "ปิด" }).click();
  await page.getByRole("button", { name: "เก็บในคลัง" }).click();
  await expect(page.getByText("เก็บโปรเจกต์ในคลังแล้ว")).toBeVisible();
  await expect(page.getByRole("link", { name: projectTitle, exact: true })).toHaveCount(0);
});

test("V2 Finance → ตั้งค่า investment goal และบันทึก contribution", async ({ page }) => {
  await onboardNewUser(page, "v2-finance");

  await page.goto("/goals?new=goal&domain=finance&goalKind=metric&unit=THB");
  await page.getByLabel("ชื่อเป้าหมาย").fill("กองทุนลงทุนระยะยาว");
  await page.getByRole("spinbutton", { name: "เป้าตัวเลข" }).fill("100000");
  await expect(page.getByLabel("หน่วย")).toHaveValue("THB");
  await page.getByRole("button", { name: "บันทึกเป้าหมาย" }).click();
  await expect(page.getByText("บันทึกเป้าหมายแล้ว")).toBeVisible();

  await page.goto("/finance");
  const financeGoal = page.getByRole("region", { name: "กองทุนลงทุนระยะยาว" });
  await expect(financeGoal).toBeVisible();
  await financeGoal.locator("select").selectOption("investment");
  await expect(financeGoal.locator("select")).toHaveValue("investment");
  await financeGoal.getByLabel("เป้ารายเดือน").fill("5000");
  await financeGoal.getByRole("button", { name: "บันทึกแผน" }).click();
  await expect(page.getByText("บันทึกแผนการเงินแล้ว")).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(financeGoal.locator("select")).toHaveValue("investment");
  await expect(financeGoal.getByLabel("เป้ารายเดือน")).toHaveValue("5000");

  await page.goto("/finance?new=entry");
  const entryDialog = page.getByRole("dialog");
  await expect(entryDialog).toBeVisible({ timeout: 15_000 });
  const goalSelector = entryDialog.getByRole("combobox", { name: "เป้าหมาย" });
  if (await goalSelector.count()) {
    await goalSelector.click();
    await page.getByRole("option", { name: "กองทุนลงทุนระยะยาว", exact: true }).click();
  } else {
    await expect(entryDialog.getByText("เป้าหมาย · กองทุนลงทุนระยะยาว", { exact: true })).toBeVisible();
  }
  const refreshedEntryDialog = page.getByRole("dialog");
  await expect(refreshedEntryDialog).toBeVisible();
  await refreshedEntryDialog.locator('input[type="number"]').first().fill("5000");
  await refreshedEntryDialog.getByRole("button", { name: "บันทึกยอด" }).click();
  await expect(page.getByText(/บันทึกแล้ว \+฿5,000/)).toBeVisible();
  await page.goto("/finance");
  await expect(
    page.getByRole("region", { name: "กองทุนลงทุนระยะยาว" }).getByText(/฿5,000/),
  ).toBeVisible();
});

test("V2 Life → สร้าง Habit → ทำเครื่องหมายเสร็จ", async ({ page }) => {
  await onboardNewUser(page, "v2-life");

  await page.goto("/life");
  await page.getByLabel("ชื่อกิจวัตร").fill("เดิน 20 นาที");
  await page.getByRole("button", { name: "เพิ่มกิจวัตร" }).click();

  await expect(page.getByText("เพิ่มกิจวัตรแล้ว")).toBeVisible();
  await expect(page.getByText("เดิน 20 นาที")).toBeVisible();

  await page.getByRole("button", { name: "ทำเครื่องหมาย เดิน 20 นาที" }).click();
  await expect(page.getByText("ทำกิจวัตรแล้ว")).toBeVisible();
  await page.reload();
  await expect(page.getByText("เดิน 20 นาที")).toHaveClass(/line-through/);
});

test("V2 Notification preferences → opt-in แล้วคงค่าหลัง reload", async ({ page }) => {
  await onboardNewUser(page, "v2-notification-prefs");

  await page.goto("/settings");
  const dailyBrief = page.getByRole("switch", { name: "สรุปแผนวันนี้" });
  await expect(dailyBrief).not.toBeChecked();
  await dailyBrief.click();
  await expect(page.getByText("บันทึกการตั้งค่าแล้ว")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("switch", { name: "สรุปแผนวันนี้" })).toBeChecked();
});

test("V2 Weekly Review → บันทึก reflection", async ({ page }) => {
  await onboardNewUser(page, "v2-review");

  await page.goto("/reviews");
  await page.getByLabel("อะไรที่ไปได้ดี").fill("จัดงานสำคัญได้ตามแผน");
  await page.getByLabel("อะไรที่ติดขัด").fill("มีงานแทรกช่วงบ่าย");
  await page.getByLabel("โฟกัสถัดไป").fill("กันเวลา focus ตอนเช้า");
  await page.getByRole("button", { name: "บันทึกการทบทวน" }).click();

  await expect(page.getByText("บันทึกการทบทวนแล้ว")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("อะไรที่ไปได้ดี")).toHaveValue("จัดงานสำคัญได้ตามแผน");
});
