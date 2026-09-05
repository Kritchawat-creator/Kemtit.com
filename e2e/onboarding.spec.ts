import { expect, test } from "@playwright/test";

import { signInWithOtp, uniqueEmail } from "./helpers";

/**
 * Flow A (Scope §7): สมัครด้วย OTP → เลือก persona → goal แรก → แดชบอร์ด
 * ต้องมี Supabase local รันอยู่ (pnpm exec supabase start) และ .env.local ชี้ไปที่นั่น
 */
test("ผู้ใช้ใหม่สมัครด้วย OTP แล้วถูกพาไปเลือก persona และตั้งเป้าแรก", async ({ page }) => {
  const email = uniqueEmail("onboarding");
  await signInWithOtp(page, email);

  await expect(page).toHaveURL(/\/onboarding\/persona/);
  await expect(page.getByRole("heading", { name: "คุณจะใช้เข็มทิศเพื่ออะไรเป็นหลัก" })).toBeVisible();

  // seller ถูกเลือกไว้เป็นค่าเริ่มต้น (persona เดียวที่เปิดใน POC) — persona อื่นเป็น "เร็ว ๆ นี้"
  await expect(page.getByText("เร็ว ๆ นี้").first()).toBeVisible();
  await page.getByRole("button", { name: "ใช้แบบนี้" }).click();

  await expect(page).toHaveURL(/\/onboarding\/first-goal/);
});
