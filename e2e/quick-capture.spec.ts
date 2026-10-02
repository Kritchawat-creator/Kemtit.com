import { expect, test, type Page } from "@playwright/test";

import { onboardNewUser } from "./helpers";

async function openQuickCapture(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("navigation", { name: "เมนูหลัก" }).getByLabel("เปิดเมนูเพิ่ม").click();
  } else {
    await page.getByRole("banner").getByRole("button", { name: "เปิดเมนูเพิ่ม" }).click();
  }
  await expect(page.getByRole("dialog", { name: "บันทึกด่วน" })).toBeVisible();
  await expect(page.getByLabel("คุณอยากเพิ่มอะไร")).toBeFocused();
}

async function openTodayQuickCapture(page: Page, isMobile: boolean) {
  await page.goto("/today");
  await openQuickCapture(page, isMobile);
}

test("Universal Quick Capture creates a canonical Task from the live preview", async ({
  page,
  isMobile,
}) => {
  await onboardNewUser(page, "quick-capture-task");
  await openTodayQuickCapture(page, isMobile);

  await page.getByLabel("คุณอยากเพิ่มอะไร").fill("ส่งรายงานวันนี้");

  const captureDialog = page.getByRole("dialog", { name: "บันทึกด่วน" });
  await expect(
    captureDialog.locator("span.rounded-full").filter({ hasText: /^งาน$/ }),
  ).toBeVisible();
  await expect(captureDialog.getByRole("region", { name: "ตัวอย่างจะอัปเดตตามข้อความที่พิมพ์" }))
    .toBeVisible();
  await expect(captureDialog.getByText("ส่งรายงานวันนี้", { exact: true })).toBeVisible();

  await captureDialog.getByRole("button", { name: "ยืนยันและบันทึก" }).click();
  await expect(captureDialog).toHaveCount(0);

  await page.goto("/calendar?view=day");
  await expect(
    page.getByRole("button", { name: "เปิดรายละเอียด ส่งรายงานวันนี้", exact: true }),
  ).toBeVisible();
});

test("Bill stays a canonical Bill and appears in Finance/Calendar without a substitute Task", async ({
  page,
  isMobile,
}) => {
  await onboardNewUser(page, "quick-capture-bill");
  await openQuickCapture(page, isMobile);

  await page.getByLabel("คุณอยากเพิ่มอะไร").fill("Pay electricity bill this Friday, 1,200 THB");

  const captureDialog = page.getByRole("dialog", { name: "บันทึกด่วน" });
  const preview = captureDialog.getByRole("region", {
    name: "ตัวอย่างจะอัปเดตตามข้อความที่พิมพ์",
  });
  await expect(preview.getByText("บิล", { exact: true })).toBeVisible();
  await captureDialog.getByText("แก้รายละเอียด (ไม่บังคับ)").click();
  await expect(captureDialog.getByLabel("จำนวนเงินของบิล")).toHaveValue("1200");
  await captureDialog.getByRole("button", { name: "ยืนยันและบันทึก" }).click();
  await expect(captureDialog).toHaveCount(0);

  await page.goto("/finance");
  await expect(
    page.getByText("Pay electricity bill this Friday, 1,200 THB", { exact: true }),
  ).toBeVisible();

  await page.goto("/inbox");
  await expect(
    page.getByText("Pay electricity bill this Friday, 1,200 THB", { exact: true }),
  ).toHaveCount(0);
});

test("Bill due today projects to Today + Finance + Calendar from one canonical record", async ({
  page,
  isMobile,
}) => {
  await onboardNewUser(page, "quick-capture-bill-projection");
  await openQuickCapture(page, isMobile);

  await page.getByLabel("คุณอยากเพิ่มอะไร").fill("Pay electricity bill today, 1,200 THB");
  const captureDialog = page.getByRole("dialog", { name: "บันทึกด่วน" });
  const preview = captureDialog.getByRole("region", {
    name: "ตัวอย่างจะอัปเดตตามข้อความที่พิมพ์",
  });
  await expect(preview.getByText("บิล", { exact: true })).toBeVisible();
  await captureDialog.getByRole("button", { name: "ยืนยันและบันทึก" }).click();
  await expect(captureDialog).toHaveCount(0);

  await expect(
    page.getByText("Pay electricity bill today, 1,200 THB", { exact: true }),
  ).toBeVisible();

  await page.goto("/finance");
  await expect(
    page.getByText("Pay electricity bill today, 1,200 THB", { exact: true }),
  ).toBeVisible();

  await page.goto("/calendar?view=day");
  await expect(
    page.getByText("Pay electricity bill today, 1,200 THB", { exact: true }),
  ).toBeVisible();

  await page.goto("/inbox");
  await expect(
    page.getByText("Pay electricity bill today, 1,200 THB", { exact: true }),
  ).toHaveCount(0);
});

test("Event and Note keep their own canonical types", async ({ page, isMobile }) => {
  await onboardNewUser(page, "quick-capture-event-note");

  await openQuickCapture(page, isMobile);
  await page.getByLabel("คุณอยากเพิ่มอะไร").fill("ประชุมทีมวันนี้");
  const captureDialog = page.getByRole("dialog", { name: "บันทึกด่วน" });
  const eventPreview = captureDialog.getByRole("region", {
    name: "ตัวอย่างจะอัปเดตตามข้อความที่พิมพ์",
  });
  await expect(eventPreview.getByText("เหตุการณ์", { exact: true })).toBeVisible();
  await captureDialog.getByRole("button", { name: "ยืนยันและบันทึก" }).click();
  await expect(captureDialog).toHaveCount(0);

  await openQuickCapture(page, isMobile);
  await page.getByLabel("คุณอยากเพิ่มอะไร").fill("จดไว้ ติดต่อฝ่ายบัญชี");
  const noteCaptureDialog = page.getByRole("dialog", { name: "บันทึกด่วน" });
  const notePreview = noteCaptureDialog.getByRole("region", {
    name: "ตัวอย่างจะอัปเดตตามข้อความที่พิมพ์",
  });
  await expect(notePreview.getByText("โน้ต", { exact: true })).toBeVisible();
  await noteCaptureDialog.getByRole("button", { name: "ยืนยันและบันทึก" }).click();
  await expect(noteCaptureDialog).toHaveCount(0);

  await page.goto("/inbox");
  const inboxNotes = page.getByRole("region", { name: "โน้ต" });
  await expect(inboxNotes.getByText("จดไว้ ติดต่อฝ่ายบัญชี", { exact: true })).toBeVisible();
  await expect(page.locator("[data-task-id]").filter({ hasText: "จดไว้ ติดต่อฝ่ายบัญชี" })).toHaveCount(0);
  await expect(inboxNotes.getByText("ประชุมทีมวันนี้", { exact: true })).toHaveCount(0);

  await page.goto("/calendar?view=day");
  const calendarNotes = page
    .getByRole("complementary", { name: "งานที่ยังไม่ได้จัดเวลา" })
    .getByRole("region", { name: "โน้ต" });
  const calendarSchedule = page.getByRole("region", { name: "ตารางเวลาของวันนี้" }).first();
  await expect(calendarSchedule.getByText("ประชุมทีมวันนี้", { exact: true })).toBeVisible();
  await expect(calendarNotes.getByText("จดไว้ ติดต่อฝ่ายบัญชี", { exact: true })).toBeVisible();
  await expect(calendarSchedule.getByText("จดไว้ ติดต่อฝ่ายบัญชี", { exact: true })).toHaveCount(0);
  await expect(calendarNotes.getByText("ประชุมทีมวันนี้", { exact: true })).toHaveCount(0);
});
