import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("Inbox planning keeps the canonical task and exposes its details in Tasks and Today", async ({
  page,
}) => {
  await onboardNewUser(page, "inbox-task-plan");
  await page.goto("/inbox");

  const title = "เตรียมเอกสารสุขภาพประจำปี";
  await page.getByLabel("งานใหม่ในกล่องเข้า").fill(title);
  await page.getByRole("radio", { name: "สุขภาพ" }).click();
  await page.getByRole("button", { name: "เก็บเข้ากล่องเข้า" }).click();

  const inboxTask = page.locator("[data-task-id]").filter({ hasText: title });
  await expect(inboxTask).toBeVisible();
  await expect(inboxTask.getByText("สุขภาพ", { exact: true })).toBeVisible();
  const taskId = await inboxTask.getAttribute("data-task-id");
  expect(taskId).toBeTruthy();

  await inboxTask.getByRole("button", { name: "วางวันนี้" }).click();
  await expect(inboxTask).toHaveCount(0);

  await page.goto("/tasks?view=planned");
  const plannedTask = page.locator(`[data-task-id="${taskId}"]`);
  await expect(plannedTask).toBeVisible();
  await expect(plannedTask.getByText(title, { exact: true })).toBeVisible();

  await plannedTask.getByRole("button", { name: `เปิดรายละเอียด ${title}` }).click();
  await expect(page.getByText("วันที่ตั้งใจทำ", { exact: true })).toBeVisible();
  await expect(page.getByText("กำหนดส่ง (ถ้ามี)", { exact: true })).toBeVisible();

  await page.goto("/today?scope=life");
  await expect(page.getByRole("button", { name: `เปิดรายละเอียด ${title}` })).toBeVisible();

  await page.goto("/inbox");
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});
