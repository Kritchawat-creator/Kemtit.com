import { expect, type Page } from "@playwright/test";

/** Mailpit ของ Supabase local (pnpm exec supabase start) — อ่านรหัส OTP จากอีเมลล่าสุดของ address นั้น */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@kemtit.test`;
}

export async function latestOtpFor(email: string, attempts = 30): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    if (search.ok) {
      const data = (await search.json()) as { messages?: { ID: string }[] };
      const first = data.messages?.[0];
      if (first) {
        const detail = (await (
          await fetch(`${MAILPIT_URL}/api/v1/message/${first.ID}`)
        ).json()) as {
          Text?: string;
          HTML?: string;
        };
        const match = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`.match(/\b(\d{6})\b/);
        if (match) return match[1];
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`ไม่พบรหัส OTP สำหรับ ${email} ใน Mailpit (${MAILPIT_URL})`);
}

/** อีเมล → OTP → ออกจากหน้า login */
export async function signInWithOtp(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByRole("button", { name: "ส่งรหัสยืนยัน" }).click();
  await expect(page.getByRole("heading", { name: /ใส่รหัสที่ส่งไปที่/ })).toBeVisible();
  const code = await latestOtpFor(email);
  await page.getByLabel("รหัสยืนยัน 6 หลัก").fill(code);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Redesigned onboarding: Role → Focus → Starter Workspace → Today. */
export async function completeOnboarding(page: Page) {
  await expect(page).toHaveURL(/\/onboarding\/persona/);
  await page.getByText("ผู้ขาย / ร้านค้า", { exact: true }).click();
  await page.getByRole("button", { name: "เลือกบทบาทนี้" }).click();

  await expect(page).toHaveURL(/\/onboarding\/focus/, { timeout: 15_000 });
  await page.getByText("งาน", { exact: true }).first().click();
  await page.getByRole("button", { name: "เตรียมพื้นที่เริ่มต้น" }).click();

  await expect(page).toHaveURL(/\/onboarding\/starter/, { timeout: 15_000 });
  await page.getByRole("button", { name: "ไปหน้าวันนี้" }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 20_000 });
}

/** user ใหม่ที่จบ onboarding แล้ว — ใช้เป็นจุดเริ่มของ flow อื่น */
export async function onboardNewUser(page: Page, prefix = "user") {
  const email = uniqueEmail(prefix);
  await signInWithOtp(page, email);
  await completeOnboarding(page);
  return email;
}

/** Create a current-week goal through the GoalForm and open its detail page. */
export async function createWeeklyGoal(page: Page, title: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const weekStart = start.toISOString().slice(0, 10);

  await page.goto(`/goals?new=goal&periodType=week&periodStart=${weekStart}`);
  await page.getByLabel("ชื่อเป้าหมาย").fill(title);
  await page.getByRole("button", { name: "บันทึกเป้าหมาย" }).click();
  await expect(page.getByText("บันทึกเป้าหมายแล้ว")).toBeVisible();

  await page.goto("/goals");
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.getByRole("link", { name: new RegExp(escapedTitle) }).click();
  await expect(page).toHaveURL(/\/goals\/[0-9a-f-]+$/);
  const goalId = page.url().match(/\/goals\/([0-9a-f-]+)$/i)?.[1];
  if (!goalId) throw new Error(`Could not read the created goal ID from ${page.url()}`);
  return goalId;
}

/** Add and save a task on the currently open goal detail page. */
export async function addTaskToCurrentGoal(page: Page, title: string) {
  await page.getByRole("link", { name: "เพิ่มงาน" }).first().click();
  await page.getByLabel("ชื่องาน").fill(title);
  await page.getByRole("button", { name: "บันทึกงาน" }).click();
  await expect(page.getByText("เพิ่มงานแล้ว")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: new RegExp(title) })).toBeVisible();
}
