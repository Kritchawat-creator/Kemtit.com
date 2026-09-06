import { expect, test } from "@playwright/test";

import { completeOnboarding, signInWithOtp, uniqueEmail } from "./helpers";

/**
 * Flow A (Scope §7): สมัครด้วย OTP → เลือก persona → goal แรกจาก template → แดชบอร์ด
 * ต้องมี Supabase local รันอยู่ (pnpm exec supabase start) และ .env.local ชี้ไปที่นั่น
 */
test("ผู้ใช้ใหม่สมัครด้วย OTP เลือก persona ตั้งเป้าแรก แล้วเห็น cascade ในหน้าเป้าหมาย", async ({
  page,
}) => {
  const email = uniqueEmail("onboarding");
  await signInWithOtp(page, email);

  await expect(page).toHaveURL(/\/onboarding\/persona/);
  await expect(
    page.getByRole("heading", { name: "คุณจะใช้เข็มทิศเพื่ออะไรเป็นหลัก" }),
  ).toBeVisible();
  await expect(page.getByText("เร็ว ๆ นี้").first()).toBeVisible();

  await completeOnboarding(page, 50000);

  // template (Decision 1.4): เป้าเดือน metric + week goal execution
  await page.goto("/goals");
  await expect(page.getByRole("heading", { name: "เป้ารายเดือน" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "เป้ารายสัปดาห์" })).toBeVisible();
  await expect(page.getByRole("link", { name: /สัปดาห์ที่ 1\// })).toBeVisible();

  // อัปเดตยอด metric → % เปลี่ยน
  await page
    .getByRole("link", { name: /ยอดขาย/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/goals\/[0-9a-f-]+/);
  await page.getByRole("button", { name: "อัปเดตยอด" }).click();
  await page.getByLabel("ยอดตอนนี้").fill("25000");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("บันทึกยอดแล้ว")).toBeVisible();
  await expect(page.getByText("50%").first()).toBeVisible();
});
