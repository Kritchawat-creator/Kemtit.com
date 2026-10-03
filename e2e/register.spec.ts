import { expect, test, type Page } from "@playwright/test";

import { completeOnboarding, latestOtpFor, uniqueEmail } from "./helpers";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

test("new user can register with email OTP and reach onboarding", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-chrome") {
    await page.setViewportSize({ width: 320, height: 844 });
  }

  const email = uniqueEmail("register");
  const next = "/today?source=register&view=focus";
  const encodedNext = encodeURIComponent(next);

  await page.goto(`/register?next=${encodedNext}`);
  await expect(page.getByRole("heading", { name: "สร้างบัญชี" })).toBeVisible();
  await expect(page.getByRole("button", { name: "รับรหัสยืนยัน" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const signInLink = page.getByRole("link", { name: "เข้าสู่ระบบ" });
  await expect(signInLink).toHaveAttribute("href", `/login?next=${encodedNext}`);
  await signInLink.click();
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(next);
  await expectNoHorizontalOverflow(page);

  const registerLink = page.getByRole("link", { name: "สมัครใช้งาน" });
  await expect(registerLink).toHaveAttribute("href", `/register?next=${encodedNext}`);
  await registerLink.click();
  await expect(page).toHaveURL(/\/register\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(next);

  await page.getByLabel("อีเมล").fill(email);
  await page.getByRole("button", { name: "รับรหัสยืนยัน" }).click();
  await expect(page.getByRole("heading", { name: "ยืนยันอีเมล" })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByText("กรอกรหัส 6 หลัก ระบบจะยืนยันให้อัตโนมัติ")).toBeVisible();
  await expect(page.getByText("ผู้ใช้ใหม่จะไปตั้งค่าเริ่มต้นหลังยืนยัน")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const code = await latestOtpFor(email);
  await page.getByLabel("รหัสยืนยัน 6 หลัก").fill(code);
  await expect(page).toHaveURL(/\/onboarding\/persona/, { timeout: 15_000 });
  await completeOnboarding(page);
});
