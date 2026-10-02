import { expect, test } from "@playwright/test";

import { onboardNewUser } from "./helpers";

test("Today: เห็นแผนวันนี้ เพิ่มงานด่วน และติ๊กงานเสร็จได้", async ({ page }) => {
  await onboardNewUser(page, "dashboard");
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByRole("heading", { name: "วันนี้", exact: true })).toBeVisible();

  const plan = page.getByRole("region", { name: "แผนวันนี้", exact: true });
  await expect(plan).toBeVisible();
  await plan.getByRole("textbox", { name: "เพิ่มงาน" }).fill("จัดแผนวันนี้");
  await plan.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();

  const box = plan.getByRole("checkbox", { name: /จัดแผนวันนี้/ });
  const toggled = page.waitForResponse((r) => r.request().method() === "POST");
  await box.check();
  await toggled;
  await expect(box).toBeChecked({ timeout: 15_000 });
});
