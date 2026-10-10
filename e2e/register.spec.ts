import { expect, test, type Page } from "@playwright/test";

import { completeOnboarding, E2E_TEST_PASSWORD, latestOtpFor, uniqueEmail } from "./helpers";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

test("new user can register with a password, verify email, and reach onboarding", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile-chrome") {
    await page.setViewportSize({ width: 320, height: 844 });
  }

  const email = uniqueEmail("member".repeat(6));
  const displayName = "Kemtit E2E Member";
  const next = "/today?source=register&view=focus";
  const encodedNext = encodeURIComponent(next);

  await page.goto(`/register?next=${encodedNext}`);
  await expect(page.getByRole("heading", { name: "สร้างบัญชี" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ไปยืนยันอีเมล" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const signInLink = page.getByRole("link", { name: "เข้าสู่ระบบ" });
  await expect(signInLink).toHaveAttribute("href", `/login?next=${encodedNext}`);
  await signInLink.click();
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(next);
  await expect(page.getByLabel("ชื่อที่แสดง")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const registerLink = page.getByRole("link", { name: "สมัครใช้งาน" });
  await expect(registerLink).toHaveAttribute("href", `/register?next=${encodedNext}`);
  await registerLink.click();
  await expect(page).toHaveURL(/\/register\?/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(next);
  await expect(page.getByLabel("ชื่อที่แสดง")).toBeVisible();

  await page.getByLabel("ชื่อที่แสดง").fill(displayName);
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(E2E_TEST_PASSWORD);
  await page.getByLabel("ยืนยันรหัสผ่าน", { exact: true }).fill(E2E_TEST_PASSWORD);
  await page.getByRole("button", { name: "ไปยืนยันอีเมล" }).click();
  await expect(page.getByRole("heading", { name: "ยืนยันอีเมล" })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(
    page.getByText("กรอกรหัส 6 หลักเพื่อยืนยันอีเมลและสร้างบัญชีให้เสร็จ"),
  ).toBeVisible();
  await expect(page.getByText("ผู้ใช้ใหม่จะไปตั้งค่าเริ่มต้นหลังยืนยัน")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const code = await latestOtpFor(email);
  await page.getByLabel("รหัสยืนยัน 6 หลัก").fill(code);
  await expect(page).toHaveURL(/\/onboarding\/persona/, { timeout: 15_000 });
  await completeOnboarding(page);

  await page.goto("/settings");
  const savedDisplayName = page.getByLabel("ชื่อที่แสดง");
  await expect(savedDisplayName).toHaveValue(displayName);
  await page.reload();
  await expect(savedDisplayName).toHaveValue(displayName);
});
